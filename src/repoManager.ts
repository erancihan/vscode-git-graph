import * as fs from 'fs';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { DataSource, isSafeRelativePath } from './dataSource';
import { ExtensionState } from './extensionState';
import { StatusBarItem } from './statusBarItem';
import { GitRepoSet, GitRepoState } from './types';
import { evalPromises, getPathFromUri } from './utils';

export class RepoManager {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly statusBarItem: StatusBarItem;
	private repos: GitRepoSet;
	private maxDepthOfRepoSearch: number;
	private folderWatchers: { [workspace: string]: vscode.FileSystemWatcher } = {};
	private viewCallback: ((repos: GitRepoSet, numRepos: number) => void) | null = null;
	private folderChangeHandler: vscode.Disposable | null;

	private createEventPaths: string[] = [];
	private changeEventPaths: string[] = [];
	private processCreateEventsTimeout: NodeJS.Timeout | null = null;
	private processChangeEventsTimeout: NodeJS.Timeout | null = null;

	constructor(dataSource: DataSource, extensionState: ExtensionState, statusBarItem: StatusBarItem) {
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.statusBarItem = statusBarItem;
		this.repos = extensionState.getRepos();
		for (const repo of Object.keys(this.repos)) this.repos[repo] = normaliseRepoState(this.repos[repo]);
		this.maxDepthOfRepoSearch = getConfig().maxDepthOfRepoSearch();
		this.startupTasks();

		this.folderChangeHandler = vscode.workspace.onDidChangeWorkspaceFolders(async e => {
			if (e.added.length > 0) {
				let path, changes = false;
				for (let i = 0; i < e.added.length; i++) {
					path = getPathFromUri(e.added[i].uri);
					if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
					this.startWatchingFolder(path);
				}
				if (changes) this.sendRepos();
			}
			if (e.removed.length > 0) {
				let changes = false, path;
				for (let i = 0; i < e.removed.length; i++) {
					path = getPathFromUri(e.removed[i].uri);
					if (this.removeReposWithinFolder(path)) changes = true;
					this.stopWatchingFolder(path);
				}
				if (changes) this.sendRepos();
			}
		});
	}

	public dispose() {
		if (this.folderChangeHandler !== null) {
			this.folderChangeHandler.dispose();
			this.folderChangeHandler = null;
		}
		const folders = Object.keys(this.folderWatchers);
		for (let i = 0; i < folders.length; i++) {
			this.stopWatchingFolder(folders[i]);
		}
	}

	public registerViewCallback(viewCallback: (repos: GitRepoSet, numRepos: number) => void) {
		this.viewCallback = viewCallback;
	}

	public deregisterViewCallback() {
		this.viewCallback = null;
	}

	public maxDepthOfRepoSearchChanged() {
		const newDepth = getConfig().maxDepthOfRepoSearch();
		if (newDepth > this.maxDepthOfRepoSearch) {
			this.maxDepthOfRepoSearch = newDepth;
			this.searchWorkspaceForRepos();
		} else {
			this.maxDepthOfRepoSearch = newDepth;
		}
	}

	private async startupTasks() {
		this.removeReposNotInWorkspace();
		if (!await this.checkReposExist()) this.sendRepos();
		await this.searchWorkspaceForRepos();
		this.startWatchingFolders();
	}

	private removeReposNotInWorkspace() {
		let rootsExact = [], rootsFolder = [], workspaceFolders = vscode.workspace.workspaceFolders, repoPaths = Object.keys(this.repos), path;
		const manuallyAdded = this.extensionState.getManuallyAddedRepos();
		if (typeof workspaceFolders !== 'undefined') {
			for (let i = 0; i < workspaceFolders.length; i++) {
				path = getPathFromUri(workspaceFolders[i].uri);
				rootsExact.push(path);
				rootsFolder.push(path + '/');
			}
		}
		for (let i = 0; i < repoPaths.length; i++) {
			if (manuallyAdded.indexOf(repoPaths[i]) > -1) continue;
			if (rootsExact.indexOf(repoPaths[i]) === -1 && !rootsFolder.find(x => repoPaths[i].startsWith(x))) this.removeRepo(repoPaths[i]);
		}
	}

