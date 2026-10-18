import * as cp from 'child_process';
import { getConfig } from './config';
import { findGitExecutable } from './gitExecutable';
import { Logger } from './logger';
import { GitCommandStatus, GitCommit, GitCommitDetails, GitCommitNode, GitFileChangeType, GitRefData, GitResetMode, GitUnsavedChanges } from './types';
import { getPathFromStr } from './utils';

const eolRegex = /\r\n|\r|\n/g;
const headRegex = /^\(HEAD detached at [0-9A-Za-z]+\)/g;
const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';

/**
 * Configuration overrides passed to every git invocation. Colour codes would break output parsing
 * when the user has `color.ui=always`, and GPG signature blocks would break `git log` parsing when
 * the user has `log.showSignature=true`.
 */
const gitConfigOverrides = ['-c', 'color.ui=false', '-c', 'log.showSignature=false'];

/**
 * Runs git and parses its output. Every invocation uses `child_process.spawn` with an argument
 * array, so no value ever passes through a shell. Every invocation is written to the logger.
 */
/** Message returned when an argument could be mistaken for a git option. */
const INVALID_ARGUMENT = 'The value is not a valid reference name or commit hash.';

export class DataSource {
	private readonly logger: Logger;
	private gitPath: string = 'git';

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
				(version) => this.logger.log(version),
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
		return {
			log: ['%H', '%P', authorName, authorEmail, dateType, '%s'].join(gitLogSeparator),
			commitDetails: ['%H', '%P', authorName, authorEmail, dateType, committerName].join(gitLogSeparator) + '%n%B'
		};
	}

	public getBranches(repo: string, showRemoteBranches: boolean) {
		const args = ['branch'];
		if (showRemoteBranches) args.push('-a');
		return this.spawnGit(args, repo, (stdout) => {
			const branchData = { branches: <string[]>[], head: <string | null>null, error: false };
			const lines = stdout.split(eolRegex);
			for (let i = 0; i < lines.length - 1; i++) {
				const name = lines[i].substring(2).split(' -> ')[0];
				if (name.match(headRegex) !== null) continue;

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

	public async getCommits(repo: string, branch: string, maxCommits: number, showRemoteBranches: boolean) {
		const [commits, refData] = await Promise.all([
			this.getGitLog(repo, branch, maxCommits + 1, showRemoteBranches),
			this.getRefs(repo, showRemoteBranches)
		]);
		const moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

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

		const commitNodes: GitCommitNode[] = [];
		const commitLookup: { [hash: string]: number } = {};

		for (let i = 0; i < commits.length; i++) {
			commitLookup[commits[i].hash] = i;
			commitNodes.push({ hash: commits[i].hash, parentHashes: commits[i].parentHashes, author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: [] });
		}
		for (let i = 0; i < refData.refs.length; i++) {
			if (typeof commitLookup[refData.refs[i].hash] === 'number') {
				commitNodes[commitLookup[refData.refs[i].hash]].refs.push(refData.refs[i]);
			}
		}

		return { commits: commitNodes, head: refData.head, moreCommitsAvailable: moreCommitsAvailable };
	}

	public commitDetails(repo: string, commitHash: string): Promise<GitCommitDetails | null> {
		if (!isCommitHash(commitHash)) return Promise.resolve(null);
		return Promise.all([
			this.spawnGit(['show', '--quiet', commitHash, '--format=' + this.getFormats().commitDetails], repo, (stdout): GitCommitDetails => {
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
					fileChanges: []
				};
			}),
			this.spawnGit(['diff-tree', '--name-status', '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', commitHash], repo, (stdout) => stdout.split(eolRegex)),
			this.spawnGit(['diff-tree', '--numstat', '-r', '-m', '--root', '--find-renames', '--diff-filter=AMDR', commitHash], repo, (stdout) => stdout.split(eolRegex))
		]).then((results) => {
			const details = results[0], fileLookup: { [file: string]: number } = {};

			for (let i = 1; i < results[1].length - 1; i++) {
				const line = results[1][i].split('\t');
				if (line.length < 2) break;
				const oldFilePath = getPathFromStr(line[1]), newFilePath = getPathFromStr(line[line.length - 1]);
				fileLookup[newFilePath] = details.fileChanges.length;
				details.fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
			}

			for (let i = 1; i < results[2].length - 1; i++) {
				const line = results[2][i].split('\t');
				if (line.length !== 3) break;
				const fileName = line[2].replace(/(.*){.* => (.*)}/, '$1$2').replace(/.* => (.*)/, '$1');
				if (typeof fileLookup[fileName] === 'number') {
					details.fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
					details.fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
				}
			}
			return details;
		}).catch(() => null);
	}

	public getCommitFile(repo: string, commitHash: string, filePath: string) {
		if (!isCommitHash(commitHash)) return Promise.resolve('');
		return this.spawnGit(['show', commitHash + ':' + filePath], repo, (stdout) => stdout).catch(() => '');
	}

	public getRemoteUrl(repo: string) {
		return this.spawnGit(['config', '--get', 'remote.origin.url'], repo, (stdout) => stdout.split(eolRegex)[0]).catch(() => null);
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
			args.push('-a', tagName, '-m', message);
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

	public createBranch(repo: string, branchName: string, commitHash: string) {
		if (!isSafeRefName(branchName) || !isCommitHash(commitHash)) return rejectArguments();
		return this.runGitCommand(['branch', branchName, commitHash], repo);
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

	public mergeBranch(repo: string, branchName: string, createNewCommit: boolean) {
		if (!isSafeRefName(branchName)) return rejectArguments();
		const args = ['merge', branchName];
		if (createNewCommit) args.push('--no-ff');
		return this.runGitCommand(args, repo);
	}

	public mergeCommit(repo: string, commitHash: string, createNewCommit: boolean) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['merge', commitHash];
		if (createNewCommit) args.push('--no-ff');
		return this.runGitCommand(args, repo);
	}

	public cherrypickCommit(repo: string, commitHash: string, parentIndex: number) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['cherry-pick', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}

	public revertCommit(repo: string, commitHash: string, parentIndex: number) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		const args = ['revert', '--no-edit', commitHash];
		if (parentIndex > 0) args.push('-m', parentIndex.toString());
		return this.runGitCommand(args, repo);
	}

	public resetToCommit(repo: string, commitHash: string, resetMode: GitResetMode) {
		if (!isCommitHash(commitHash)) return rejectArguments();
		return this.runGitCommand(['reset', '--' + resetMode, commitHash], repo);
	}

	private getRefs(repo: string, showRemoteBranches: boolean) {
		const config = getConfig();
		const showTags = config.showTags(), showRemoteHeads = config.showRemoteHeads();
		const args = ['show-ref'];
		if (!showRemoteBranches) args.push('--heads', '--tags');
		args.push('-d', '--head');
		return this.spawnGit(args, repo, (stdout) => {
			const refData: GitRefData = { head: null, refs: [] };
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
					if (!showRemoteHeads && ref.endsWith('/HEAD')) continue;
					refData.refs.push({ hash: hash, name: ref.substring(13), type: 'remote' });
				} else if (ref === 'HEAD') {
					refData.head = hash;
				}
			}
			return refData;
		}).catch((): GitRefData => ({ head: null, refs: [] }));
	}

	private getGitLog(repo: string, branch: string, num: number, showRemoteBranches: boolean) {
		const config = getConfig();
		const args = ['log', '--max-count=' + num, '--format=' + this.getFormats().log, '--' + config.commitOrdering() + '-order'];
		if (branch !== '') {
			if (!isSafeRefName(branch)) return Promise.resolve(<GitCommit[]>[]);
			args.push(branch);
		} else {
			// HEAD is listed explicitly so that a detached HEAD is part of the graph
			args.push('HEAD', '--branches');
			if (config.showCommitsOnlyReferencedByTags()) args.push('--tags');
			if (showRemoteBranches) args.push('--remotes');
		}
		args.push('--');

		return this.spawnGit(args, repo, (stdout) => {
			const lines = stdout.split(eolRegex);
			const gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].split(gitLogSeparator);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
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
	private runGitCommand(args: string[], repo: string): Promise<GitCommandStatus> {
		return this.spawnGit(args, repo, () => null).catch((error: string) => error);
	}

	/**
	 * Spawn git with the given arguments in the given directory. Resolves with `onSuccess(stdout)`
	 * when git exits with code 0. Rejects with a message built from stderr (or stdout) otherwise, or
	 * with the spawn error when git could not be started at all. Output is collected as bytes and
	 * decoded once the process has closed, so multi-byte characters split across chunks stay intact.
	 * Set `logFailure` to false for probes where a non-zero exit code is an expected answer.
	 */
	private spawnGit<T>(args: string[], repo: string, onSuccess: (stdout: string) => T, logFailure: boolean = true) {
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
				cmd = cp.spawn(this.gitPath, fullArgs, { cwd: repo });
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
				if (code === 0) {
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
function isSafeRefName(name: string) {
	return name !== '' && name[0] !== '-' && !/[\x00-\x1f\x7f]/.test(name);
}

/** Commit hashes are hexadecimal (SHA-1 or SHA-256), abbreviated to at least 4 characters. */
function isCommitHash(hash: string) {
	return /^[0-9a-f]{4,64}$/i.test(hash);
}

function rejectArguments(): Promise<GitCommandStatus> {
	return Promise.resolve(INVALID_ARGUMENT);
}

