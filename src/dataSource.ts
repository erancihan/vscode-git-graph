import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getConfig } from './config';
import { applyAutosquash, serializeTodo, validateTodo } from './rebaseTodo';
import { findGitExecutable } from './gitExecutable';
import { Logger } from './logger';
import { CherryPickOptions, GitArchiveType, GitBisectAction, GitOperationAction, GitOperationInProgress, GitOperationType, GitCommandStatus, GitCommit, GitCommitDetails, GitCommitNode, GitFileChange, GitFileChangeType, GraphFilters, GitPushBranchMode, GitRebaseTodoEntry, GitRebaseType, GitRefData, GitRemoteDetails, GitRepoSettings, GitRepoState, GitResetMode, GitSignature, GitSignatureStatus, GitStash, GitUnsavedChanges, GitUserDetails, GitWorktree, MergeOptions } from './types';
import { getPathFromStr } from './utils';

const eolRegex = /\r\n|\r|\n/g;
const headRegex = /^\(HEAD detached at [0-9A-Za-z]+\)/g;
const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

/**
 * Configuration overrides passed to every git invocation. Colour codes would break output parsing
 * when the user has `color.ui=always`, and GPG signature blocks would break `git log` parsing when
 * the user has `log.showSignature=true`. `safe.bareRepository=explicit` stops git from treating a
 * bare repository that is embedded in a checkout (a known attack vector) as the repository to use.
 */
const gitConfigOverrides = ['-c', 'color.ui=false', '-c', 'log.showSignature=false', '-c', 'safe.bareRepository=explicit'];

/**
 * Runs git and parses its output. Every invocation uses `child_process.spawn` with an argument
 * array, so no value ever passes through a shell. Every invocation is written to the logger.
 */
/** Message returned when an argument could be mistaken for a git option. */
const INVALID_ARGUMENT = 'The value is not a valid reference name or commit hash.';

export class DataSource {
	private readonly logger: Logger;
	private gitPath: string = 'git';
	private gitVersion: string | null = null;
	private environmentProvider: () => { [key: string]: string } = () => ({});
	private extensionPath: string | null = null;
	/** Temporary folders of interactive rebases that git stopped (edit, conflicts); removed once the rebase is over. */
	private rebaseTempDirs: { repo: string, dir: string }[] = [];

	/** Extra environment variables for every git process (used for the askpass helper). */
	public setEnvironmentProvider(provider: () => { [key: string]: string }) {
		this.environmentProvider = provider;
	}

	/** Folder of the extension, needed to find the sequence editor helper of the interactive rebase editor. */
	public setExtensionPath(extensionPath: string) {
		this.extensionPath = extensionPath;
	}

	/** Remove the temporary files of every finished or abandoned interactive rebase. */
	public dispose() {
		for (const item of this.rebaseTempDirs) removeDirectory(item.dir);
		this.rebaseTempDirs = [];
	}

	/** Output of `git --version`, or null until it has been read. */
	public getGitVersion() {
		return this.gitVersion;
	}

	/** Path of the git executable in use (`git` until discovery finishes). */
	public getGitPath() {
		return this.gitPath;
	}

	constructor(logger: Logger) {
		this.logger = logger;
		this.registerGitPath();
	}

	/**
	 * Pick the git executable from the `git.path` setting (a string or an array of candidates). The
	 * first candidate that exists on disk wins; a bare command name such as `git` is always accepted
	 * and resolved through PATH. Falls back to `git`.
	 */
	public registerGitPath() {
		const candidates = getConfig().gitPaths();
		findGitExecutable(candidates).then((gitPath) => {
			this.gitPath = gitPath;
			this.logger.log('Using git executable: ' + gitPath);
			this.spawnGit(['--version'], process.cwd(), (stdout) => stdout.trim()).then(
				(version) => { this.gitVersion = version; this.logger.log(version); },
				(error) => this.logger.logError('Unable to run git (set the "git.path" setting to the path of your git executable): ' + error)
			);
		});
	}

	/**
	 * Format placeholders for git log and git show, built from the current settings. The date type
	 * selects author or committer timestamps. With useMailmap the capitalised placeholders (%aN, %aE,
	 * %cN) are used: git applies .mailmap to those, and never to %an, %ae and %cn.
	 */
	private getFormats() {
		const config = getConfig();
		const dateType = config.dateType() === 'Author Date' ? '%at' : '%ct';
		const [authorName, authorEmail, committerName] = config.useMailmap() ? ['%aN', '%aE', '%cN'] : ['%an', '%ae', '%cn'];
		const signature = config.showSignatureStatus() ? ['%G?', '%GS', '%GK'] : [];
		return {
			log: ['%H', '%P', authorName, authorEmail, dateType].concat(signature, ['%s']).join(gitLogSeparator),
			logFields: 6 + signature.length,
			commitDetails: ['%H', '%P', authorName, authorEmail, dateType, committerName].concat(signature).join(gitLogSeparator) + '%n%B',
			withSignature: signature.length > 0
		};
	}

	public getBranches(repo: string, showRemoteBranches: boolean, hideRemotes: string[] = []) {
		const args = ['branch'];
		if (showRemoteBranches) args.push('-a');
		return this.spawnGit(args, repo, (stdout) => {
			const branchData = { branches: <string[]>[], head: <string | null>null, error: false };
			const lines = stdout.split(eolRegex);
			for (let i = 0; i < lines.length - 1; i++) {
				const name = lines[i].substring(2).split(' -> ')[0];
				if (name.match(headRegex) !== null) continue;
				if (hideRemotes.some((remote) => name.startsWith('remotes/' + remote + '/'))) continue;

				if (lines[i][0] === '*') {
					branchData.head = name;
					branchData.branches.unshift(name);
				} else {
					branchData.branches.push(name);
				}
			}
			return branchData;
		}).catch(() => ({ branches: <string[]>[], head: <string | null>null, error: true }));
	}