	/* Repo Management */

	/** The known repositories, in the order configured by git-graph.repositoryDropdownOrder. */
	public getRepos() {
		const repoPaths = sortRepoPaths(Object.keys(this.repos), getConfig().repositoryDropdownOrder(), getWorkspaceFolderPaths()), repos: GitRepoSet = {};
		for (let i = 0; i < repoPaths.length; i++) {
			repos[repoPaths[i]] = this.repos[repoPaths[i]];
		}
		return repos;
	}

	/** The known repository that contains `filePath`, or null. The deepest match wins. */
	public getRepoContainingFile(filePath: string) {
		let match: string | null = null;
		const repoPaths = Object.keys(this.repos);
		for (let i = 0; i < repoPaths.length; i++) {
			if ((filePath === repoPaths[i] || filePath.startsWith(repoPaths[i] + '/')) && (match === null || repoPaths[i].length > match.length)) match = repoPaths[i];
		}
		return match;
	}

	/**
	 * Add a repository that the user picked. Resolves to a message for the user, or null on success.
	 * The repository is remembered across sessions even when it is outside the workspace folders.
	 */
	public async registerRepo(path: string): Promise<string | null> {
		if (typeof this.repos[path] !== 'undefined') return 'The repository "' + path + '" is already known to Git Graph.';
		if (!await this.dataSource.isGitRepository(path)) return 'The folder "' + path + '" is not a Git repository.';
		this.extensionState.setIgnoredRepos(this.extensionState.getIgnoredRepos().filter((p) => p !== path));
		const manuallyAdded = this.extensionState.getManuallyAddedRepos();
		if (manuallyAdded.indexOf(path) === -1) this.extensionState.setManuallyAddedRepos(manuallyAdded.concat([path]));
		this.addRepo(path);
		await this.addSubmodulesOf(path);
		this.sendRepos();
		return null;
	}

	/** Remove a repository and make sure that discovery does not add it again. */
	public ignoreRepo(path: string) {
		const ignored = this.extensionState.getIgnoredRepos();
		if (ignored.indexOf(path) === -1) this.extensionState.setIgnoredRepos(ignored.concat([path]));
		this.extensionState.setManuallyAddedRepos(this.extensionState.getManuallyAddedRepos().filter((p) => p !== path));
		if (typeof this.repos[path] !== 'undefined') {
			this.removeRepo(path);
			this.sendRepos();
		}
	}

	private isIgnored(path: string) {
		return this.extensionState.getIgnoredRepos().indexOf(path) > -1;
	}

	/** Register the submodules of a repository (declared in its .gitmodules) as repositories of their own. */
	private async addSubmodulesOf(repo: string) {
		const submodules = await this.dataSource.getSubmodules(repo);
		let changes = false;
		for (let i = 0; i < submodules.length; i++) {
			if (!isSafeRelativePath(submodules[i])) continue; // Defence in depth: never leave the repository
			const path = repo + '/' + submodules[i];
			if (typeof this.repos[path] !== 'undefined' || this.isIgnored(path)) continue;
			if (await this.dataSource.isGitRepository(path)) {
				this.addRepo(path);
				changes = true;
				await this.addSubmodulesOf(path);
			}
		}
		return changes;
	}

