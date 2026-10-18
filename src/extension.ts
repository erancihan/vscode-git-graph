import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AskpassManager } from './askpassManager';
import { AvatarManager } from './avatarManager';
import { CiStatusManager } from './ciStatus';
import { getConfig } from './config';
import { DataSource } from './dataSource';
import { DiffDocProvider, decodeDiffDocUri } from './diffDocProvider';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { Logger } from './logger';
import { RepoManager } from './repoManager';
import { StatusBarItem } from './statusBarItem';
import { copyToClipboard, getPathFromUri } from './utils';

export function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	logger.log('Starting Git Graph ...');

	const extensionState = new ExtensionState(context);
	extensionState.pruneCodeReviews();
	const dataSource = new DataSource(logger);
	const askpass = new AskpassManager(context.extensionPath, (prompt, isPassword) => {
		return Promise.resolve(vscode.window.showInputBox({ prompt: vscode.l10n.t('Git Graph: {0}', prompt), password: isPassword, ignoreFocusOut: true })).then((value) => typeof value === 'string' ? value : null);
	}, logger);
	dataSource.setEnvironmentProvider(() => getConfig().integratedAskpass() ? askpass.getEnvironment() : {});
	dataSource.setExtensionPath(context.extensionPath);
	if (getConfig().integratedAskpass()) askpass.start();
	const avatarManager = new AvatarManager(dataSource, extensionState, logger);
	const ciStatusManager = new CiStatusManager(dataSource, context.secrets, logger);
	const statusBarItem = new StatusBarItem(context);
	const repoManager = new RepoManager(dataSource, extensionState, statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-graph.view', () => {
			let loadRepo: string | null = null;
			if (getConfig().openToTheRepoOfTheActiveTextEditorDocument() && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file') {
				loadRepo = repoManager.getRepoContainingFile(getPathFromUri(vscode.window.activeTextEditor.document.uri));
			}
			GitGraphView.createOrShow(context.extensionPath, dataSource, extensionState, avatarManager, ciStatusManager, repoManager, logger, loadRepo);
		}),
		vscode.commands.registerCommand('git-graph.addGitRepository', async () => {
			const uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: vscode.l10n.t('Add Repository'), title: vscode.l10n.t('Select a Git repository to add to Git Graph') });
			if (!uris || uris.length === 0) return;
			const path = getPathFromUri(uris[0]);
			const error = await repoManager.registerRepo(path);
			if (error === null) {
				logger.log('Added repository: ' + path);
				vscode.window.showInformationMessage(vscode.l10n.t('The repository "{0}" was added to Git Graph.', path));
			} else {
				vscode.window.showErrorMessage(error);
			}
		}),
		vscode.commands.registerCommand('git-graph.removeGitRepository', async () => {
			const repos = Object.keys(repoManager.getRepos());
			if (repos.length === 0) {
				vscode.window.showInformationMessage(vscode.l10n.t('Git Graph does not know any repository in this workspace.'));
				return;
			}
			const picked = await vscode.window.showQuickPick(repos.map((path) => ({ label: path.substring(path.lastIndexOf('/') + 1), description: path, path: path })), { placeHolder: vscode.l10n.t('Select the repository to remove from Git Graph') });
			if (!picked) return;
			repoManager.ignoreRepo(picked.path);
			logger.log('Removed repository: ' + picked.path);
			vscode.window.showInformationMessage(vscode.l10n.t('The repository "{0}" was removed from Git Graph. Use "Git Graph: Add Git Repository..." to add it again.', picked.path));
		}),
		vscode.commands.registerCommand('git-graph.clearAvatarCache', () => {
			const count = avatarManager.clearCache();
			vscode.window.showInformationMessage(count === 1 ? vscode.l10n.t('Git Graph: The avatar cache was cleared (1 avatar removed).') : vscode.l10n.t('Git Graph: The avatar cache was cleared ({0} avatars removed).', count));
		}),
		vscode.commands.registerCommand('git-graph.endAllWorkspaceCodeReviews', () => {
			const count = extensionState.endAllCodeReviews();
			GitGraphView.notifyCodeReviewsEnded();
			vscode.window.showInformationMessage(count === 1 ? vscode.l10n.t('Git Graph: Ended 1 code review in this workspace.') : vscode.l10n.t('Git Graph: Ended {0} code reviews in this workspace.', count));
		}),
		vscode.commands.registerCommand('git-graph.fetch', async () => {
			const repo = await pickRepo(repoManager, vscode.l10n.t('Select the repository to fetch'));
			if (repo === null) return;
			const config = getConfig();
			const status = await dataSource.fetch(repo, null, config.fetchAndPrune(), config.fetchAndPruneTags());
			if (status === null) {
				vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Fetched from the remote(s) of "{0}".', repo));
			} else {
				vscode.window.showErrorMessage(vscode.l10n.t('Git Graph: Unable to fetch: {0}', status));
			}
		}),
		vscode.commands.registerCommand('git-graph.version', async () => {
			const extension = vscode.extensions.getExtension('erancihan.vscode-git-graph');
			const info = [
				'Git Graph Community: ' + (extension ? extension.packageJSON.version : 'unknown'),
				'Visual Studio Code: ' + vscode.version,
				'Git: ' + (dataSource.getGitVersion() || 'unknown') + ' (' + dataSource.getGitPath() + ')',
				'OS: ' + os.type() + ' ' + os.release() + ' ' + os.arch()
			];
			logger.log('Version information: ' + info.join('; '));
			const choice = await vscode.window.showInformationMessage(info.join('  |  '), vscode.l10n.t('Copy'));
			if (choice === 'Copy') {
				if (await copyToClipboard(info.join('\n'))) {
					vscode.window.showInformationMessage(vscode.l10n.t('Git Graph: Version information copied to the clipboard.'));
				} else {
					vscode.window.showErrorMessage(vscode.l10n.t('Git Graph: Unable to copy the version information to the clipboard.'));
				}
			}
		}),
		vscode.commands.registerCommand('git-graph.openFile', (uri?: vscode.Uri) => {
			const target = uri || (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.uri : null);
			if (!target || target.scheme !== DiffDocProvider.scheme) {
				vscode.window.showErrorMessage(vscode.l10n.t('Git Graph: This command opens the working file of a file that Git Graph shows at a revision.'));
				return;
			}
			const request = decodeDiffDocUri(target);
			return vscode.window.showTextDocument(vscode.Uri.file(path.join(request.repo, request.filePath)), { preview: true });
		}),
		vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, new DiffDocProvider(dataSource)),
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('git-graph.showStatusBarItem')) {
				statusBarItem.refresh();
			}
			if (e.affectsConfiguration('git-graph.maxDepthOfRepoSearch')) {
				repoManager.maxDepthOfRepoSearchChanged();
			}
			if (e.affectsConfiguration('git.path')) {
				dataSource.registerGitPath();
			}
			if (e.affectsConfiguration('git-graph.integratedAskpass') && getConfig().integratedAskpass()) {
				askpass.start();
			}
		}),
		repoManager,
		askpass,
		dataSource,
		logger
	);
	logger.log('Started Git Graph - Ready to use!');
}

/** The repository a command applies to: the only one, or the one the user picks. */
async function pickRepo(repoManager: RepoManager, placeHolder: string): Promise<string | null> {
	const repos = Object.keys(repoManager.getRepos());
	if (repos.length === 0) {
		vscode.window.showInformationMessage(vscode.l10n.t('Git Graph does not know any repository in this workspace.'));
		return null;
	}
	if (repos.length === 1) return repos[0];
	const picked = await vscode.window.showQuickPick(repos.map((repo) => ({ label: repo.substring(repo.lastIndexOf('/') + 1), description: repo, path: repo })), { placeHolder: placeHolder });
	return picked ? picked.path : null;
}

export function deactivate() { }
