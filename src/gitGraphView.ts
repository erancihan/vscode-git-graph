import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AvatarManager } from './avatarManager';
import { CiStatusManager } from './ciStatus';
import { getConfig } from './config';
import { DataSource, isCommitHash, isSafeRefName } from './dataSource';
import { encodeDiffDocUri } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { RepoFileWatcher } from './repoFileWatcher';
import { buildPullRequestUrl, detectPullRequestProvider, parseRemoteUrl } from './remoteUrl';
import { RepoManager, defaultRepoState } from './repoManager';
import { REPO_SETTINGS_FILE, applyRepoSettings, describeRepoSettings, hashRepoSettings, parseRepoSettings, repoSettingsFilePath, repoSettingsMatch, serializeRepoSettings, writeRepoSettingsFile } from './repoSettingsFile';
import { runGitCommandInTerminal } from './terminal';
import { GitArchiveType, GitCommandStatus, GitFileChangeType, GitGraphViewState, GitRebaseType, L10nBundle, GitRepoSet, GitRepoState, PullRequestProvider, RequestMessage, ResponseMessage } from './types';
import { abbrevCommit, copyToClipboard } from './utils';

export class GitGraphView {
	public static currentPanel: GitGraphView | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionPath: string;
	private readonly avatarManager: AvatarManager;
	private readonly ciStatusManager: CiStatusManager;
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly repoFileWatcher: RepoFileWatcher;
	private readonly repoManager: RepoManager;
	private readonly logger: Logger;
	private disposables: vscode.Disposable[] = [];
	private isGraphViewLoaded: boolean = false;
	private isPanelVisible: boolean = true;
	private currentRepo: string | null = null;

	/**
	 * Show the view. `loadRepo` is the repository to show (for example the one that contains the
	 * active editor's document), or null to keep the last active repository.
	 */
	public static createOrShow(extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, ciStatusManager: CiStatusManager, repoManager: RepoManager, logger: Logger, loadRepo: string | null) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		if (GitGraphView.currentPanel) {
			GitGraphView.currentPanel.panel.reveal(column);
			if (loadRepo !== null) GitGraphView.currentPanel.sendMessage({ command: 'selectRepo', repo: loadRepo });
			return;
		}
		if (loadRepo !== null) extensionState.setLastActiveRepo(loadRepo);