	private addRepo(repo: string) {
		this.repos[repo] = defaultRepoState();
		this.extensionState.saveRepos(this.repos);
	}
	private removeRepo(repo: string) {
		delete this.repos[repo];
		this.extensionState.saveRepos(this.repos);
	}
	private removeReposWithinFolder(path: string) {
		let pathFolder = path + '/', repoPaths = Object.keys(this.repos), changes = false;
		for (let i = 0; i < repoPaths.length; i++) {
			if (repoPaths[i] === path || repoPaths[i].startsWith(pathFolder)) {
				this.removeRepo(repoPaths[i]);
				changes = true;
			}
		}
		return changes;
	}
	private isDirectoryWithinRepos(path: string) {
		const repoPaths = Object.keys(this.repos);
		for (let i = 0; i < repoPaths.length; i++) {
			if (path === repoPaths[i] || path.startsWith(repoPaths[i] + '/')) return true;
		}
		return false;
	}
	private sendRepos() {
		const repos = this.getRepos();
		const numRepos = Object.keys(repos).length;
		this.statusBarItem.setNumRepos(numRepos);
		if (this.viewCallback !== null) this.viewCallback(repos, numRepos);
	}
	public checkReposExist() {
		return new Promise<boolean>(resolve => {
			let repoPaths = Object.keys(this.repos), changes = false;
			evalPromises(repoPaths, 3, path => this.dataSource.isGitRepository(path)).then(results => {
				for (let i = 0; i < repoPaths.length; i++) {
					if (!results[i]) {
						this.removeRepo(repoPaths[i]);
						changes = true;
					}
				}
				if (changes) this.sendRepos();
				resolve(changes);
			});
		});
	}
	public setRepoState(repo: string, state: GitRepoState) {
		this.repos[repo] = normaliseRepoState(state);
		this.extensionState.saveRepos(this.repos);
	}

	/* Repo Searching */
	private async searchWorkspaceForRepos() {
		let rootFolders = vscode.workspace.workspaceFolders, changes = false;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				if (await this.searchDirectoryForRepos(getPathFromUri(rootFolders[i].uri), this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		if (changes) this.sendRepos();
	}
	private searchDirectoryForRepos(directory: string, maxDepth: number) { // Returns a promise resolving to a boolean, that indicates if new repositories were found.
		return new Promise<boolean>(resolve => {
			if (this.isDirectoryWithinRepos(directory)) {
				resolve(false);
				return;
			}

			if (this.isIgnored(directory)) {
				resolve(false);
				return;
			}

			this.dataSource.isGitRepository(directory).then(async isRepo => {
				if (isRepo) {
					this.addRepo(directory);
					await this.addSubmodulesOf(directory);
					resolve(true);
				} else if (maxDepth > 0) {
					fs.readdir(directory, async (err, dirContents) => {
						if (err) {
							resolve(false);
						} else {
							const dirs = [];
							for (let i = 0; i < dirContents.length; i++) {
								if (dirContents[i] !== '.git' && await isDirectory(directory + '/' + dirContents[i])) {
									dirs.push(directory + '/' + dirContents[i]);
								}
							}
							resolve((await evalPromises(dirs, 2, dir => this.searchDirectoryForRepos(dir, maxDepth - 1))).indexOf(true) > -1);
						}
					});
				} else {
					resolve(false);
				}
			}).catch(() => resolve(false));
		});
	}

	/* Workspace Folder Watching */
	private startWatchingFolders() {
		const rootFolders = vscode.workspace.workspaceFolders;
		if (typeof rootFolders !== 'undefined') {
			for (let i = 0; i < rootFolders.length; i++) {
				this.startWatchingFolder(getPathFromUri(rootFolders[i].uri));
			}
		}
	}
	private startWatchingFolder(path: string) {
		const watcher = vscode.workspace.createFileSystemWatcher(path + '/**');
		watcher.onDidCreate(uri => this.onWatcherCreate(uri));
		watcher.onDidChange(uri => this.onWatcherChange(uri));
		watcher.onDidDelete(uri => this.onWatcherDelete(uri));
		this.folderWatchers[path] = watcher;
	}
	private stopWatchingFolder(path: string) {
		this.folderWatchers[path].dispose();
		delete this.folderWatchers[path];
	}
	private async onWatcherCreate(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.createEventPaths.indexOf(path) > -1) return;

		this.createEventPaths.push(path);
		if (this.processCreateEventsTimeout !== null) clearTimeout(this.processCreateEventsTimeout);
		this.processCreateEventsTimeout = setTimeout(() => this.processCreateEvents(), 1000);
	}
	private onWatcherChange(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.changeEventPaths.indexOf(path) > -1) return;

		this.changeEventPaths.push(path);
		if (this.processChangeEventsTimeout !== null) clearTimeout(this.processChangeEventsTimeout);
		this.processChangeEventsTimeout = setTimeout(() => this.processChangeEvents(), 1000);
	}
	private onWatcherDelete(uri: vscode.Uri) {
		let path = getPathFromUri(uri);
		if (path.indexOf('/.git/') > -1) return;
		if (path.endsWith('/.git')) path = path.slice(0, -5);
		if (this.removeReposWithinFolder(path)) this.sendRepos();
	}
	private async processCreateEvents() {
		let path, changes = false;
		while (path = this.createEventPaths.shift()) {
			if (await isDirectory(path)) {
				if (await this.searchDirectoryForRepos(path, this.maxDepthOfRepoSearch)) changes = true;
			}
		}
		this.processCreateEventsTimeout = null;
		if (changes) this.sendRepos();
	}
	private async processChangeEvents() {
		let path, changes = false;
		while (path = this.changeEventPaths.shift()) {
			if (!await doesPathExist(path)) {
				if (this.removeReposWithinFolder(path)) changes = true;
			}
		}
		this.processChangeEventsTimeout = null;
		if (changes) this.sendRepos();
	}
}