	/**
	 * Load commits. `branches` lists branch names, "HEAD", or "--glob=<pattern>" entries; an empty list
	 * shows all branches (and tags and remotes according to the settings).
	 */
	public async getCommits(repo: string, branches: string[], maxCommits: number, showRemoteBranches: boolean, repoState: GitRepoState | null = null, filters: GraphFilters = { authors: [], paths: [] }) {
		const options = resolveLoadOptions(repoState);
		const [commits, refData, stashes] = await Promise.all([
			this.getGitLog(repo, branches, maxCommits + 1, showRemoteBranches, options, filters),
			this.getRefs(repo, showRemoteBranches, options),
			options.showStashes ? this.getStashes(repo) : Promise.resolve(<GitStashEntry[]>[])
		]);
		const moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

		// Insert each stash as a row directly above the commit it was created from (newest stash on top)
		if (stashes.length > 0) {
			const positions: { [hash: string]: number } = {};
			for (let i = 0; i < commits.length; i++) positions[commits[i].hash] = i;
			for (let i = stashes.length - 1; i >= 0; i--) {
				const stash = stashes[i], baseIndex = positions[stash.baseHash];
				if (typeof baseIndex !== 'number') continue;
				commits.splice(baseIndex, 0, { hash: stash.hash, parentHashes: [stash.baseHash], author: stash.author, email: stash.email, date: stash.date, message: stash.message, stash: { selector: stash.selector, baseHash: stash.baseHash, untrackedFilesHash: stash.untrackedFilesHash } });
				for (let j = baseIndex; j < commits.length; j++) positions[commits[j].hash] = j;
			}
		}

		if (refData.head !== null) {
			for (let i = 0; i < commits.length; i++) {
				if (refData.head === commits[i].hash) {
					const unsavedChanges = getConfig().showUncommittedChanges() ? await this.getGitUnsavedChanges(repo) : null;
					if (unsavedChanges !== null) {
						commits.unshift({ hash: '*', parentHashes: [refData.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
					}
					break;
				}
			}
		}

		// One row per other worktree with uncommitted changes, directly above the commit it has checked out
		if (getConfig().showUncommittedChanges()) {
			const rows = await this.getWorktreeChangesRows(repo, commits.map((commit) => commit.hash));
			for (let i = rows.length - 1; i >= 0; i--) {
				const index = commits.findIndex((commit) => commit.hash === rows[i].head);
				if (index !== -1) commits.splice(index, 0, rows[i].row);
			}
		}

		const commitNodes: GitCommitNode[] = [];
		const commitLookup: { [hash: string]: number } = {};

		for (let i = 0; i < commits.length; i++) {
			commitLookup[commits[i].hash] = i;
			const stash = commits[i].stash || null;
			commitNodes.push({ hash: commits[i].hash, parentHashes: commits[i].parentHashes, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: stash !== null ? [{ hash: commits[i].hash, name: stash.selector, type: 'stash' }] : [], stash: stash, signature: commits[i].signature || null, bisect: refData.bisect[commits[i].hash] || null , worktree: commits[i].worktree || null });
		}
		for (let i = 0; i < refData.refs.length; i++) {
			if (typeof commitLookup[refData.refs[i].hash] === 'number') {
				commitNodes[commitLookup[refData.refs[i].hash]].refs.push(refData.refs[i]);
			}
		}

		return { commits: commitNodes, head: refData.head, moreCommitsAvailable: moreCommitsAvailable, bisecting: Object.keys(refData.bisect).length > 0 || await this.isBisecting(repo), operation: await this.getOperationInProgress(repo) };
	}

	public commitDetails(repo: string, commitHash: string): Promise<GitCommitDetails | null> {
		if (!isCommitHash(commitHash)) return Promise.resolve(null);
		const formats = this.getFormats();
		return Promise.all([
			this.spawnGit(['show', '--quiet', commitHash, '--format=' + formats.commitDetails], repo, (stdout): GitCommitDetails => {
				const lines = stdout.split(eolRegex);
				let lastLine = lines.length - 1;
				while (lines.length > 0 && lines[lastLine] === '') lastLine--;
				const commitInfo = lines[0].split(gitLogSeparator);
				return {
					hash: commitInfo[0],
					parents: commitInfo[1].split(' '),
					author: commitInfo[2],
					email: commitInfo[3],
					date: parseInt(commitInfo[4]),
					committer: commitInfo[5],
					body: lines.slice(1, lastLine + 1).join('\n'),
					fileChanges: [],
					signature: formats.withSignature && commitInfo.length >= 9 ? parseSignature(commitInfo[6], commitInfo[7], commitInfo[8]) : null
				};
			}),
			this.getFileChangesOfCommit(repo, commitHash)
		]).then((results) => {
			results[0].fileChanges = results[1];
			return results[0];
		}).catch(() => null);
	}

	/** The files changed by a commit, relative to its first parent (or everything for a root commit). */
	private getFileChangesOfCommit(repo: string, commitHash: string) {
		const common = ['-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', commitHash];
		return Promise.all([
			this.spawnGit(['diff-tree', '--name-status', ...common], repo, (stdout) => stdout.split(eolRegex).slice(1)),
			this.spawnGit(['diff-tree', '--numstat', ...common], repo, (stdout) => stdout.split(eolRegex).slice(1))
		]).then((results) => parseFileChanges(results[0], results[1]));
	}

	/**
	 * The files that differ between two commits, or between a commit and the working tree when
	 * `toHash` is "*". Resolves to null when git fails.
	 */
	public compareCommits(repo: string, fromHash: string, toHash: string): Promise<GitFileChange[] | null> {
		if (!isCommitHash(fromHash) || (toHash !== '*' && !isCommitHash(toHash))) return Promise.resolve(null);
		const common = ['--find-renames', '--diff-filter=AMDR', fromHash];
		if (toHash !== '*') common.push(toHash);
		return Promise.all([
			this.spawnGit(['diff', '--name-status', ...common], repo, (stdout) => stdout.split(eolRegex)),
			this.spawnGit(['diff', '--numstat', ...common], repo, (stdout) => stdout.split(eolRegex))
		]).then((results) => parseFileChanges(results[0], results[1])).catch(() => null);
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string) {
		if (!isCommitHash(commitHash)) return Promise.resolve('');
		return this.spawnGit(['show', commitHash + ':' + filePath], repo, (stdout) => stdout).catch(() => '');
	}

	public getRemoteUrl(repo: string) {
		return this.spawnGit(['config', '--get', 'remote.origin.url'], repo, (stdout) => stdout.split(eolRegex)[0]).catch(() => null);
	}

	/** Names of the configured remotes. */
	public getRemotes(repo: string) {
		return this.spawnGit(['remote'], repo, (stdout) => stdout.split(eolRegex).filter((line) => line !== '')).catch((): string[] => []);
	}

	/** The remotes with their fetch and push URLs. */
	public async getRemoteDetails(repo: string): Promise<GitRemoteDetails[]> {
		const names = await this.getRemotes(repo);
		const details: { [name: string]: GitRemoteDetails } = {};
		for (const name of names) details[name] = { name: name, url: null, pushUrl: null };
		const lines = await this.spawnGit(['config', '--get-regexp', '^remote\\..*\\.(url|pushurl)$'], repo, (stdout) => stdout.split(eolRegex)).catch((): string[] => []);
		for (const line of lines) {
			const space = line.indexOf(' ');
			if (space < 0) continue;
			const key = line.substring(0, space), value = line.substring(space + 1);
			const isPush = key.endsWith('.pushurl'), name = key.substring(7, key.length - (isPush ? 8 : 4));
			if (typeof details[name] === 'undefined') continue;
			if (isPush) details[name].pushUrl = value; else details[name].url = value;
		}
		return names.map((name) => details[name]);
	}

	public async addRemote(repo: string, name: string, url: string, pushUrl: string | null, fetch: boolean): Promise<GitCommandStatus> {
		if (!isSafeRefName(name) || !isSafeUrl(url) || (pushUrl !== null && !isSafeUrl(pushUrl))) return rejectArguments();
		let status = await this.runGitCommand(['remote', 'add', name, url], repo);
		if (status === null && pushUrl !== null) status = await this.runGitCommand(['remote', 'set-url', '--push', name, pushUrl], repo);
		if (status === null && fetch) status = await this.fetch(repo, name, false, false);
		return status;
	}

	public async editRemote(repo: string, nameOld: string, nameNew: string, url: string, pushUrl: string | null): Promise<GitCommandStatus> {
		if (!isSafeRefName(nameOld) || !isSafeRefName(nameNew) || !isSafeUrl(url) || (pushUrl !== null && !isSafeUrl(pushUrl))) return rejectArguments();
		let status: GitCommandStatus = null;
		if (nameOld !== nameNew) status = await this.runGitCommand(['remote', 'rename', nameOld, nameNew], repo);
		if (status === null) status = await this.runGitCommand(['remote', 'set-url', nameNew, url], repo);
		if (status === null) {
			if (pushUrl !== null) {
				status = await this.runGitCommand(['remote', 'set-url', '--push', nameNew, pushUrl], repo);
			} else {
				// Removing a push url that is not set is not an error
				await this.runGitCommand(['config', '--unset', 'remote.' + nameNew + '.pushurl'], repo, false);
			}
		}
		return status;
	}

	public deleteRemote(repo: string, name: string) {
		if (!isSafeRefName(name)) return rejectArguments();
		return this.runGitCommand(['remote', 'remove', name], repo);
	}

	public pruneRemote(repo: string, name: string) {
		if (!isSafeRefName(name)) return rejectArguments();
		return this.runGitCommand(['remote', 'prune', name], repo);
	}

	/** `user.name` and `user.email` from the local and the global configuration (null when not set). */
	public async getUserDetails(repo: string): Promise<GitUserDetails> {
		const read = (scope: string, key: string) => this.spawnGit(['config', scope, '--includes', '--get', key], repo, (stdout) => stdout.split(eolRegex)[0], false).catch((): string | null => null);
		const [localName, localEmail, globalName, globalEmail] = await Promise.all([read('--local', 'user.name'), read('--local', 'user.email'), read('--global', 'user.name'), read('--global', 'user.email')]);
		return { localName, localEmail, globalName, globalEmail };
	}

	/**
	 * Set `user.name` and `user.email` for the repository, or globally. An empty local value removes
	 * the local setting so the global one applies again.
	 */
	public async setUserDetails(repo: string, name: string, email: string, useGlobally: boolean): Promise<GitCommandStatus> {
		if (!isSafeConfigValue(name) || !isSafeConfigValue(email)) return rejectArguments();
		const scope = useGlobally ? '--global' : '--local';
		for (const [key, value] of [['user.name', name], ['user.email', email]]) {
			let status: GitCommandStatus = null;
			if (value.trim() === '') {
				if (useGlobally) return 'The global ' + key + ' cannot be empty.';
				// Without --includes: only a value written in this scope's own file can be unset there
				const isSet = await this.spawnGit(['config', scope, '--no-includes', '--get', key], repo, () => true, false).catch(() => false);
				if (isSet) status = await this.runGitCommand(['config', scope, '--unset', key], repo);
			} else {
				status = await this.runGitCommand(['config', scope, key, value.trim()], repo);
			}
			if (status !== null) return status;
		}
		return null;
	}

	/** Everything the Repository Settings widget shows: remotes, user details and worktrees. */
	public async getRepoSettings(repo: string): Promise<GitRepoSettings | null> {
		if (!await this.isGitRepository(repo)) return null;
		const [remotes, user, worktrees] = await Promise.all([this.getRemoteDetails(repo), this.getUserDetails(repo), this.getWorktrees(repo)]);
		return { remotes, user, worktrees };
	}

	/* Worktrees */

	public getWorktrees(repo: string): Promise<GitWorktree[]> {
		return this.spawnGit(['worktree', 'list', '--porcelain'], repo, (stdout) => parseWorktreeList(stdout)).catch((): GitWorktree[] => []);
	}

	/** Create a worktree at `worktreePath` checking out `ref`, or a new branch `newBranch` starting at `ref`. */
	public addWorktree(repo: string, worktreePath: string, ref: string, newBranch: string | null) {
		if (!isSafeWorktreePath(worktreePath) || !(isSafeRefName(ref) || isCommitHash(ref)) || (newBranch !== null && !isSafeRefName(newBranch))) return rejectArguments();
		const args = ['worktree', 'add'];
		if (newBranch !== null) args.push('-b', newBranch);
		args.push(worktreePath, ref);
		return this.runGitCommand(args, repo);
	}

	public removeWorktree(repo: string, worktreePath: string, force: boolean) {
		if (!isSafeWorktreePath(worktreePath)) return rejectArguments();
		const args = ['worktree', 'remove'];
		if (force) args.push('--force');
		args.push(worktreePath);
		return this.runGitCommand(args, repo);
	}

	public pruneWorktrees(repo: string) {
		return this.runGitCommand(['worktree', 'prune'], repo);
	}

	/**
	 * Paths (relative to the repository) of the submodules recorded in the index as gitlink entries
	 * (mode 160000). The index is used instead of .gitmodules because that file is content under the
	 * control of whoever wrote the repository. Paths are additionally checked to stay inside the
	 * repository.
	 */
	public getSubmodules(repo: string) {
		return this.spawnGit(['ls-files', '--stage', '-z'], repo, (stdout) => {
			const entries = stdout.split('\0'), paths: string[] = [];
			for (let i = 0; i < entries.length; i++) {
				// Format: "<mode> <object> <stage>\t<path>"
				if (!entries[i].startsWith('160000 ')) continue;
				const tab = entries[i].indexOf('\t');
				if (tab === -1) continue;
				const submodulePath = getPathFromStr(entries[i].substring(tab + 1));
				if (isSafeRelativePath(submodulePath)) paths.push(submodulePath);
			}
			return paths;
		}, false).catch((): string[] => []);
	}

	public isGitRepository(path: string) {
		return this.spawnGit(['rev-parse', '--git-dir'], path, () => true, false).catch(() => false);
	}

	public addTag(repo: string, tagName: string, commitHash: string, lightweight: boolean, message: string) {
		if (!isSafeRefName(tagName) || !isCommitHash(commitHash)) return rejectArguments();
		const args = ['tag'];
		if (lightweight) {
			args.push(tagName);
		} else {
			args.push(getConfig().signTags() ? '-s' : '-a', tagName, '-m', message);
		}
		args.push(commitHash);
		return this.runGitCommand(args, repo);
	}

	public deleteTag(repo: string, tagName: string) {
		if (!isSafeRefName(tagName)) return rejectArguments();
		return this.runGitCommand(['tag', '-d', tagName], repo);
	}

	public pushTag(repo: string, tagName: string) {
		if (!isSafeRefName(tagName)) return rejectArguments();
		return this.runGitCommand(['push', 'origin', 'refs/tags/' + tagName], repo);
	}

	public createBranch(repo: string, branchName: string, commitHash: string, checkout: boolean) {
		if (!isSafeRefName(branchName) || !isCommitHash(commitHash)) return rejectArguments();
		return this.runGitCommand(checkout ? ['checkout', '-b', branchName, commitHash] : ['branch', branchName, commitHash], repo);
	}

	public checkoutBranch(repo: string, branchName: string, remoteBranch: string | null) {
		if (!isSafeRefName(branchName) || (remoteBranch !== null && !isSafeRefName(remoteBranch))) return rejectArguments();
		const args = ['checkout'];
		if (remoteBranch === null) {
			args.push(branchName);
		} else {
			args.push('-b', branchName, remoteBranch);
		}
		return this.runGitCommand(args, repo);
	}

	public checkoutCommit(repo: string, commitHash: string) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		return this.runGitCommand(['checkout', commitHash], repo);
	}

	public deleteBranch(repo: string, branchName: string, forceDelete: boolean) {
		if (!isSafeRefName(branchName)) return rejectArguments();
		const args = ['branch', '--delete'];
		if (forceDelete) args.push('--force');
		args.push(branchName);
		return this.runGitCommand(args, repo);
	}

	public renameBranch(repo: string, oldName: string, newName: string) {
		if (!isSafeRefName(oldName) || !isSafeRefName(newName)) return rejectArguments();
		return this.runGitCommand(['branch', '-m', oldName, newName], repo);
	}

	public mergeBranch(repo: string, branchName: string, options: MergeOptions) {
		if (!isSafeRefName(branchName)) return rejectArguments();
		return this.merge(repo, branchName, 'Merge branch \'' + branchName + '\'', options);
	}

	public mergeCommit(repo: string, commitHash: string, options: MergeOptions) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		return this.merge(repo, commitHash, 'Merge commit \'' + commitHash + '\'', options);
	}

	/**
	 * Merge `obj` into the current branch. A squash merge stages the result and, unless noCommit is
	 * set, commits it with either a generated message or the SQUASH_MSG that git prepared.
	 */
	private async merge(repo: string, obj: string, defaultSquashMessage: string, options: MergeOptions): Promise<GitCommandStatus> {
		const config = getConfig();
		const args = ['merge', obj];
		if (options.squash) {
			args.push('--squash');
		} else {
			if (options.createNewCommit) args.push('--no-ff');
			if (options.noCommit) args.push('--no-commit');
			if (config.signCommits()) args.push('-S');
		}
		const status = await this.runGitCommand(args, repo);
		if (status !== null || !options.squash || options.noCommit) return status;

		const commitArgs = ['commit'];
		if (config.squashMessageFormat() === 'Git SQUASH_MSG') {
			commitArgs.push('--no-edit'); // Use .git/SQUASH_MSG, which lists the squashed commits
		} else {
			commitArgs.push('-m', defaultSquashMessage);
		}
		if (config.signCommits()) commitArgs.push('-S');
		return this.runGitCommand(commitArgs, repo);
	}

	/* Operations in progress (conflicts) */

	/** The merge, rebase, cherry pick or revert that git stopped, with the files that still have conflicts. */
	public async getOperationInProgress(repo: string): Promise<GitOperationInProgress | null> {
		const gitDir = resolveGitDir(repo);
		if (gitDir === null) return null;
		const exists = (name: string) => fs.existsSync(path.join(gitDir, name));
		let type: GitOperationType | null = null;
		if (exists('rebase-merge') || exists('rebase-apply')) type = 'rebase';
		else if (exists('MERGE_HEAD')) type = 'merge';
		else if (exists('CHERRY_PICK_HEAD')) type = 'cherry-pick';
		else if (exists('REVERT_HEAD')) type = 'revert';
		if (type === null) return null;
		const conflictedFiles = await this.spawnGit(['status', '--porcelain', '--untracked-files=no'], repo, (stdout) => parseConflictedFiles(stdout), false).catch((): string[] => []);
		return { type: type, conflictedFiles: conflictedFiles };
	}

	/** Continue, skip or abort the stopped operation. No editor is opened for the commit message. */
	public async operationAction(repo: string, type: GitOperationType, action: GitOperationAction): Promise<GitCommandStatus> {
		const types: GitOperationType[] = ['merge', 'rebase', 'cherry-pick', 'revert'], actions: GitOperationAction[] = ['continue', 'skip', 'abort'];
		if (types.indexOf(type) === -1 || actions.indexOf(action) === -1) return rejectArguments();
		if (action === 'skip' && type === 'merge') return rejectArguments();
		const status = await this.runGitCommand(['-c', 'core.editor=true', type, '--' + action], repo);
		if (type === 'rebase') await this.cleanupRebaseTempDirs(repo);
		return status;
	}

	/* Bisect */

	/** True while `git bisect start` is in effect (BISECT_START exists in the git directory). No git process is spawned. */
	public isBisecting(repo: string): Promise<boolean> {
		const gitDir = resolveGitDir(repo);
		return Promise.resolve(gitDir !== null && fs.existsSync(path.join(gitDir, 'BISECT_START')));
	}

	/**
	 * Mark a commit good, bad or skip (starting the bisection on the first mark), or reset.
	 * Resolves with the status and git's progress line.
	 */
	public async bisect(repo: string, action: GitBisectAction, commitHash: string | null): Promise<{ status: GitCommandStatus, message: string | null }> {
		if (action === 'reset') {
			return { status: await this.runGitCommand(['bisect', 'reset'], repo), message: null };
		}
		if (commitHash === null || !isCommitHash(commitHash)) return { status: await rejectArguments(), message: null };
		if (!await this.isBisecting(repo)) {
			const started = await this.runGitCommand(['bisect', 'start'], repo);
			if (started !== null) return { status: started, message: null };
		}
		return this.spawnGit(['bisect', action, commitHash], repo, (stdout) => {
			const progress = stdout.split(eolRegex).find((line) => /^Bisecting:/.test(line) || /is the first bad commit/.test(line));
			return { status: <GitCommandStatus>null, message: progress !== undefined ? progress : null };
		}).catch((error: string) => ({ status: <GitCommandStatus>error, message: null }));
	}

	/** Full message (%B) of a commit, or null when it cannot be read. */
	public getCommitMessage(repo: string, commitHash: string): Promise<string | null> {
		if (!isCommitHash(commitHash)) return Promise.resolve(null);
		return this.spawnGit(['log', '-1', '--format=%B', commitHash, '--'], repo, (stdout) => stdout.replace(/\s+$/, '')).catch(() => null);
	}

	/** True when HEAD is reachable from its upstream branch, that is, the commit was already pushed. False without an upstream. */
	public isHeadPushed(repo: string): Promise<boolean> {
		return this.spawnGit(['merge-base', '--is-ancestor', 'HEAD', '@{upstream}'], repo, () => true, false).catch(() => false);
	}

	/** Change the message of the checked-out commit and nothing else (the index is left untouched). */
	public async rewordCommit(repo: string, commitHash: string, message: string): Promise<GitCommandStatus> {
		if (!isCommitHash(commitHash) || message.trim() === '') return rejectArguments();
		if (!await this.isHead(repo, commitHash)) return 'The commit is no longer the checked-out commit (HEAD). Refresh the graph and try again.';
		const args = ['commit', '--amend', '--only', '--allow-empty', '-m', message];
		if (getConfig().signCommits()) args.push('-S');
		return this.runGitCommand(args, repo);
	}

	/** Fold the staged changes (and, optionally, every modified or deleted tracked file) into the checked-out commit. */
	public async amendCommit(repo: string, commitHash: string, message: string, stageTracked: boolean): Promise<GitCommandStatus> {
		if (!isCommitHash(commitHash) || message.trim() === '') return rejectArguments();
		if (!await this.isHead(repo, commitHash)) return 'The commit is no longer the checked-out commit (HEAD). Refresh the graph and try again.';
		if (stageTracked) {
			const status = await this.runGitCommand(['add', '--update', '--', '.'], repo);
			if (status !== null) return status;
		}
		const args = ['commit', '--amend', '--allow-empty', '-m', message];
		if (getConfig().signCommits()) args.push('-S');
		return this.runGitCommand(args, repo);
	}

	private isHead(repo: string, commitHash: string) {
		return this.spawnGit(['rev-parse', '--verify', '--quiet', 'HEAD'], repo, (stdout) => stdout.trim() === commitHash, false).catch(() => false);
	}

	public cherrypickCommit(repo: string, commitHash: string, options: CherryPickOptions) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['cherry-pick'];
		if (options.recordOrigin) args.push('-x');
		if (options.noCommit) args.push('--no-commit');
		if (options.parentIndex > 0) args.push('-m', options.parentIndex.toString());
		if (getConfig().signCommits() && !options.noCommit) args.push('-S');
		args.push(commitHash);
		return this.runGitCommand(args, repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['revert', '--no-edit'];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		if (getConfig().signCommits()) args.push('-S');
		args.push(commitHash);
		return this.runGitCommand(args, repo);
	}

	/**
	 * Remove a commit from the current branch's history by replaying the commits after it onto its
	 * parent. Only valid for a non-merge commit that is an ancestor of HEAD.
	 */
	public dropCommit(repo: string, commitHash: string) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['rebase', '--onto', commitHash + '^', commitHash];
		if (getConfig().signCommits()) args.push('-S');
		return this.runGitCommand(args, repo);
	}