		const panel = vscode.window.createWebviewPanel('git-graph', 'Git Graph', column || vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: getConfig().retainContextWhenHidden(),
			localResourceRoots: [
				vscode.Uri.file(path.join(extensionPath, 'media'))
			]
		});

		GitGraphView.currentPanel = new GitGraphView(panel, extensionPath, dataSource, extensionState, avatarManager, ciStatusManager, repoManager, logger);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, dataSource: DataSource, extensionState: ExtensionState, avatarManager: AvatarManager, ciStatusManager: CiStatusManager, repoManager: RepoManager, logger: Logger) {
		this.panel = panel;
		this.logger = logger;
		this.extensionPath = extensionPath;
		this.avatarManager = avatarManager;
		this.ciStatusManager = ciStatusManager;
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.repoManager = repoManager;
		this.avatarManager.registerView(this);
		this.ciStatusManager.registerView(this);
		this.logger.log('Git Graph View opened');

		panel.iconPath = getConfig().tabIconColourTheme() === 'colour'
			? this.getUri('resources', 'webview-icon.svg')
			: { light: this.getUri('resources', 'webview-icon-light.svg'), dark: this.getUri('resources', 'webview-icon-dark.svg') };

		this.update();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.onDidChangeViewState(() => {
			if (this.panel.visible !== this.isPanelVisible) {
				if (this.panel.visible) {
					this.update();
				} else {
					this.currentRepo = null;
					this.repoFileWatcher.stop();
				}
				this.isPanelVisible = this.panel.visible;
			}
		}, null, this.disposables);

		this.repoFileWatcher = new RepoFileWatcher(() => {
			if (this.panel.visible) {
				this.sendMessage({ command: 'refresh' });
			}
		});
		this.repoManager.registerViewCallback((repos: GitRepoSet, numRepos: number) => {
			if (!this.panel.visible) return;
			if ((numRepos === 0 && this.isGraphViewLoaded) || (numRepos > 0 && !this.isGraphViewLoaded)) {
				this.update();
			} else {
				this.respondLoadRepos(repos);
			}
		});

		this.panel.webview.onDidReceiveMessage(async (msg: RequestMessage) => {
			if (this.dataSource === null) return;
			this.logger.log('Received request from the webview: ' + msg.command);
			this.repoFileWatcher.mute();
			switch (msg.command) {
				case 'applyStash':
					this.sendMessage({
						command: 'applyStash',
						status: await this.dataSource.applyStash(msg.repo, msg.selector, msg.reinstateIndex)
					});
					break;
				case 'branchFromStash':
					this.sendMessage({
						command: 'branchFromStash',
						status: await this.dataSource.branchFromStash(msg.repo, msg.selector, msg.branchName)
					});
					break;
				case 'dropStash':
					this.sendMessage({
						command: 'dropStash',
						status: await this.dataSource.dropStash(msg.repo, msg.selector)
					});
					break;
				case 'popStash':
					this.sendMessage({
						command: 'popStash',
						status: await this.dataSource.popStash(msg.repo, msg.selector, msg.reinstateIndex)
					});
					break;
				case 'pushStash':
					this.sendMessage({
						command: 'pushStash',
						status: await this.dataSource.pushStash(msg.repo, msg.message, msg.includeUntracked)
					});
					break;
				case 'addTag':
					this.sendMessage({
						command: 'addTag',
						status: await this.dataSource.addTag(msg.repo, msg.tagName, msg.commitHash, msg.lightweight, msg.message)
					});
					break;
				case 'fetchAvatar':
					this.avatarManager.fetchAvatarImage(msg.email, msg.repo, msg.commits);
					break;
				case 'fetchCiStatus': {
					const ciStatus = getConfig().ciStatus();
					if (ciStatus.enabled && this.isKnownRepo(msg.repo) && Array.isArray(msg.commits)) this.ciStatusManager.fetchStatuses(msg.repo, msg.commits.filter((hash) => typeof hash === 'string'), ciStatus.maxCommits, ciStatus.hosts);
					break;
				}
				case 'checkoutBranch':
					this.sendMessage({
						command: 'checkoutBranch',
						status: await this.dataSource.checkoutBranch(msg.repo, msg.branchName, msg.remoteBranch)
					});
					break;
				case 'checkoutCommit':
					this.sendMessage({
						command: 'checkoutCommit',
						status: await this.dataSource.checkoutCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'cherrypickCommit':
					this.sendMessage({
						command: 'cherrypickCommit',
						status: await this.dataSource.cherrypickCommit(msg.repo, msg.commitHash, { parentIndex: msg.parentIndex, recordOrigin: msg.recordOrigin, noCommit: msg.noCommit })
					});
					break;
				case 'cleanUntrackedFiles':
					this.sendMessage({
						command: 'cleanUntrackedFiles',
						status: await this.dataSource.cleanUntrackedFiles(msg.repo, msg.directories)
					});
					break;
				case 'compareCommits':
					this.sendMessage({
						command: 'compareCommits',
						fromHash: msg.fromHash,
						toHash: msg.toHash,
						fileChanges: await this.dataSource.compareCommits(msg.repo, msg.fromHash, msg.toHash)
					});
					break;
				case 'commitDetails':
					this.sendMessage({
						command: 'commitDetails',
						commitDetails: await this.dataSource.commitDetails(msg.repo, msg.commitHash)
					});
					break;
				case 'copyToClipboard':
					this.sendMessage({
						command: 'copyToClipboard',
						type: msg.type,
						success: await copyToClipboard(msg.data)
					});
					break;
				case 'createBranch':
					this.sendMessage({
						command: 'createBranch',
						status: await this.dataSource.createBranch(msg.repo, msg.branchName, msg.commitHash, msg.checkout)
					});
					break;
				case 'deleteBranch':
					this.sendMessage({
						command: 'deleteBranch',
						status: await this.dataSource.deleteBranch(msg.repo, msg.branchName, msg.forceDelete)
					});
					break;
				case 'deleteRemoteBranch':
					this.sendMessage({
						command: 'deleteRemoteBranch',
						status: await this.dataSource.deleteRemoteBranch(msg.repo, msg.branchName, msg.remote)
					});
					break;
				case 'deleteTag':
					this.sendMessage({
						command: 'deleteTag',
						status: await this.dataSource.deleteTag(msg.repo, msg.tagName)
					});
					break;
				case 'dropCommit':
					this.sendMessage({
						command: 'dropCommit',
						status: await this.dataSource.dropCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'fetch':
					this.sendMessage({
						command: 'fetch',
						status: await this.dataSource.fetch(msg.repo, msg.remote, msg.prune, msg.pruneTags)
					});
					break;
				case 'fetchIntoLocalBranch':
					this.sendMessage({
						command: 'fetchIntoLocalBranch',
						status: await this.dataSource.fetchIntoLocalBranch(msg.repo, msg.remote, msg.remoteBranch, msg.localBranch, msg.force)
					});
					break;
				case 'loadBranches':
					this.offerRepoSettingsFile(msg.repo);
					let branchData = await this.dataSource.getBranches(msg.repo, msg.showRemoteBranches, this.getRepoState(msg.repo).hideRemotes), isRepo = true;
					if (branchData.error) {
						// If an error occurred, check to make sure the repo still exists
						isRepo = await this.dataSource.isGitRepository(msg.repo);
					}
					this.sendMessage({
						command: 'loadBranches',
						branches: branchData.branches,
						head: branchData.head,
						remotes: isRepo ? await this.dataSource.getRemotes(msg.repo) : [],
						hard: msg.hard,
						isRepo: isRepo
					});
					if (msg.repo !== this.currentRepo) {
						this.currentRepo = msg.repo;
						this.extensionState.setLastActiveRepo(msg.repo);
						this.repoFileWatcher.start(msg.repo);
					}
					break;
				case 'loadCommits':
					this.sendMessage({
						command: 'loadCommits',
						... await this.dataSource.getCommits(msg.repo, msg.branches, msg.maxCommits, msg.showRemoteBranches, this.getRepoState(msg.repo), msg.filters || { authors: [], paths: [] }),
						hard: msg.hard
					});
					break;
				case 'loadRepos':
					if (!msg.check || !await this.repoManager.checkReposExist()) {
						// If not required to check repos, or no changes were found when checking, respond with repos
						this.respondLoadRepos(this.repoManager.getRepos());
					}
					break;
				case 'mergeBranch':
					this.sendMessage({
						command: 'mergeBranch',
						status: await this.dataSource.mergeBranch(msg.repo, msg.branchName, { createNewCommit: msg.createNewCommit, squash: msg.squash, noCommit: msg.noCommit })
					});
					break;
				case 'mergeCommit':
					this.sendMessage({
						command: 'mergeCommit',
						status: await this.dataSource.mergeCommit(msg.repo, msg.commitHash, { createNewCommit: msg.createNewCommit, squash: msg.squash, noCommit: msg.noCommit })
					});
					break;
				case 'pullBranch':
					this.sendMessage({
						command: 'pullBranch',
						status: await this.dataSource.pullBranch(msg.repo, msg.branchName, msg.remote, msg.createNewCommit, msg.squash)
					});
					break;
				case 'pushBranch':
					this.sendMessage({
						command: 'pushBranch',
						status: await this.dataSource.pushBranchToRemotes(msg.repo, msg.branchName, msg.remotes, msg.setUpstream, msg.mode)
					});
					break;
				case 'getRepoSettings':
					this.sendMessage({
						command: 'getRepoSettings',
						settings: await this.dataSource.getRepoSettings(msg.repo)
					});
					break;
				case 'addRemote':
					this.ciStatusManager.forgetRepo(msg.repo);
					this.sendMessage({
						command: 'addRemote',
						status: await this.dataSource.addRemote(msg.repo, msg.name, msg.url, msg.pushUrl, msg.fetch)
					});
					break;
				case 'editRemote':
					this.ciStatusManager.forgetRepo(msg.repo);
					this.sendMessage({
						command: 'editRemote',
						status: await this.dataSource.editRemote(msg.repo, msg.nameOld, msg.nameNew, msg.url, msg.pushUrl)
					});
					break;
				case 'deleteRemote':
					this.ciStatusManager.forgetRepo(msg.repo);
					this.sendMessage({
						command: 'deleteRemote',
						status: await this.dataSource.deleteRemote(msg.repo, msg.name)
					});
					break;
				case 'pruneRemote':
					this.sendMessage({
						command: 'pruneRemote',
						status: await this.dataSource.pruneRemote(msg.repo, msg.name)
					});
					break;
				case 'setUserDetails':
					this.sendMessage({
						command: 'setUserDetails',
						status: await this.dataSource.setUserDetails(msg.repo, msg.name, msg.email, msg.useGlobally)
					});
					break;
				case 'createPullRequest':
					this.sendMessage({
						command: 'createPullRequest',
						error: await this.createPullRequest(msg.repo, msg.provider, msg.sourceRemote, msg.sourceBranch, msg.destinationRemote, msg.destinationBranch)
					});
					break;
				case 'startCodeReview':
					if (!this.isKnownRepo(msg.repo)) break;
					this.sendMessage({
						command: 'codeReviewsChanged',
						repo: msg.repo,
						reviews: this.extensionState.saveCodeReview(msg.repo, { id: msg.id, lastActive: Date.now(), lastViewedFile: msg.lastViewedFile, remainingFiles: msg.files })
					});
					break;
				case 'endCodeReview':
					if (!this.isKnownRepo(msg.repo)) break;
					this.sendMessage({
						command: 'codeReviewsChanged',
						repo: msg.repo,
						reviews: this.extensionState.removeCodeReview(msg.repo, msg.id)
					});
					break;
				case 'updateCodeReview':
					if (this.isKnownRepo(msg.repo)) this.extensionState.saveCodeReview(msg.repo, msg.review);
					break;
				case 'getCommitMessage':
					this.sendMessage({
						command: 'getCommitMessage',
						commitHash: msg.commitHash,
						purpose: msg.purpose,
						message: await this.dataSource.getCommitMessage(msg.repo, msg.commitHash),
						pushed: await this.dataSource.isHeadPushed(msg.repo)
					});
					break;
				case 'rewordCommit':
					this.sendMessage({
						command: 'rewordCommit',
						status: await this.dataSource.rewordCommit(msg.repo, msg.commitHash, msg.message)
					});
					break;
				case 'amendCommit':
					this.sendMessage({
						command: 'amendCommit',
						status: await this.dataSource.amendCommit(msg.repo, msg.commitHash, msg.message, msg.stageTracked)
					});
					break;
				case 'bisect': {
					const result = await this.dataSource.bisect(msg.repo, msg.action, msg.commitHash);
					this.sendMessage({ command: 'bisect', status: result.status, message: result.message });
					break;
				}
				case 'addWorktree':
					this.sendMessage({
						command: 'addWorktree',
						status: await this.addWorktree(msg.repo, msg.ref, msg.newBranch)
					});
					break;
				case 'removeWorktree': {
					const worktree = await this.resolveWorktree(msg.repo, msg.path);
					this.sendMessage({
						command: 'removeWorktree',
						status: worktree !== null ? await this.dataSource.removeWorktree(msg.repo, worktree, msg.force) : 'The folder is not a worktree of this repository.'
					});
					break;
				}
				case 'pruneWorktrees':
					this.sendMessage({
						command: 'pruneWorktrees',
						status: await this.dataSource.pruneWorktrees(msg.repo)
					});
					break;
				case 'openWorktree': {
					const worktree = await this.resolveWorktree(msg.repo, msg.path);
					this.sendMessage({
						command: 'openWorktree',
						status: worktree !== null ? await this.openWorktree(worktree, msg.newWindow) : 'The folder is not a worktree of this repository.'
					});
					break;
				}
				case 'operationAction':
					this.sendMessage({
						command: 'operationAction',
						status: await this.dataSource.operationAction(msg.repo, msg.type, msg.action)
					});
					break;
				case 'openExternalUrl':
					this.sendMessage({
						command: 'openExternalUrl',
						success: await openExternalUrl(msg.url, this.logger)
					});
					break;
				case 'openExtensionSettings':
					vscode.commands.executeCommand('workbench.action.openSettings', '@ext:erancihan.vscode-git-graph');
					break;
				case 'archive':
					this.sendMessage({
						command: 'archive',
						status: await this.archive(msg.repo, msg.ref)
					});
					break;
				case 'openExternalDiff':
					this.sendMessage({
						command: 'openExternalDiff',
						status: await this.dataSource.openExternalDiff(msg.repo, msg.fromHash, msg.toHash, msg.filePath)
					});
					break;
				case 'openFile':
					this.sendMessage({
						command: 'openFile',
						success: await openFile(msg.repo, msg.filePath)
					});
					break;
				case 'pushTag':
					this.sendMessage({
						command: 'pushTag',
						status: await this.dataSource.pushTag(msg.repo, msg.tagName)
					});
					break;
				case 'rebase':
					this.sendMessage({
						command: 'rebase',
						status: msg.interactive
							? this.launchInteractiveRebase(msg.repo, msg.obj, msg.type)
							: await this.dataSource.rebase(msg.repo, msg.obj, msg.type, msg.ignoreDate)
					});
					break;
				case 'predictConflicts':
					this.sendMessage({
						command: 'predictConflicts',
						id: msg.id,
						conflicts: await this.dataSource.predictConflicts(msg.repo, msg.obj, msg.type)
					});
					break;
				case 'exportRepoSettings':
					this.sendMessage({
						command: 'exportRepoSettings',
						status: await this.exportRepoSettings(msg.repo)
					});
					break;
				case 'importRepoSettings':
					this.sendMessage({
						command: 'importRepoSettings',
						status: await this.importRepoSettings(msg.repo, true)
					});
					break;
				case 'getRebaseTodo': {
					const result = await this.dataSource.getRebaseTodo(msg.repo, msg.baseHash);
					this.sendMessage({
						command: 'getRebaseTodo',
						baseHash: msg.baseHash,
						headHash: result.headHash,
						todo: result.todo,
						error: result.error,
						pushed: result.todo !== null ? await this.dataSource.isHeadPushed(msg.repo) : false
					});
					break;
				}
				case 'interactiveRebase':
					this.sendMessage({
						command: 'interactiveRebase',
						status: await this.dataSource.interactiveRebase(msg.repo, msg.baseHash, msg.headHash, msg.todo)
					});
					break;
				case 'fixupCommit':
					this.sendMessage({
						command: 'fixupCommit',
						status: await this.dataSource.fixupCommit(msg.repo, msg.commitHash)
					});
					break;
				case 'renameBranch':
					this.sendMessage({
						command: 'renameBranch',
						status: await this.dataSource.renameBranch(msg.repo, msg.oldName, msg.newName)
					});
					break;
				case 'resetToCommit':
					this.sendMessage({
						command: 'resetToCommit',
						status: await this.dataSource.resetToCommit(msg.repo, msg.commitHash, msg.resetMode)
					});
					break;
				case 'resetUncommittedChanges':
					this.sendMessage({
						command: 'resetUncommittedChanges',
						status: await this.dataSource.resetUncommittedChanges(msg.repo, msg.mode)
					});
					break;
				case 'revertCommit':
					this.sendMessage({
						command: 'revertCommit',
						status: await this.dataSource.revertCommit(msg.repo, msg.commitHash, msg.parentIndex)
					});
					break;
				case 'saveRepoState':
					this.repoManager.setRepoState(msg.repo, msg.state);
					break;
				case 'viewDiff':
					this.sendMessage({
						command: 'viewDiff',
						success: await viewDiff(msg.repo, msg.fromHash, msg.toHash, msg.oldFilePath, msg.newFilePath, msg.type)
					});
					break;
				case 'viewDiffWithWorkingFile':
					this.sendMessage({
						command: 'viewDiffWithWorkingFile',
						success: await viewDiffWithWorkingFile(msg.repo, msg.commitHash, msg.filePath)
					});
					break;
				case 'viewFileAtRevision':
					this.sendMessage({
						command: 'viewFileAtRevision',
						success: await viewFileAtRevision(msg.repo, msg.commitHash, msg.filePath)
					});
					break;
			}
			this.repoFileWatcher.unmute();
		}, null, this.disposables);
	}

	public sendMessage(msg: ResponseMessage) {
		this.panel.webview.postMessage(msg);
	}

	public dispose() {
		GitGraphView.currentPanel = undefined;
		this.logger.log('Git Graph View closed');
		this.panel.dispose();
		this.avatarManager.deregisterView();
		this.ciStatusManager.deregisterView();
		this.repoFileWatcher.stop();
		this.repoManager.deregisterViewCallback();
		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) x.dispose();
		}
	}

	private async update() {
		this.panel.webview.html = await this.getHtmlForWebview();
	}

	/**
	 * Starts `git rebase --interactive` in a new integrated terminal, because the editor for the
	 * todo list needs a terminal. Returns an error message, or null when the terminal was opened.
	 */
	private launchInteractiveRebase(repo: string, obj: string, type: GitRebaseType): string | null {
		if (type === 'Commit' ? !isCommitHash(obj) : !isSafeRefName(obj)) return 'Invalid rebase target.';
		return runGitCommandInTerminal(repo, this.dataSource.getGitPath(), ['rebase', '--interactive', obj], 'Git Graph: Interactive Rebase', this.logger);
	}

	/** Ask where to save an archive of `ref`, then write it. Cancelling the save dialog is not an error. */
	private async archive(repo: string, ref: string): Promise<GitCommandStatus> {
		const safeName = ref.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'archive';
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(path.join(repo, safeName + '.zip')),
			saveLabel: vscode.l10n.t('Create Archive'),
			filters: { 'ZIP Archive': ['zip'], 'TAR Archive': ['tar'] }
		});
		if (!uri) return null;
		const outputPath = uri.fsPath, type: GitArchiveType = outputPath.toLowerCase().endsWith('.tar') ? 'tar' : 'zip';
		const status = await this.dataSource.archive(repo, ref, outputPath, type);
		if (status === null) {
			this.logger.log('Created archive of ' + ref + ' at ' + outputPath);
			vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Archive of "{0}" saved to {1}', ref, outputPath));
		}
		return status;
	}

	/** Build the "new pull request" URL from the remotes' URLs and open it in the browser. Returns an error message or null. */
	private async createPullRequest(repo: string, provider: PullRequestProvider | null, sourceRemote: string, sourceBranch: string, destinationRemote: string, destinationBranch: string): Promise<string | null> {
		const remotes = await this.dataSource.getRemoteDetails(repo);
		const source = remotes.find((r) => r.name === sourceRemote), destination = remotes.find((r) => r.name === destinationRemote);
		if (!source || !destination) return 'The selected remote no longer exists.';
		const sourceUrl = parseRemoteUrl(source.pushUrl !== null ? source.pushUrl : source.url), destinationUrl = parseRemoteUrl(destination.url);
		if (sourceUrl === null) return 'The URL of the remote "' + sourceRemote + '" could not be understood.';
		if (destinationUrl === null) return 'The URL of the remote "' + destinationRemote + '" could not be understood.';
		const resolvedProvider = provider !== null ? provider : detectPullRequestProvider(destinationUrl);
		if (resolvedProvider === null) return 'No pull request provider is known for ' + destinationUrl.host + '. Add one with the "git-graph.customPullRequestProviders" setting.';
		const url = buildPullRequestUrl(resolvedProvider, { remote: sourceUrl, branch: sourceBranch }, { remote: destinationUrl, branch: destinationBranch }, getConfig().customPullRequestProviders());
		if (url === null) return 'The pull request URL could not be built for the provider "' + resolvedProvider + '".';
		return await openExternalUrl(url, this.logger) ? null : 'The browser could not be opened.';
	}

	/** Ask for the folder of a new worktree (default: a sibling folder named after the branch), then create it. */
	private async addWorktree(repo: string, ref: string, newBranch: string | null): Promise<GitCommandStatus> {
		const name = (newBranch !== null ? newBranch : ref).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'worktree';
		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(path.join(path.dirname(repo), path.basename(repo) + '-' + name)),
			saveLabel: vscode.l10n.t('Create Worktree'),
			title: vscode.l10n.t('Choose the folder of the new worktree')
		});
		if (!uri) return null;
		const status = await this.dataSource.addWorktree(repo, uri.fsPath, ref, newBranch);
		if (status === null) {
			this.logger.log('Created worktree at ' + uri.fsPath + ' for ' + ref);
			const choice = await vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Worktree created at {0}.', uri.fsPath), vscode.l10n.t('Add to Git Graph'), vscode.l10n.t('Open in New Window'));
			if (choice === 'Add to Git Graph') await this.openWorktree(uri.fsPath, false);
			else if (choice === 'Open in New Window') await this.openWorktree(uri.fsPath, true);
		}
		return status;
	}

	/**
	 * A path from the webview is used only when it is exactly one of the non-main worktrees that git lists
	 * for a known repository; anything else is refused.
	 */
	private async resolveWorktree(repo: string, worktreePath: string): Promise<string | null> {
		if (!this.isKnownRepo(repo) || typeof worktreePath !== 'string') return null;
		const match = (await this.dataSource.getWorktrees(repo)).find((worktree) => !worktree.isMain && worktree.path === worktreePath);
		return match ? match.path : null;
	}

	/** Register a worktree as a repository of this workspace, or open it in a new editor window. */
	private async openWorktree(worktreePath: string, newWindow: boolean): Promise<GitCommandStatus> {
		if (newWindow) {
			await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktreePath), true);
			return null;
		}
		const error = await this.repoManager.registerRepo(worktreePath);
		return error !== null && error.indexOf('already known') === -1 ? error : null;
	}

	/** Tell the open view that every code review was ended (command "End All Code Reviews in Workspace"). */
	public static notifyCodeReviewsEnded() {
		if (GitGraphView.currentPanel) {
			GitGraphView.currentPanel.sendMessage({ command: 'codeReviewsChanged', repo: '*', reviews: {} });
		}
	}

	/** Only repositories the extension discovered or the user added may carry state. */
	private isKnownRepo(repo: string) {
		return typeof repo === 'string' && Object.prototype.hasOwnProperty.call(this.repoManager.getRepos(), repo);
	}

	/** The stored state of a repository (defaults when the repository is unknown). */
	private getRepoState(repo: string): GitRepoState {
		const repos = this.repoManager.getRepos();
		return typeof repos[repo] !== 'undefined' ? repos[repo] : defaultRepoState();
	}

	private getHtmlForWebview() {
		const config = getConfig(), nonce = getNonce();
		const viewState: GitGraphViewState = {
			l10n: vscode.l10n.bundle !== undefined ? <L10nBundle>vscode.l10n.bundle : null,
			autoCenterCommitDetailsView: config.autoCenterCommitDetailsView(),
			codeReviews: this.extensionState.getCodeReviews(),
			commitDetailsView: config.commitDetailsView(),
			customBranchGlobPatterns: config.customBranchGlobPatterns(),
			customPullRequestProviders: config.customPullRequestProviders(),
			contextMenuActionsVisibility: config.contextMenuActionsVisibility(),
			dateFormat: config.dateFormat(),
			defaultColumnVisibility: config.defaultColumnVisibility(),
			dialogDefaults: config.dialogDefaults(),
			fetchAndPrune: config.fetchAndPrune(),
			fetchAndPruneTags: config.fetchAndPruneTags(),
			fetchAvatars: config.fetchAvatars() && this.extensionState.isAvatarStorageAvailable(),
			ciStatus: config.ciStatus(),
			graphColours: config.graphColours(),
			graphStyle: config.graphStyle(),
			initialLoadCommits: config.initialLoadCommits(),
			keyboardShortcuts: config.keyboardShortcuts(),
			lastActiveRepo: this.extensionState.getLastActiveRepo(),
			loadMoreCommits: config.loadMoreCommits(),
			loadMoreCommitsAutomatically: config.loadMoreCommitsAutomatically(),
			muteCommitsThatAreNotAncestorsOfHead: config.muteCommitsThatAreNotAncestorsOfHead(),
			muteMergeCommits: config.muteMergeCommits(),
			referenceLabels: config.referenceLabels(),
			repos: this.repoManager.getRepos(),
			scrollToHeadOnLoad: config.scrollToHeadOnLoad(),
			showCurrentBranchByDefault: config.showCurrentBranchByDefault(),
			showRemoteBranches: config.showRemoteBranches(),
			stickyHeader: config.stickyHeader()
		};

		let body, numRepos = Object.keys(viewState.repos).length, colorVars = '', colorParams = '';
		for (let i = 0; i < viewState.graphColours.length; i++) {
			colorVars += '--git-graph-color' + i + ':' + viewState.graphColours[i] + '; ';
			colorParams += '[data-color="' + i + '"]{--git-graph-color:var(--git-graph-color' + i + ');} ';
		}
		if (numRepos > 0) {
			body = `<body style="${colorVars}">
			<div id="controls">
				<span id="repoControl"><span class="unselectable">${vscode.l10n.t('Repo: ')}</span><div id="repoSelect" class="dropdown"></div></span>
				<span id="branchControl"><span class="unselectable">${vscode.l10n.t('Branch: ')}</span><div id="branchSelect" class="dropdown"></div></span>
				<label id="showRemoteBranchesControl"><input type="checkbox" id="showRemoteBranchesCheckbox" value="1"${viewState.showRemoteBranches ? ' checked' : ''}>${vscode.l10n.t('Show Remote Branches')}</label>
				<div id="fetchBtn" class="roundedBtn" style="display:none" title="${vscode.l10n.t('Fetch from Remote(s)')}">${vscode.l10n.t('Fetch')}</div>
				<div id="refreshBtn" class="roundedBtn">${vscode.l10n.t('Refresh')}</div>
				<div id="filterBtn" class="roundedBtn" title="${vscode.l10n.t('Filter commits by author or path')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M1 2h12l-4.5 6v5l-3 1.5V8L1 2z"/></svg></div>
				<div id="settingsBtn" class="roundedBtn" title="${vscode.l10n.t('Repository Settings')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="16" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M14 8.77v-1.6l-1.94-.64-.45-1.09.88-1.84-1.13-1.13-1.81.91-1.09-.45-.69-1.92h-1.6l-.63 1.94-1.11.45-1.84-.88-1.13 1.13.91 1.81-.45 1.09L0 7.23v1.59l1.94.64.45 1.09-.88 1.84 1.13 1.13 1.81-.91 1.09.45.69 1.92h1.59l.63-1.94 1.11-.45 1.84.88 1.13-1.13-.92-1.81.47-1.09L14 8.75v.02zM7 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg></div>
			</div>
			<div id="filterBar"></div>
			<div id="bisectBar"></div>
			<div id="operationBar"></div>
			<div id="content">
				<div id="commitGraph"></div>
				<div id="commitTable"></div>
			</div>
			<div id="footer"></div>
			<ul id="contextMenu"></ul>
			<div id="dialogBacking"></div>
			<div id="dialog"></div>
			<div id="scrollShadow"></div>
			<script nonce="${nonce}">var viewState = ${serializeForScript(viewState)};</script>
			<script nonce="${nonce}" src="${this.getMediaUri('out.min.js')}"></script>
			</body>`;
		} else {
			body = `<body class="unableToLoad" style="${colorVars}">
			<h2>Unable to load Git Graph</h2>
			<p>Either the current workspace does not contain a Git repository, or the Git executable could not be found.</p>
			<p>If you are using a portable Git installation, make sure you have set the Visual Studio Code Setting "git.path" to the path of your portable installation (e.g. "C:\\Program Files\\Git\\bin\\git.exe" on Windows).</p>
			<p>The "Git Graph" Output Channel (View &gt; Output) records the git commands that were run and any errors.</p>
			</body>`;
		}
		this.isGraphViewLoaded = numRepos > 0;

		return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('main.css')}">
				<link rel="stylesheet" type="text/css" href="${this.getMediaUri('dropdown.css')}">
				<title>Git Graph</title>
				<style>${colorParams}</style>
			</head>
			${body}
		</html>`;
	}

	private getMediaUri(file: string) {
		return this.panel.webview.asWebviewUri(this.getUri('media', file));
	}

	private getUri(...pathComps: string[]) {
		return vscode.Uri.file(path.join(this.extensionPath, ...pathComps));
	}

	/* Repository settings file (.vscode/git-graph.json) */

	private repoSettingsOffered: { [repo: string]: string } = {};

	/** Read the settings file of a repository, or null when it does not exist or cannot be read. */
	private readRepoSettingsFile(repo: string): Promise<string | null> {
		const file = repoSettingsFilePath(repo);
		if (file === null) return Promise.resolve(null); // a symbolic link in the way: never follow it
		return new Promise((resolve) => {
			fs.readFile(file, { encoding: 'utf8' }, (err, data) => resolve(err ? null : data));
		});
	}

	/**
	 * When the repository has a settings file whose content was not applied, exported or declined
	 * before, offer to apply it. Each version of the file is offered once per session.
	 */
	private async offerRepoSettingsFile(repo: string) {
		if (!this.isKnownRepo(repo)) return;
		const text = await this.readRepoSettingsFile(repo);
		if (text === null) return;
		const hash = hashRepoSettings(text), state = this.getRepoState(repo);
		if (state.settingsFileHash === hash || this.repoSettingsOffered[repo] === hash) return;
		this.repoSettingsOffered[repo] = hash;
		const imported = parseRepoSettings(text);
		if (imported === null) {
			this.logger.logError('The repository settings file ' + path.join(repo, REPO_SETTINGS_FILE) + ' is not a valid JSON object.');
			return;
		}
		if (repoSettingsMatch(state, imported)) {
			this.repoManager.setRepoState(repo, { ...state, settingsFileHash: hash });
			return;
		}
		const name = state.name !== null ? state.name : path.basename(repo);
		const apply = vscode.l10n.t('Apply'), ignore = vscode.l10n.t('Ignore this version');
		const choice = await vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: The repository "{0}" contains {1} with shared Git Graph settings ({2}). Apply them to this repository?', name, REPO_SETTINGS_FILE, describeRepoSettings(imported)), apply, ignore);
		if (choice === apply) {
			await this.importRepoSettings(repo, false);
		} else if (choice === ignore) {
			this.repoManager.setRepoState(repo, { ...this.getRepoState(repo), settingsFileHash: hash });
		}
	}

	/** Apply the settings file to the repository state and refresh the view. */
	private async importRepoSettings(repo: string, fromWidget: boolean): Promise<GitCommandStatus> {
		if (!this.isKnownRepo(repo)) return 'Unknown repository.';
		const text = await this.readRepoSettingsFile(repo);
		if (text === null) return vscode.l10n.t('The repository has no {0} file.', REPO_SETTINGS_FILE);
		const imported = parseRepoSettings(text);
		if (imported === null) return vscode.l10n.t('{0} is not a valid JSON object.', REPO_SETTINGS_FILE);
		this.repoManager.setRepoState(repo, { ...applyRepoSettings(this.getRepoState(repo), imported), settingsFileHash: hashRepoSettings(text) });
		this.respondLoadRepos(this.repoManager.getRepos());
		if (!fromWidget) vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Repository settings applied from {0}.', REPO_SETTINGS_FILE));
		return null;
	}

	/** Write the shareable settings of the repository to the settings file, asking before an existing file is replaced. */
	private async exportRepoSettings(repo: string): Promise<GitCommandStatus> {
		if (!this.isKnownRepo(repo)) return 'Unknown repository.';
		const text = serializeRepoSettings(this.getRepoState(repo)), target = repoSettingsFilePath(repo);
		if (target === null) return vscode.l10n.t('{0} or its folder is a symbolic link or not a regular file; the export is refused.', REPO_SETTINGS_FILE);
		const existing = await this.readRepoSettingsFile(repo);
		if (existing !== null && existing !== text) {
			const replace = vscode.l10n.t('Replace');
			const choice = await vscode.window.showWarningMessage(vscode.l10n.t('Git Graph: {0} already exists in this repository. Replace it with the current settings?', REPO_SETTINGS_FILE), replace);
			if (choice !== replace) return vscode.l10n.t('The export was cancelled; the existing file was kept.');
		}
		try {
			writeRepoSettingsFile(target, text);
		} catch (e) {
			return vscode.l10n.t('Unable to write {0}: {1}', REPO_SETTINGS_FILE, e instanceof Error ? e.message : String(e));
		}
		this.repoManager.setRepoState(repo, { ...this.getRepoState(repo), settingsFileHash: hashRepoSettings(text) });
		vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Repository settings exported to {0}. Commit the file to share them.', target));
		return null;
	}

	private respondLoadRepos(repos: GitRepoSet) {
		this.sendMessage({
			command: 'loadRepos',
			repos: repos,
			lastActiveRepo: this.extensionState.getLastActiveRepo()
		});
	}

}

/* File actions */

/**
 * Open the Visual Studio Code diff of a file between two revisions. `fromHash` may be "<hash>^" (the
 * parent of a commit) and `toHash` may be "*" (the working tree).
 */
function viewDiff(repo: string, fromHash: string, toHash: string, oldFilePath: string, newFilePath: string, type: GitFileChangeType) {
	const toLabel = toHash === '*' ? 'Working Tree' : abbrevCommit(toHash);
	const isParentDiff = fromHash === toHash + '^';
	const title = fileName(newFilePath) + ' (' + (isParentDiff && type === 'A' ? 'Added in ' + toLabel : isParentDiff && type === 'D' ? 'Deleted in ' + toLabel : (isParentDiff ? toLabel + '^' : abbrevCommit(fromHash)) + ' ↔ ' + toLabel) + ')';
	const rightUri = toHash === '*' && type !== 'D' ? vscode.Uri.file(path.join(repo, newFilePath)) : encodeDiffDocUri(repo, newFilePath, toHash);
	return runToBoolean(vscode.commands.executeCommand('vscode.diff', encodeDiffDocUri(repo, oldFilePath, fromHash), rightUri, title, { preview: true }));
}

/** Open the Visual Studio Code diff between a file at a commit and the file in the working tree. */
function viewDiffWithWorkingFile(repo: string, commitHash: string, filePath: string) {
	const title = fileName(filePath) + ' (' + abbrevCommit(commitHash) + ' ↔ Working File)';
	return runToBoolean(vscode.commands.executeCommand('vscode.diff', encodeDiffDocUri(repo, filePath, commitHash), vscode.Uri.file(path.join(repo, filePath)), title, { preview: true }));
}

/** Open the content of a file as it was at a commit, read-only. */
function viewFileAtRevision(repo: string, commitHash: string, filePath: string) {
	return runToBoolean(vscode.window.showTextDocument(encodeDiffDocUri(repo, filePath, commitHash), { preview: true }));
}

/** Open the file from the working tree. */
function openFile(repo: string, filePath: string) {
	return runToBoolean(vscode.window.showTextDocument(vscode.Uri.file(path.join(repo, filePath)), { preview: true }));
}

/**
 * JSON for an inline <script>: "<", ">" and the line terminators U+2028 / U+2029 are escaped so that
 * repository data (paths, names, messages) can never close the script element or break the parser.
 */
export function serializeForScript(value: unknown) {
	return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Open an http(s) URL in the browser. Other schemes are refused. */
function openExternalUrl(url: string, logger: Logger) {
	if (!/^https?:\/\/[^\s]+$/i.test(url)) {
		logger.logError('Refused to open a URL that is not http(s): ' + url);
		return Promise.resolve(false);
	}
	logger.log('Opening in the browser: ' + url);
	return runToBoolean(vscode.env.openExternal(vscode.Uri.parse(url)));
}

function fileName(filePath: string) {
	const pathComponents = filePath.split('/');
	return pathComponents[pathComponents.length - 1];
}

function runToBoolean(thenable: Thenable<unknown>) {
	return new Promise<boolean>((resolve) => {
		thenable.then(() => resolve(true), () => resolve(false));
	});
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}