/** Order repository paths for the dropdown. */
export function sortRepoPaths(repoPaths: string[], order: 'Full Path' | 'Name' | 'Workspace Full Path', workspaceFolders: string[]) {
	const byPath = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
	const name = (p: string) => p.substring(p.lastIndexOf('/') + 1).toLowerCase();
	const workspaceIndex = (p: string) => {
		for (let i = 0; i < workspaceFolders.length; i++) {
			if (p === workspaceFolders[i] || p.startsWith(workspaceFolders[i] + '/')) return i;
		}
		return workspaceFolders.length;
	};
	return repoPaths.slice().sort((a, b) => {
		if (order === 'Name') {
			const n = byPath(name(a), name(b));
			return n !== 0 ? n : byPath(a, b);
		}
		if (order === 'Workspace Full Path') {
			const w = workspaceIndex(a) - workspaceIndex(b);
			if (w !== 0) return w;
		}
		return byPath(a, b);
	});
}

function getWorkspaceFolderPaths() {
	const folders = vscode.workspace.workspaceFolders;
	return typeof folders !== 'undefined' ? folders.map((f) => getPathFromUri(f.uri)) : [];
}

function isDirectory(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, (err, stats) => {
			resolve(err ? false : stats.isDirectory());
		});
	});
}

function doesPathExist(path: string) {
	return new Promise<boolean>(resolve => {
		fs.stat(path, err => resolve(!err));
	});
}
export function defaultRepoState(): GitRepoState {
	return { columnWidths: null, columnVisibility: null, name: null, hideRemotes: [], showTags: null, showStashes: null, includeCommitsMentionedByReflogs: null, onlyFollowFirstParent: null, issueLinkingConfig: null, onLoad: null, settingsFileHash: null };
}

/** Fills the fields that older versions did not store, and drops values of the wrong type. */
export function normaliseRepoState(state: Partial<GitRepoState> | null | undefined): GitRepoState {
	const result = defaultRepoState();
	if (!state || typeof state !== 'object') return result;
	if (Array.isArray(state.columnWidths)) result.columnWidths = state.columnWidths;
	if (state.columnVisibility && typeof state.columnVisibility === 'object') result.columnVisibility = state.columnVisibility;
	if (typeof state.name === 'string' && state.name.trim() !== '') result.name = state.name.trim();
	if (Array.isArray(state.hideRemotes)) result.hideRemotes = state.hideRemotes.filter((remote): remote is string => typeof remote === 'string');
	for (const key of <const>['showTags', 'showStashes', 'includeCommitsMentionedByReflogs', 'onlyFollowFirstParent']) {
		if (typeof state[key] === 'boolean') result[key] = <boolean>state[key];
	}
	const linking = state.issueLinkingConfig;
	if (linking && typeof linking === 'object' && typeof linking.issue === 'string' && typeof linking.url === 'string' && isSafeIssuePattern(linking.issue) && /^https?:\/\//i.test(linking.url) && linking.url.length <= 2048) {
		result.issueLinkingConfig = { issue: linking.issue, url: linking.url };
	}
	if (typeof state.settingsFileHash === 'string' && /^[0-9a-f]{64}$/.test(state.settingsFileHash)) result.settingsFileHash = state.settingsFileHash;
	const onLoad = state.onLoad;
	if (onLoad && typeof onLoad === 'object' && typeof onLoad.showCheckedOutBranch === 'boolean' && Array.isArray(onLoad.showSpecificBranches)) {
		const branches = onLoad.showSpecificBranches.filter((branch): branch is string => typeof branch === 'string' && isSafeBranchSelection(branch)).slice(0, 100);
		if (onLoad.showCheckedOutBranch || branches.length > 0) result.onLoad = { showCheckedOutBranch: onLoad.showCheckedOutBranch, showSpecificBranches: branches };
	}
	return result;
}