	/** Discard the uncommitted changes: `mixed` unstages everything, `hard` also resets the working tree. */
	public resetUncommittedChanges(repo: string, mode: 'mixed' | 'hard') {
		return this.runGitCommand(['reset', '--' + mode], repo);
	}

	/** Remove untracked files, and untracked directories when `directories` is set. */
	public cleanUntrackedFiles(repo: string, directories: boolean) {
		return this.runGitCommand(directories ? ['clean', '-f', '-d'] : ['clean', '-f'], repo);
	}

	/* Stashes */

	/** The stash entries, newest first. An empty list when the repository has no stash. */
	private getStashes(repo: string) {
		const args = ['reflog', 'show', '--format=' + ['%H', '%P', '%gD', '%an', '%ae', '%ct', '%s'].join(gitLogSeparator), 'refs/stash', '--'];
		return this.spawnGit(args, repo, (stdout) => {
			const lines = stdout.split(eolRegex), stashes: GitStashEntry[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].split(gitLogSeparator);
				if (line.length !== 7) continue;
				const parents = line[1].split(' ');
				if (parents.length < 2) continue;
				stashes.push({
					hash: line[0],
					baseHash: parents[0],
					untrackedFilesHash: parents.length > 2 ? parents[2] : null,
					selector: line[2].startsWith('refs/') ? line[2].substring(5) : line[2],
					author: line[3],
					email: line[4],
					date: parseInt(line[5]),
					message: line[6]
				});
			}
			return stashes;
		}, false).catch((): GitStashEntry[] => []);
	}

	public applyStash(repo: string, selector: string, reinstateIndex: boolean) {
		if (!isStashSelector(selector)) return rejectArguments();
		const args = ['stash', 'apply'];
		if (reinstateIndex) args.push('--index');
		args.push(selector);
		return this.runGitCommand(args, repo);
	}

	public popStash(repo: string, selector: string, reinstateIndex: boolean) {
		if (!isStashSelector(selector)) return rejectArguments();
		const args = ['stash', 'pop'];
		if (reinstateIndex) args.push('--index');
		args.push(selector);
		return this.runGitCommand(args, repo);
	}

	public dropStash(repo: string, selector: string) {
		if (!isStashSelector(selector)) return rejectArguments();
		return this.runGitCommand(['stash', 'drop', selector], repo);
	}

	/** Create a branch at the commit the stash was created from, check it out, and apply the stash. */
	public branchFromStash(repo: string, selector: string, branchName: string) {
		if (!isStashSelector(selector) || !isSafeRefName(branchName)) return rejectArguments();
		return this.runGitCommand(['stash', 'branch', branchName, selector], repo);
	}

	/** Stash the uncommitted changes, with an optional message, and optionally the untracked files. */
	public pushStash(repo: string, message: string, includeUntracked: boolean) {
		const args = ['stash', 'push'];
		if (includeUntracked) args.push('--include-untracked');
		if (message !== '') args.push('--message', message);
		return this.runGitCommand(args, repo);
	}

	/* Remote actions */

	/** Fetch from one remote, or from all remotes when `remote` is null. */
	public fetch(repo: string, remote: string | null, prune: boolean, pruneTags: boolean) {
		if (remote !== null && !isSafeRefName(remote)) return rejectArguments();
		const args = ['fetch', remote === null ? '--all' : remote];
		if (prune) args.push('--prune');
		if (prune && pruneTags) args.push('--prune-tags');
		return this.runGitCommand(args, repo);
	}

	public pushBranch(repo: string, branchName: string, remote: string, setUpstream: boolean, mode: GitPushBranchMode) {
		if (!isSafeRefName(branchName) || !isSafeRefName(remote)) return rejectArguments();
		const args = ['push'];
		if (setUpstream) args.push('--set-upstream');
		if (mode === 'force') args.push('--force');
		if (mode === 'force-with-lease') args.push('--force-with-lease');
		args.push(remote, branchName);
		return this.runGitCommand(args, repo);
	}

	/**
	 * Push a branch to several remotes, one after the other. Stops at the first failure and
	 * reports which remote failed. The upstream is set for the first remote only, as git tracks one.
	 */
	public async pushBranchToRemotes(repo: string, branchName: string, remotes: string[], setUpstream: boolean, mode: GitPushBranchMode): Promise<GitCommandStatus> {
		if (remotes.length === 0) return 'No remote was selected.';
		for (let i = 0; i < remotes.length; i++) {
			const status = await this.pushBranch(repo, branchName, remotes[i], setUpstream && i === 0, mode);
			if (status !== null) return remotes.length > 1 ? 'Pushing to "' + remotes[i] + '" failed: ' + status : status;
		}
		return null;
	}

	/** Write an archive (zip or tar) of the tree at `ref` to `outputFilePath`. */
	public archive(repo: string, ref: string, outputFilePath: string, type: GitArchiveType) {
		if (!isSafeRefName(ref) && !isCommitHash(ref)) return rejectArguments();
		return this.runGitCommand(['archive', '--format=' + type, '--output=' + outputFilePath, ref, '--'], repo);
	}

	/**
	 * Open the diff of one file in the external tool configured by `diff.tool` (or `diff.guitool`).
	 * `toHash` "*" compares with the working tree. Resolves when the tool exits.
	 */
	public openExternalDiff(repo: string, fromHash: string, toHash: string, filePath: string) {
		const from = fromHash.endsWith('^') ? fromHash.slice(0, -1) : fromHash;
		if (!isCommitHash(from) || (toHash !== '*' && !isCommitHash(toHash)) || !isSafeRelativePath(filePath)) return rejectArguments();
		const args = ['difftool', '--no-prompt', fromHash];
		if (toHash !== '*') args.push(toHash);
		args.push('--', filePath);
		return this.runGitCommand(args, repo);
	}

	public pullBranch(repo: string, branchName: string, remote: string, createNewCommit: boolean, squash: boolean) {
		if (!isSafeRefName(branchName) || !isSafeRefName(remote)) return rejectArguments();
		const args = ['pull', remote, branchName];
		if (squash) {
			args.push('--squash');
		} else if (createNewCommit) {
			args.push('--no-ff');
		}
		return this.runGitCommand(args, repo);
	}

	public deleteRemoteBranch(repo: string, branchName: string, remote: string) {
		if (!isSafeRefName(branchName) || !isSafeRefName(remote)) return rejectArguments();
		return this.runGitCommand(['push', remote, '--delete', branchName], repo);
	}

	/** Update `localBranch` to `remote/remoteBranch` without checking it out. */
	public fetchIntoLocalBranch(repo: string, remote: string, remoteBranch: string, localBranch: string, force: boolean) {
		if (!isSafeRefName(remote) || !isSafeRefName(remoteBranch) || !isSafeRefName(localBranch)) return rejectArguments();
		const args = ['fetch'];
		if (force) args.push('--force');
		args.push(remote, remoteBranch + ':' + localBranch);
		return this.runGitCommand(args, repo);
	}

	/** Rebase the current branch on a branch or a commit. */
	public rebase(repo: string, obj: string, type: GitRebaseType, ignoreDate: boolean) {
		if (type === 'Commit' ? !isCommitHash(obj) : !isSafeRefName(obj)) return rejectArguments();
		const args = ['rebase', obj];
		if (ignoreDate) args.push('--ignore-date');
		return this.runGitCommand(args, repo);
	}

	/* Uncommitted changes of other worktrees */

	/**
	 * For every other worktree of the repository whose checked-out commit is among `hashes` and whose
	 * working tree has changes, a pseudo-row to insert above that commit. Costs one `git status` per
	 * worktree, and nothing at all when the repository has no linked worktrees.
	 */
	private async getWorktreeChangesRows(repo: string, hashes: string[]): Promise<{ head: string, row: GitCommit }[]> {
		const gitDir = resolveGitDir(repo);
		if (gitDir === null) return [];
		if (!fs.existsSync(path.join(gitDir, 'worktrees')) && !/[\\/]worktrees[\\/][^\\/]+$/.test(gitDir)) return [];
		const realRepo = realPathOrSame(repo), known: { [hash: string]: boolean } = {};
		for (const hash of hashes) known[hash] = true;
		const rows: { head: string, row: GitCommit }[] = [];
		const worktrees = await this.getWorktrees(repo);
		for (let i = 0; i < worktrees.length; i++) {
			const worktree = worktrees[i];
			if (worktree.head === null || !known[worktree.head] || realPathOrSame(worktree.path) === realRepo) continue;
			const changes = await this.getGitUnsavedChanges(worktree.path).catch((): GitUnsavedChanges | null => null);
			if (changes === null || changes.changes === 0) continue;
			const name = path.basename(worktree.path);
			rows.push({
				head: worktree.head,
				row: { hash: '*worktree:' + i, parentHashes: [worktree.head], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes in ' + name + ' (' + changes.changes + ')', worktree: { path: worktree.path, name: name } }
			});
		}
		return rows;
	}

	/* Conflict prediction */

	/**
	 * The files that would conflict when `obj` is merged into HEAD, found with `git merge-tree
	 * --write-tree` (git 2.38 or later), which merges in memory and leaves the working tree and the
	 * index alone. Resolves with null when git is older or the merge could not be simulated.
	 */
	public predictConflicts(repo: string, obj: string, type: GitRebaseType): Promise<string[] | null> {
		if (type === 'Commit' ? !isCommitHash(obj) : !isSafeRefName(obj)) return Promise.resolve(null);
		if (!isGitAtLeast(this.gitVersion, 2, 38)) return Promise.resolve(null);
		// Exit code 1 means "conflicts" and is a valid answer, not an error
		return this.spawnGit(['merge-tree', '--write-tree', '--name-only', '--no-messages', 'HEAD', obj], repo, (stdout) => parseMergeTreeOutput(stdout), false, {}, [0, 1]).catch(() => null);
	}

	/* Interactive rebase editor */

	/**
	 * The commits after `baseHash` up to HEAD, oldest first, as the todo list of an interactive
	 * rebase (every entry a pick, rearranged for autosquash when `rebase.autoSquash` is set). The
	 * base must be an ancestor of HEAD and the range must not contain merge commits.
	 */
	public async getRebaseTodo(repo: string, baseHash: string): Promise<{ todo: GitRebaseTodoEntry[] | null, headHash: string | null, error: string | null }> {
		if (!isCommitHash(baseHash)) return { todo: null, headHash: null, error: 'Invalid commit hash.' };
		const headHash = await this.spawnGit(['rev-parse', '--verify', 'HEAD'], repo, (stdout) => stdout.trim(), false).catch(() => null);
		if (headHash === null) return { todo: null, headHash: null, error: 'The repository has no checked-out commit.' };
		if (!await this.spawnGit(['merge-base', '--is-ancestor', baseHash, 'HEAD'], repo, () => true, false).catch(() => false)) {
			return { todo: null, headHash: headHash, error: 'The commit is not an ancestor of the checked-out commit (HEAD), so there is nothing to rebase onto it.' };
		}
		const entries = await this.spawnGit(['log', '--reverse', '--format=%H%x1f%P%x1f%s', baseHash + '..HEAD', '--'], repo, (stdout) => parseRebaseRange(stdout)).catch((): null => null);
		if (entries === null) return { todo: null, headHash: headHash, error: 'Unable to list the commits to rebase.' };
		if (entries.length === 0) return { todo: null, headHash: headHash, error: 'There are no commits after this one on the current branch.' };
		if (entries.some((entry) => entry.parents > 1)) return { todo: null, headHash: headHash, error: 'The commits to rebase include a merge commit. The rebase editor only rewrites linear history.' };
		let todo: GitRebaseTodoEntry[] = entries.map((entry) => ({ action: <const>'pick', hash: entry.hash, subject: entry.subject, message: null }));
		const autosquash = await this.spawnGit(['config', '--type=bool', 'rebase.autosquash'], repo, (stdout) => stdout.trim() === 'true', false).catch(() => false);
		if (autosquash) todo = applyAutosquash(todo);
		return { todo: todo, headHash: headHash, error: null };
	}

	/**
	 * Run `git rebase --interactive <base>` with the todo list from the rebase editor. The list is
	 * handed to git through the sequence editor helper (resources/sequence-editor.sh), reworded and
	 * squashed messages through files read by `exec` lines, and `core.editor=true` keeps git from
	 * opening an editor. Refused when HEAD moved since the list was built or the list does not match
	 * the commits in the range. When git stops (edit, conflicts) the usual operation bar takes over.
	 */
	public async interactiveRebase(repo: string, baseHash: string, headHash: string, todo: GitRebaseTodoEntry[]): Promise<GitCommandStatus> {
		if (!isCommitHash(baseHash) || !isCommitHash(headHash)) return rejectArguments();
		if (this.extensionPath === null) return 'The interactive rebase editor is not available.';
		const range = await this.getRebaseTodo(repo, baseHash);
		if (range.todo === null) return range.error;
		if (range.headHash !== headHash) return 'The checked-out commit (HEAD) changed since the rebase was prepared. Refresh the graph and try again.';
		const invalid = validateTodo(todo, range.todo.map((entry) => entry.hash));
		if (invalid !== null) return invalid;
		if (todo.every((entry) => entry.action === 'drop')) return 'Every commit is dropped. Use "Reset current branch to this Commit" instead.';

		let dir: string;
		try {
			dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-rebase-'));
		} catch (e) {
			return 'Unable to create the temporary folder for the rebase: ' + (e instanceof Error ? e.message : String(e));
		}
		const messageFile = (index: number) => path.join(dir, 'message-' + index + '.txt');
		const todoFile = path.join(dir, 'todo.txt');
		try {
			for (let i = 0; i < todo.length; i++) {
				if (typeof todo[i].message === 'string' && todo[i].message!.trim() !== '') fs.writeFileSync(messageFile(i), todo[i].message!.replace(/\r\n?/g, '\n').replace(/\s+$/, '') + '\n');
			}
			fs.writeFileSync(todoFile, serializeTodo(todo, messageFile, getConfig().signCommits()));
			if (process.platform !== 'win32') {
				try { fs.chmodSync(path.join(this.extensionPath, 'resources', 'sequence-editor.sh'), 0o755); } catch (e) { /* read-only install: the packaged mode applies */ }
			}
		} catch (e) {
			removeDirectory(dir);
			return 'Unable to write the rebase todo list: ' + (e instanceof Error ? e.message : String(e));
		}
		const env = {
			GIT_SEQUENCE_EDITOR: path.join(this.extensionPath, 'resources', 'sequence-editor.sh'),
			GIT_GRAPH_SEQUENCE_NODE: process.execPath,
			GIT_GRAPH_SEQUENCE_MAIN: path.join(this.extensionPath, 'resources', 'sequence-editor.js'),
			GIT_GRAPH_REBASE_TODO: todoFile,
			ELECTRON_RUN_AS_NODE: '1'
		};
		const args = ['-c', 'core.editor=true', 'rebase', '--interactive'];
		if (getConfig().signCommits()) args.push('-S');
		args.push(baseHash);
		this.rebaseTempDirs.push({ repo: repo, dir: dir });
		const status = await this.runGitCommand(args, repo, true, env);
		await this.cleanupRebaseTempDirs(repo);
		return status;
	}

	/** Fold a commit into its parent (the parent keeps its message) by replaying the branch with a generated todo list. */
	public async fixupCommit(repo: string, commitHash: string): Promise<GitCommandStatus> {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const parents = await this.spawnGit(['rev-list', '--parents', '-n', '1', commitHash, '--'], repo, (stdout) => stdout.trim().split(' ').slice(1), false).catch((): string[] => []);
		if (parents.length !== 1) return parents.length === 0 ? 'The commit has no parent to fold it into.' : 'A merge commit cannot be folded into a parent.';
		const grandparents = await this.spawnGit(['rev-list', '--parents', '-n', '1', parents[0], '--'], repo, (stdout) => stdout.trim().split(' ').slice(1), false).catch((): string[] => []);
		if (grandparents.length !== 1) return grandparents.length === 0 ? 'The parent is the first commit of the repository; the rebase editor cannot rewrite it.' : 'The parent is a merge commit; it cannot be rewritten by the rebase editor.';
		const range = await this.getRebaseTodo(repo, grandparents[0]);
		if (range.todo === null || range.headHash === null) return range.error;
		const index = range.todo.findIndex((entry) => entry.hash === commitHash), parentIndex = range.todo.findIndex((entry) => entry.hash === parents[0]);
		if (index === -1 || parentIndex === -1) return 'The commit is not on the current branch.';
		const todo: GitRebaseTodoEntry[] = range.todo.map((entry) => ({ ...entry, action: 'pick' }));
		const [entry] = todo.splice(index, 1);
		todo.splice(parentIndex + 1, 0, { ...entry, action: 'fixup' });
		return this.interactiveRebase(repo, grandparents[0], range.headHash, todo);
	}

	/** Remove the temporary files of the repository's interactive rebases once no rebase is in progress. */
	private async cleanupRebaseTempDirs(repo: string) {
		if (!this.rebaseTempDirs.some((item) => item.repo === repo)) return;
		const operation = await this.getOperationInProgress(repo);
		if (operation !== null && operation.type === 'rebase') return;
		this.rebaseTempDirs = this.rebaseTempDirs.filter((item) => {
			if (item.repo !== repo) return true;
			removeDirectory(item.dir);
			return false;
		});
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		return this.runGitCommand(['reset', '--' + resetMode, commitHash], repo);
	}

	private getRefs(repo: string, showRemoteBranches: boolean, options: LoadOptions = resolveLoadOptions(null)) {
		const showTags = options.showTags, showRemoteHeads = getConfig().showRemoteHeads(), hideRemotes = options.hideRemotes;
		// Every ref is listed (refs/bisect/* is needed too); remotes are dropped below when they are hidden
		const args = ['show-ref', '-d', '--head'];
		return this.spawnGit(args, repo, (stdout) => {
			const refData: GitRefData = { head: null, refs: [], bisect: {} };
			const lines = stdout.split(eolRegex);
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].split(' ');
				if (line.length < 2) continue;

				const hash = line.shift()!;
				const ref = line.join(' ');

				if (ref.startsWith('refs/heads/')) {
					refData.refs.push({ hash: hash, name: ref.substring(11), type: 'head' });
				} else if (ref.startsWith('refs/tags/')) {
					if (!showTags) continue;
					if (ref.endsWith('^{}')) {
						// Dereferenced annotated tag: it points at the commit, so replace the tag object entry
						const tagName = ref.substring(10, ref.length - 3);
						const tagObjectEntry = refData.refs.findIndex(r => r.type === 'tag' && r.name === tagName);
						if (tagObjectEntry > -1) refData.refs.splice(tagObjectEntry, 1);
						refData.refs.push({ hash: hash, name: tagName, type: 'tag' });
					} else {
						refData.refs.push({ hash: hash, name: ref.substring(10), type: 'tag' });
					}
				} else if (ref.startsWith('refs/remotes/')) {
					if (!showRemoteBranches) continue;
					if (!showRemoteHeads && ref.endsWith('/HEAD')) continue;
					const name = ref.substring(13);
					if (hideRemotes.some((remote) => name.startsWith(remote + '/'))) continue;
					refData.refs.push({ hash: hash, name: name, type: 'remote' });
				} else if (ref === 'HEAD') {
					refData.head = hash;
				} else if (ref.startsWith('refs/bisect/')) {
					// refs/bisect/bad, refs/bisect/good-<hash>, refs/bisect/skip-<hash>
					const name = ref.substring(12);
					if (name === 'bad') refData.bisect[hash] = 'bad';
					else if (name.startsWith('good-')) refData.bisect[hash] = 'good';
					else if (name.startsWith('skip-')) refData.bisect[hash] = 'skip';
				}
			}
			return refData;
		}).catch((): GitRefData => ({ head: null, refs: [], bisect: {} }));
	}

	private getGitLog(repo: string, branches: string[], num: number, showRemoteBranches: boolean, options: LoadOptions = resolveLoadOptions(null), filters: GraphFilters = { authors: [], paths: [] }) {
		const config = getConfig(), formats = this.getFormats();
		const args = ['log', '--max-count=' + num, '--format=' + formats.log, '--' + config.commitOrdering() + '-order'];
		if (options.onlyFollowFirstParent) args.push('--first-parent');
		const authors = filters.authors.filter((author) => author.trim() !== '' && !/[\r\n\0]/.test(author));
		if (authors.length > 0) {
			// Several --author patterns are combined with OR by git; --fixed-strings keeps them literal
			args.push('--fixed-strings', '--regexp-ignore-case');
			for (const author of authors) args.push('--author=' + author.trim());
		}
		const paths = filters.paths.filter((p) => p !== '');
		if (!paths.every(isSafeRelativePath)) return Promise.resolve(<GitCommit[]>[]);
		if (branches.length > 0) {
			for (const branch of branches) {
				if (isGlobSelector(branch)) {
					args.push(branch);
				} else if (isSafeRefName(branch)) {
					args.push(branch);
				} else {
					return Promise.resolve(<GitCommit[]>[]);
				}
			}
		} else {
			// HEAD is listed explicitly so that a detached HEAD is part of the graph
			args.push('HEAD', '--branches');
			if (config.showCommitsOnlyReferencedByTags()) args.push('--tags');
			if (showRemoteBranches) {
				// --exclude applies to the --remotes that follows it
				for (const remote of options.hideRemotes) args.push('--exclude=' + remote + '/*');
				args.push('--remotes');
			}
			if (options.includeCommitsMentionedByReflogs) args.push('--reflog');
		}
		args.push('--');
		for (const p of paths) args.push(p);

		return this.spawnGit(args, repo, (stdout) => {
			const lines = stdout.split(eolRegex);
			const gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].split(gitLogSeparator);
				if (line.length !== formats.logFields) break;
				const commit: GitCommit = { hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[line.length - 1] };
				if (formats.withSignature) commit.signature = parseSignature(line[5], line[6], line[7]);
				gitCommits.push(commit);
			}
			return gitCommits;
		}).catch((): GitCommit[] => []);
	}

	private getGitUnsavedChanges(repo: string) {
		const untracked = getConfig().showUntrackedFiles() ? '--untracked-files' : '--untracked-files=no';
		return this.spawnGit(['status', '-s', '--branch', untracked, '--porcelain'], repo, (stdout): GitUnsavedChanges | null => {
			const lines = stdout.split(eolRegex);
			return lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null;
		}).catch(() => null);
	}

	/**
	 * Run a git command that changes the repository. Resolves to `null` on success, or to the error
	 * message that should be shown to the user.
	 */
	private runGitCommand(args: string[], repo: string, logFailure = true, extraEnv: { [key: string]: string } = {}): Promise<GitCommandStatus> {
		return this.spawnGit(args, repo, () => null, logFailure, extraEnv).catch((error: string) => error);
	}

	/**
	 * Spawn git with the given arguments in the given directory. Resolves with `onSuccess(stdout)`
	 * when git exits with code 0. Rejects with a message built from stderr (or stdout) otherwise, or
	 * with the spawn error when git could not be started at all. Output is collected as bytes and
	 * decoded once the process has closed, so multi-byte characters split across chunks stay intact.
	 * Set `logFailure` to false for probes where a non-zero exit code is an expected answer.
	 */
	private spawnGit<T>(args: string[], repo: string, onSuccess: (stdout: string) => T, logFailure: boolean = true, extraEnvForCommand: { [key: string]: string } = {}, successCodes: number[] = [0]) {
		return new Promise<T>((resolve, reject) => {
			const fullArgs = gitConfigOverrides.concat(args);
			this.logger.logCmd(this.gitPath, fullArgs);
			const stdout: Buffer[] = [], stderr: Buffer[] = [];
			let settled = false;

			const fail = (message: string) => {
				if (settled) return;
				settled = true;
				if (logFailure) this.logger.logError(message);
				reject(message);
			};

			let cmd: cp.ChildProcess;
			try {
				const extraEnv = Object.assign({}, this.environmentProvider(), extraEnvForCommand);
				cmd = cp.spawn(this.gitPath, fullArgs, { cwd: repo, env: Object.keys(extraEnv).length > 0 ? Object.assign({}, process.env, extraEnv) : process.env });
			} catch (e) {
				fail('Unable to start git (' + this.gitPath + '): ' + (e instanceof Error ? e.message : String(e)));
				return;
			}

			cmd.stdout!.on('data', (chunk: Buffer) => { stdout.push(chunk); });
			cmd.stderr!.on('data', (chunk: Buffer) => { stderr.push(chunk); });
			cmd.on('error', (e) => {
				fail('Unable to start git (' + this.gitPath + '): ' + e.message);
			});
			cmd.on('close', (code) => {
				if (settled) return;
				if (code !== null && successCodes.indexOf(code) !== -1) {
					settled = true;
					resolve(onSuccess(Buffer.concat(stdout).toString()));
				} else {
					const out = Buffer.concat(stdout).toString(), err = Buffer.concat(stderr).toString();
					const text = err !== '' ? err : out;
					const lines = text.split(eolRegex).filter((line, i, all) => !(i === all.length - 1 && line === ''));
					fail(lines.length > 0 ? lines.join('\n') : 'git exited with code ' + code);
				}
			});
		});
	}
}