/**
 * True when a pattern cannot backtrack catastrophically in the common shapes: no repeating
 * quantifier (`*`, `+`, `{n,}`, `{n,m}` with m above 1) applies to a group that itself contains any
 * quantifier (including `?` and `{n}`) or an alternation at any depth, at most 10 quantifiers in
 * total, and at most 200 characters. Character classes follow the JavaScript rules (`[]` and `[^]`
 * close at once) and escapes are skipped. Malformed input is unsafe.
 */
export function isSafeIssuePattern(pattern: string) {
	if (typeof pattern !== 'string' || pattern.trim() === '' || pattern.length > 200) return false;
	try {
		new RegExp(pattern, 'g');
	} catch (e) {
		return false;
	}
	return starHeightIsSafe(pattern);
}

function starHeightIsSafe(pattern: string) {
	const frames: { quantifier: boolean, alternation: boolean }[] = [{ quantifier: false, alternation: false }];
	let quantifiers = 0;
	// 'repeat' for quantifiers that can match more than once, 'bounded' for ? and {0,1} / {1}, null otherwise
	const quantifierAt = (i: number): 'repeat' | 'bounded' | null => {
		if (pattern[i] === '*' || pattern[i] === '+') return 'repeat';
		if (pattern[i] === '?') return 'bounded';
		if (pattern[i] === '{') {
			const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.substring(i));
			if (match === null) return null;
			const min = parseInt(match[1]), max = match[2] === undefined ? min : match[3] === '' ? Infinity : parseInt(match[3]);
			return max > 1 ? 'repeat' : 'bounded';
		}
		return null;
	};
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i];
		if (c === '\\') { i++; continue; }
		if (c === '[') {
			i++;
			if (pattern[i] === '^') i++;
			while (i < pattern.length && pattern[i] !== ']') { if (pattern[i] === '\\') i++; i++; }
			continue;
		}
		if (c === '(') { frames.push({ quantifier: false, alternation: false }); continue; }
		if (c === ')') {
			if (frames.length < 2) return false;
			const frame = frames.pop()!, following = quantifierAt(i + 1);
			if (following === 'repeat' && (frame.quantifier || frame.alternation)) return false;
			frames[frames.length - 1].quantifier = frames[frames.length - 1].quantifier || frame.quantifier || following !== null;
			frames[frames.length - 1].alternation = frames[frames.length - 1].alternation || frame.alternation;
			continue;
		}
		if (c === '|') { frames[frames.length - 1].alternation = true; continue; }
		const quantifier = quantifierAt(i);
		if (quantifier !== null) {
			frames[frames.length - 1].quantifier = true;
			if (++quantifiers > 10) return false;
			if (c === '{') i += /^\{\d+(,\d*)?\}/.exec(pattern.substring(i))![0].length - 1;
		}
	}
	return frames.length === 1;
}

/** A branch or glob pattern name for the on-load selection: not empty, no control characters, no leading dash. */
export function isSafeBranchSelection(name: string) {
	return name.trim() !== '' && name.trim()[0] !== '-' && !/[\x00-\x1f\x7f]/.test(name) && name.length <= 256;
}