/**
 * A reference name supplied by the user or read from the repository must never be mistaken for a
 * git option. Git itself rejects names that start with "-", so refusing them loses nothing.
 */
/**
 * The git directory of a repository: `.git` when it is a directory, or the target of a `.git` file
 * (worktrees and submodules). Returns null when neither exists.
 */
export function resolveGitDir(repo: string): string | null {
	const dotGit = path.join(repo, '.git');
	try {
		const stat = fs.statSync(dotGit);
		if (stat.isDirectory()) return dotGit;
		if (stat.isFile()) {
			const match = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(dotGit, 'utf8'));
			if (match !== null) return path.isAbsolute(match[1]) ? match[1] : path.join(repo, match[1]);
		}
	} catch (e) {
		// no .git entry
	}
	return null;
}

/** Paths with unresolved conflicts from `git status --porcelain` (both-modified, both-added, both-deleted, added/deleted by one side). */
export function parseConflictedFiles(stdout: string): string[] {
	const files: string[] = [];
	for (const line of stdout.split(eolRegex)) {
		if (line.length < 4) continue;
		const code = line.substring(0, 2);
		if (code === 'UU' || code === 'AA' || code === 'DD' || code === 'AU' || code === 'UA' || code === 'DU' || code === 'UD') {
			let file = line.substring(3);
			if (file.startsWith('"') && file.endsWith('"')) file = file.substring(1, file.length - 1).replace(/\\(.)/g, '$1');
			files.push(file);
		}
	}
	return files;
}

/** Parses `git worktree list --porcelain`: blank-line separated records of "key value" lines. */
export function parseWorktreeList(stdout: string): GitWorktree[] {
	const worktrees: GitWorktree[] = [];
	let current: GitWorktree | null = null;
	for (const line of stdout.split(eolRegex)) {
		if (line === '') {
			if (current !== null) worktrees.push(current);
			current = null;
			continue;
		}
		const space = line.indexOf(' '), key = space === -1 ? line : line.substring(0, space), value = space === -1 ? '' : line.substring(space + 1);
		if (key === 'worktree') {
			current = { path: value, head: null, branch: null, isMain: worktrees.length === 0, locked: false, prunable: false };
		} else if (current !== null) {
			if (key === 'HEAD') current.head = value;
			else if (key === 'branch') current.branch = value.replace(/^refs\/heads\//, '');
			else if (key === 'locked') current.locked = true;
			else if (key === 'prunable') current.prunable = true;
		}
	}
	if (current !== null) worktrees.push(current);
	return worktrees;
}

/** Worktree folders are absolute paths chosen through the editor's dialogs; they must not look like options. */
export function isSafeWorktreePath(p: string) {
	return typeof p === 'string' && path.isAbsolute(p) && !p.startsWith('-') && !/[\r\n\0]/.test(p);
}

/** Options for loading a repository: the settings, overridden by the repository state where it is set. */
interface LoadOptions {
	hideRemotes: string[];
	showTags: boolean;
	showStashes: boolean;
	includeCommitsMentionedByReflogs: boolean;
	onlyFollowFirstParent: boolean;
}

export function resolveLoadOptions(state: GitRepoState | null): LoadOptions {
	const config = getConfig();
	const pick = (override: boolean | null | undefined, setting: boolean) => typeof override === 'boolean' ? override : setting;
	return {
		hideRemotes: state !== null && Array.isArray(state.hideRemotes) ? state.hideRemotes.filter(isSafeRefName) : [],
		showTags: pick(state !== null ? state.showTags : null, config.showTags()),
		showStashes: pick(state !== null ? state.showStashes : null, config.showStashes()),
		includeCommitsMentionedByReflogs: pick(state !== null ? state.includeCommitsMentionedByReflogs : null, config.includeCommitsMentionedByReflogs()),
		onlyFollowFirstParent: pick(state !== null ? state.onlyFollowFirstParent : null, config.onlyFollowFirstParent())
	};
}

/** A remote URL or path: anything that git accepts, as long as it cannot be mistaken for an option. */
export function isSafeUrl(url: string) {
	return url.trim() !== '' && !url.startsWith('-') && !/[\r\n\0]/.test(url);
}

/** A git config value: no leading dash (would be read as an option) and no control characters. */
export function isSafeConfigValue(value: string) {
	return !value.startsWith('-') && !/[\r\n\0]/.test(value);
}

const SIGNATURE_STATUSES: GitSignatureStatus[] = ['G', 'B', 'U', 'X', 'Y', 'R', 'E', 'N'];

/** Builds the signature record from the `%G?`, `%GS` and `%GK` placeholders. Unknown status codes are treated as "could not be checked". */
export function parseSignature(status: string, signer: string, key: string): GitSignature {
	return {
		status: SIGNATURE_STATUSES.indexOf(<GitSignatureStatus>status) > -1 ? <GitSignatureStatus>status : 'E',
		signer: signer,
		key: key
	};
}

export function isSafeRefName(name: string) {
	return name !== '' && name[0] !== '-' && !/[\x00-\x1f\x7f]/.test(name);
}

/**
 * Combine the output lines of git's --name-status and --numstat formats (without any header line)
 * into file changes. Binary files have no line counts and keep null additions and deletions.
 */
function parseFileChanges(nameStatusLines: string[], numStatLines: string[]) {
	const fileChanges: GitFileChange[] = [], fileLookup: { [file: string]: number } = {};
	for (let i = 0; i < nameStatusLines.length; i++) {
		const line = nameStatusLines[i].split('\t');
		if (line.length < 2) continue;
		const oldFilePath = getPathFromStr(line[1]), newFilePath = getPathFromStr(line[line.length - 1]);
		fileLookup[newFilePath] = fileChanges.length;
		fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
	}
	for (let i = 0; i < numStatLines.length; i++) {
		const line = numStatLines[i].split('\t');
		if (line.length !== 3) continue;
		const fileName = getPathFromStr(line[2].replace(/(.*){.* => (.*)}/, '$1$2').replace(/.* => (.*)/, '$1'));
		if (typeof fileLookup[fileName] === 'number' && line[0] !== '-') {
			fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
			fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
		}
	}
	return fileChanges;
}

/**
 * A path from repository content is only used when it is relative, non-empty, and stays inside the
 * repository: no absolute paths, drive letters, or ".." segments.
 */
export function isSafeRelativePath(relativePath: string) {
	if (relativePath === '' || relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath) || relativePath.indexOf('\0') > -1) return false;
	return relativePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * Branch dropdown entries for custom glob patterns have the form "--glob=<pattern>". The pattern is
 * limited to the characters of reference names and shell globs, so it cannot carry further options.
 */
function isGlobSelector(selector: string) {
	return /^--glob=[A-Za-z0-9_.*?\[\]\-\/]+$/.test(selector);
}

/** Stash selectors have the form "stash@{N}". */
function isStashSelector(selector: string) {
	return /^stash@\{\d+\}$/.test(selector);
}

/** A stash as read from the reflog of refs/stash. */
interface GitStashEntry extends GitStash {
	hash: string;
	author: string;
	email: string;
	date: number;
	message: string;
}

/** Commit hashes are hexadecimal (SHA-1 or SHA-256), abbreviated to at least 4 characters. */
export function isCommitHash(hash: string) {
	return /^[0-9a-f]{4,64}$/i.test(hash);
}

/** True when the `git --version` output is at least major.minor. Unknown versions count as too old. */
export function isGitAtLeast(versionOutput: string | null, major: number, minor: number) {
	const match = versionOutput !== null ? /(\d+)\.(\d+)(?:\.(\d+))?/.exec(versionOutput) : null;
	if (match === null) return false;
	const actualMajor = parseInt(match[1]), actualMinor = parseInt(match[2]);
	return actualMajor > major || (actualMajor === major && actualMinor >= minor);
}

/**
 * The conflicted files from `git merge-tree --write-tree --name-only`: the tree id on the first line,
 * then one file per line. Null when the output does not start with an object id (no merge was done).
 */
export function parseMergeTreeOutput(stdout: string): string[] | null {
	const lines = stdout.split(eolRegex);
	if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(lines[0])) return null;
	return lines.slice(1).filter((line) => line !== '');
}

/** Parse `git log --format=%H%x1f%P%x1f%s` into hash, number of parents and subject per line. */
export function parseRebaseRange(stdout: string): { hash: string, parents: number, subject: string }[] {
	return stdout.split(eolRegex).filter((line) => line !== '').map((line) => {
		const parts = line.split('\x1f');
		return { hash: parts[0], parents: parts[1] === '' || parts[1] === undefined ? 0 : parts[1].split(' ').length, subject: parts.slice(2).join('\x1f') };
	});
}

/** The real path of a folder (symbolic links resolved), or the path itself when it cannot be resolved. */
function realPathOrSame(folder: string) {
	try {
		return fs.realpathSync(folder);
	} catch (e) {
		return folder;
	}
}

/** Delete a temporary folder and its files. Errors are ignored (the folder is in the temp directory). */
function removeDirectory(dir: string) {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch (e) { /* best effort */ }
}

function rejectArguments(): Promise<GitCommandStatus> {
	return Promise.resolve(INVALID_ARGUMENT);
}

