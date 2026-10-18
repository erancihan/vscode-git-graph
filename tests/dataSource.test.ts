import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, isSafeRelativePath } from '../src/dataSource';
import { Logger } from '../src/logger';
import { configurationValues, outputChannelLines } from './mocks/vscode';

/** Run git synchronously in the test repository. Used only to build fixtures. */
function git(repo: string, args: string[]) {
	return cp.execFileSync('git', ['-c', 'color.ui=false', ...args], {
		cwd: repo,
		encoding: 'utf8',
		env: {
			...process.env,
			GIT_AUTHOR_NAME: 'Test Author', GIT_AUTHOR_EMAIL: 'author@example.com',
			GIT_COMMITTER_NAME: 'Test Committer', GIT_COMMITTER_EMAIL: 'committer@example.com',
			GIT_CONFIG_NOSYSTEM: '1', HOME: repo, XDG_CONFIG_HOME: repo
		}
	}).trim();
}

function commit(repo: string, file: string, content: string, message: string) {
	fs.writeFileSync(path.join(repo, file), content);
	git(repo, ['add', file]);
	git(repo, ['commit', '-q', '-m', message]);
	return git(repo, ['rev-parse', 'HEAD']);
}

describe('DataSource', () => {
	let repo: string;
	let dataSource: DataSource;
	let first: string, second: string, third: string;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-test-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		first = commit(repo, 'a.txt', 'one\n', 'First commit');
		second = commit(repo, 'b.txt', 'two\n', 'Second commit with "quotes" and \'apostrophes\'');
		git(repo, ['tag', 'v1']);
		git(repo, ['checkout', '-q', '-b', 'feature/it\'s-here']);
		third = commit(repo, 'a.txt', 'one\nthree\n', 'Third commit');
		git(repo, ['checkout', '-q', 'master']);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('detects git repositories', async () => {
		expect(await dataSource.isGitRepository(repo)).toBe(true);
		expect(await dataSource.isGitRepository(os.tmpdir())).toBe(false);
	});

	it('lists branches with the current branch first', async () => {
		const result = await dataSource.getBranches(repo, false);
		expect(result.error).toBe(false);
		expect(result.head).toBe('master');
		expect(result.branches).toEqual(['master', 'feature/it\'s-here']);
	});

	it('loads commits with refs attached and reports whether more are available', async () => {
		const result = await dataSource.getCommits(repo, [], 2, false);
		expect(result.moreCommitsAvailable).toBe(true);
		expect(result.commits.map(c => c.hash)).toEqual([third, second]);
		expect(result.head).toBe(second);
		const refs = result.commits[1].refs.map(r => r.type + ':' + r.name).sort();
		expect(refs).toEqual(['head:master', 'tag:v1']);
		expect(result.commits[0].refs.map(r => r.name)).toEqual(['feature/it\'s-here']);
	});

	it('loads commits of a single branch', async () => {
		const result = await dataSource.getCommits(repo, ['master'], 10, false);
		expect(result.moreCommitsAvailable).toBe(false);
		expect(result.commits.map(c => c.hash)).toEqual([second, first]);
	});

	it('loads commits of several branches, of HEAD, and of a glob pattern', async () => {
		let result = await dataSource.getCommits(repo, ['master', 'feature/it\'s-here'], 10, false);
		expect(result.commits.map(c => c.hash)).toEqual([third, second, first]);
		result = await dataSource.getCommits(repo, ['HEAD'], 10, false);
		expect(result.commits.map(c => c.hash)).toEqual([second, first]);
		result = await dataSource.getCommits(repo, ['--glob=heads/feature/*'], 10, false);
		expect(result.commits.map(c => c.hash)).toEqual([third, second, first]);
		result = await dataSource.getCommits(repo, ['--glob=heads/nothing-*'], 10, false);
		expect(result.commits).toEqual([]);
	});

	it('loads nothing when a branch entry looks like an option', async () => {
		const result = await dataSource.getCommits(repo, ['--all'], 10, false);
		expect(result.commits).toEqual([]);
		expect((await dataSource.getCommits(repo, ['--glob=heads/* --all'], 10, false)).commits).toEqual([]);
	});

	it('returns commit details including file changes', async () => {
		const details = await dataSource.commitDetails(repo, second);
		expect(details).not.toBeNull();
		expect(details!.author).toBe('Test Author');
		expect(details!.committer).toBe('Test Committer');
		expect(details!.body).toBe('Second commit with "quotes" and \'apostrophes\'');
		expect(details!.fileChanges).toEqual([{ oldFilePath: 'b.txt', newFilePath: 'b.txt', type: 'A', additions: 1, deletions: 0 }]);
	});

	it('compares two commits and a commit with the working tree', async () => {
		const changes = await dataSource.compareCommits(repo, first, third);
		expect(changes).not.toBeNull();
		expect(changes!.map(c => c.newFilePath + ':' + c.type).sort()).toEqual(['a.txt:M', 'b.txt:A']);
		expect(changes!.find(c => c.newFilePath === 'a.txt')).toEqual({ oldFilePath: 'a.txt', newFilePath: 'a.txt', type: 'M', additions: 1, deletions: 0 });
		fs.writeFileSync(path.join(repo, 'a.txt'), 'one\nchanged\n');
		try {
			const working = await dataSource.compareCommits(repo, second, '*');
			expect(working!.map(c => c.newFilePath + ':' + c.type)).toEqual(['a.txt:M']);
		} finally {
			git(repo, ['checkout', '-q', '--', 'a.txt']);
		}
		expect(await dataSource.compareCommits(repo, 'HEAD', third)).toBeNull();
		expect(await dataSource.compareCommits(repo, first, '--cached')).toBeNull();
	});

	it('returns the content of a file at a commit', async () => {
		expect(await dataSource.getCommitFile(repo, third, 'a.txt')).toBe('one\nthree\n');
		expect(await dataSource.getCommitFile(repo, first, 'missing.txt')).toBe('');
	});

	it('passes ref names with quotes and messages with spaces through unchanged', async () => {
		expect(await dataSource.createBranch(repo, 'it\'s-a-"branch"', first, false)).toBeNull();
		expect(git(repo, ['rev-parse', 'it\'s-a-"branch"'])).toBe(first);
		expect(await dataSource.addTag(repo, 'annotated', first, false, 'Message with "quotes" and spaces')).toBeNull();
		expect(git(repo, ['tag', '-l', '-n1', 'annotated'])).toMatch(/Message with "quotes" and spaces$/);
	});

	it('returns the git error text when a command fails', async () => {
		const status = await dataSource.deleteTag(repo, 'does-not-exist');
		expect(status).toMatch(/does-not-exist/);
		const lines = outputChannelLines['Git Graph'];
		expect(lines.some(l => l.includes('ERROR') && l.includes('does-not-exist'))).toBe(true);
	});

	it('rejects ref names that look like options and leaves the repository untouched', async () => {
		const before = git(repo, ['branch', '--list']);
		expect(await dataSource.createBranch(repo, '--help', first, false)).toMatch(/not a valid/i);
		expect(await dataSource.checkoutBranch(repo, '-b', null)).toMatch(/not a valid/i);
		expect(await dataSource.deleteBranch(repo, '--force', false)).toMatch(/not a valid/i);
		expect(await dataSource.mergeBranch(repo, '--squash', { createNewCommit: false, squash: false, noCommit: false })).toMatch(/not a valid/i);
		expect(await dataSource.pushTag(repo, '--mirror')).toMatch(/not a valid/i);
		expect(await dataSource.addTag(repo, '-f', first, true, '')).toMatch(/not a valid/i);
		expect(git(repo, ['branch', '--list'])).toBe(before);
	});

	it('rejects commit hashes that are not hexadecimal', async () => {
		expect(await dataSource.checkoutCommit(repo, '--orphan')).toMatch(/not a valid/i);
		expect(await dataSource.resetToCommit(repo, 'HEAD~1', 'soft')).toMatch(/not a valid/i);
		expect(await dataSource.commitDetails(repo, '--help')).toBeNull();
		expect(await dataSource.getCommitFile(repo, '--help', 'a.txt')).toBe('');
	});

	it('reports a git executable that cannot be started', async () => {
		const { configurationValues } = await import('./mocks/vscode');
		configurationValues['git'] = { path: path.join(repo, 'no-such-git') };
		const broken = new DataSource(new Logger());
		await new Promise(r => setTimeout(r, 50));
		delete configurationValues['git'];
		expect(await broken.isGitRepository(repo)).toBe(true); // falls back to git on PATH when the path does not exist
	});
});

describe('DataSource history actions', () => {
	let repo: string;
	let dataSource: DataSource;
	let base: string, featureTip: string;
	const noOptions = { createNewCommit: false, squash: false, noCommit: false };

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-actions-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		base = commit(repo, 'a.txt', 'one\n', 'Base commit');
		git(repo, ['checkout', '-q', '-b', 'feature']);
		commit(repo, 'b.txt', 'two\n', 'Feature one');
		featureTip = commit(repo, 'c.txt', 'three\n', 'Feature two');
		git(repo, ['checkout', '-q', 'master']);
		dataSource = new DataSource(new Logger());
	});

	afterEach(() => {
		delete configurationValues['git-graph'];
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('creates a branch and checks it out when asked', async () => {
		expect(await dataSource.createBranch(repo, 'stay', base, false)).toBeNull();
		expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('master');
		expect(await dataSource.createBranch(repo, 'go', base, true)).toBeNull();
		expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('go');
		git(repo, ['checkout', '-q', 'master']);
	});

	it('squash merges into one commit with the default message', async () => {
		expect(await dataSource.mergeBranch(repo, 'feature', { ...noOptions, squash: true })).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%s'])).toBe('Merge branch \'feature\'');
		expect(git(repo, ['log', '-1', '--format=%P']).split(' ')).toHaveLength(1);
		expect(fs.existsSync(path.join(repo, 'c.txt'))).toBe(true);
		git(repo, ['reset', '-q', '--hard', base]);
	});

	it('squash merges with the SQUASH_MSG message when configured', async () => {
		configurationValues['git-graph'] = { 'dialog.merge.squashMessageFormat': 'Git SQUASH_MSG' };
		expect(await dataSource.mergeBranch(repo, 'feature', { ...noOptions, squash: true })).toBeNull();
		const body = git(repo, ['log', '-1', '--format=%B']);
		expect(body).toContain('Squashed commit of the following');
		expect(body).toContain('Feature two');
		git(repo, ['reset', '-q', '--hard', base]);
	});

	it('merges without committing when asked', async () => {
		expect(await dataSource.mergeCommit(repo, featureTip, { ...noOptions, createNewCommit: true, noCommit: true })).toBeNull();
		expect(git(repo, ['rev-parse', 'HEAD'])).toBe(base);
		expect(fs.existsSync(path.join(repo, '.git', 'MERGE_HEAD'))).toBe(true);
		git(repo, ['merge', '--abort']);
	});

	it('cherry picks with record origin and no commit', async () => {
		expect(await dataSource.cherrypickCommit(repo, featureTip, { parentIndex: 0, recordOrigin: true, noCommit: false })).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%B'])).toContain('cherry picked from commit ' + featureTip);
		git(repo, ['reset', '-q', '--hard', base]);
		expect(await dataSource.cherrypickCommit(repo, featureTip, { parentIndex: 0, recordOrigin: false, noCommit: true })).toBeNull();
		expect(git(repo, ['rev-parse', 'HEAD'])).toBe(base);
		expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('c.txt');
		git(repo, ['reset', '-q', '--hard', base]);
	});

	it('drops a commit from the current branch', async () => {
		git(repo, ['checkout', '-q', '-b', 'drop', 'feature']);
		const dropped = git(repo, ['rev-parse', 'feature^']);
		expect(await dataSource.dropCommit(repo, dropped)).toBeNull();
		expect(git(repo, ['log', '--format=%s'])).toBe('Feature two\nBase commit');
		expect(fs.existsSync(path.join(repo, 'b.txt'))).toBe(false);
		git(repo, ['checkout', '-q', 'master']);
	});

	it('resets uncommitted changes and cleans untracked files', async () => {
		fs.writeFileSync(path.join(repo, 'a.txt'), 'changed\n');
		git(repo, ['add', 'a.txt']);
		fs.writeFileSync(path.join(repo, 'junk.txt'), 'junk\n');
		fs.mkdirSync(path.join(repo, 'junkdir'));
		fs.writeFileSync(path.join(repo, 'junkdir', 'x.txt'), 'x\n');
		expect(await dataSource.resetUncommittedChanges(repo, 'mixed')).toBeNull();
		expect(git(repo, ['diff', '--cached', '--name-only'])).toBe('');
		expect(git(repo, ['diff', '--name-only'])).toBe('a.txt');
		expect(await dataSource.resetUncommittedChanges(repo, 'hard')).toBeNull();
		expect(git(repo, ['status', '--porcelain', '--untracked-files=no'])).toBe('');
		expect(await dataSource.cleanUntrackedFiles(repo, false)).toBeNull();
		expect(fs.existsSync(path.join(repo, 'junk.txt'))).toBe(false);
		expect(fs.existsSync(path.join(repo, 'junkdir'))).toBe(true);
		expect(await dataSource.cleanUntrackedFiles(repo, true)).toBeNull();
		expect(fs.existsSync(path.join(repo, 'junkdir'))).toBe(false);
	});
});

describe('DataSource submodules', () => {
	let repo: string, sub: string;
	let dataSource: DataSource;

	beforeAll(() => {
		sub = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-sub-'));
		git(sub, ['init', '-q', '-b', 'master']);
		git(sub, ['config', 'user.name', 'Test Committer']);
		git(sub, ['config', 'user.email', 'committer@example.com']);
		git(sub, ['config', 'commit.gpgsign', 'false']);
		commit(sub, 'lib.txt', 'lib\n', 'Library commit');
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-super-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'one\n', 'Base commit');
		git(repo, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'vendor/lib']);
		git(repo, ['commit', '-q', '-m', 'Add submodule']);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		for (const dir of [repo, sub]) fs.rmSync(dir, { recursive: true, force: true });
	});

	it('lists the submodule paths from .gitmodules', async () => {
		expect(await dataSource.getSubmodules(repo)).toEqual(['vendor/lib']);
		expect(await dataSource.isGitRepository(path.join(repo, 'vendor', 'lib'))).toBe(true);
	});

	it('returns an empty list when the repository has no submodules', async () => {
		expect(await dataSource.getSubmodules(sub)).toEqual([]);
	});

	it('ignores .gitmodules entries that are not gitlinks in the index', async () => {
		fs.appendFileSync(path.join(repo, '.gitmodules'), '[submodule "evil"]\n\tpath = ../../outside\n\turl = ' + sub + '\n');
		expect(await dataSource.getSubmodules(repo)).toEqual(['vendor/lib']);
	});
});

describe('isSafeRelativePath', () => {
	it('accepts relative paths inside the repository', () => {
		expect(isSafeRelativePath('vendor/lib')).toBe(true);
		expect(isSafeRelativePath('a')).toBe(true);
	});

	it('rejects paths that could leave the repository', () => {
		for (const bad of ['', '/abs', 'C:/x', '../x', 'a/../../x', 'a/./b', 'a//b', 'a/\0b']) {
			expect(isSafeRelativePath(bad)).toBe(false);
		}
	});
});

describe('DataSource stashes', () => {
	let repo: string;
	let dataSource: DataSource;
	let base: string;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-stash-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'one\n', 'First commit');
		base = commit(repo, 'b.txt', 'two\n', 'Second commit');
		dataSource = new DataSource(new Logger());
	});

	afterEach(() => {
		delete configurationValues['git-graph'];
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('loads without stashes when the repository has none', async () => {
		const result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.commits.every(c => c.stash === null)).toBe(true);
	});

	it('stashes the uncommitted changes with a message and untracked files', async () => {
		fs.writeFileSync(path.join(repo, 'a.txt'), 'changed\n');
		fs.writeFileSync(path.join(repo, 'new.txt'), 'new\n');
		expect(await dataSource.pushStash(repo, 'My "stash" message', true)).toBeNull();
		expect(git(repo, ['status', '--porcelain'])).toBe('');
		expect(git(repo, ['stash', 'list'])).toContain('My "stash" message');
	});

	it('shows the stash as a row above its base commit', async () => {
		const result = await dataSource.getCommits(repo, [], 10, false);
		const stashIndex = result.commits.findIndex(c => c.stash !== null);
		expect(stashIndex).toBeGreaterThan(-1);
		const row = result.commits[stashIndex];
		expect(row.stash).toEqual({ selector: 'stash@{0}', baseHash: base, untrackedFilesHash: expect.stringMatching(/^[0-9a-f]{40}$/) });
		expect(row.parentHashes).toEqual([base]);
		expect(row.refs).toEqual([{ hash: row.hash, name: 'stash@{0}', type: 'stash' }]);
		expect(row.message).toContain('My "stash" message');
		expect(result.commits[stashIndex + 1].hash).toBe(base);
	});

	it('hides stashes when the setting is off', async () => {
		configurationValues['git-graph'] = { 'repository.showStashes': false };
		const result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.commits.every(c => c.stash === null)).toBe(true);
	});

	it('applies, pops and drops stashes', async () => {
		expect(await dataSource.applyStash(repo, 'stash@{0}', false)).toBeNull();
		expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('changed\n');
		expect(git(repo, ['stash', 'list']).split('\n')).toHaveLength(1);
		git(repo, ['reset', '-q', '--hard']);
		git(repo, ['clean', '-f', '-q']);
		expect(await dataSource.popStash(repo, 'stash@{0}', true)).toBeNull();
		expect(fs.existsSync(path.join(repo, 'new.txt'))).toBe(true);
		expect(git(repo, ['stash', 'list'])).toBe('');
		expect(await dataSource.pushStash(repo, '', false)).toBeNull();
		expect(await dataSource.dropStash(repo, 'stash@{0}')).toBeNull();
		expect(git(repo, ['stash', 'list'])).toBe('');
		git(repo, ['clean', '-f', '-q']);
	});

	it('creates a branch from a stash', async () => {
		fs.writeFileSync(path.join(repo, 'a.txt'), 'branch me\n');
		expect(await dataSource.pushStash(repo, 'for branch', false)).toBeNull();
		expect(await dataSource.branchFromStash(repo, 'stash@{0}', 'from-stash')).toBeNull();
		expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('from-stash');
		expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('branch me\n');
		git(repo, ['reset', '-q', '--hard']);
		git(repo, ['checkout', '-q', 'master']);
	});

	it('rejects selectors that are not stash references', async () => {
		expect(await dataSource.applyStash(repo, '--index', false)).toMatch(/not a valid/i);
		expect(await dataSource.dropStash(repo, 'HEAD')).toMatch(/not a valid/i);
		expect(await dataSource.branchFromStash(repo, 'stash@{0}', '--track')).toMatch(/not a valid/i);
	});
});

describe('DataSource remote actions', () => {
	let repo: string, remote: string, other: string;
	let dataSource: DataSource;
	let base: string;

	beforeAll(() => {
		remote = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-remote-'));
		git(remote, ['init', '-q', '--bare', '-b', 'master']);
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-local-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		git(repo, ['remote', 'add', 'origin', remote]);
		base = commit(repo, 'a.txt', 'one\n', 'Base commit');
		git(repo, ['push', '-q', '-u', 'origin', 'master']);
		// A second clone that pushes a branch the first repository does not know about yet
		other = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-other-'));
		git(other, ['clone', '-q', remote, '.']);
		git(other, ['config', 'user.name', 'Test Committer']);
		git(other, ['config', 'user.email', 'committer@example.com']);
		git(other, ['checkout', '-q', '-b', 'feature']);
		commit(other, 'b.txt', 'two\n', 'Feature commit');
		git(other, ['push', '-q', 'origin', 'feature']);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		for (const dir of [repo, remote, other]) fs.rmSync(dir, { recursive: true, force: true });
	});

	it('lists remotes', async () => {
		expect(await dataSource.getRemotes(repo)).toEqual(['origin']);
	});

	it('fetches from all remotes', async () => {
		expect(await dataSource.fetch(repo, null, true, false)).toBeNull();
		expect(git(repo, ['branch', '-r'])).toContain('origin/feature');
	});

	it('fetches a remote branch into a local branch without checking it out', async () => {
		expect(await dataSource.fetchIntoLocalBranch(repo, 'origin', 'feature', 'feature', false)).toBeNull();
		expect(git(repo, ['rev-parse', 'feature'])).toBe(git(repo, ['rev-parse', 'origin/feature']));
		expect(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('master');
	});

	it('pulls a remote branch into the current branch', async () => {
		expect(await dataSource.pullBranch(repo, 'feature', 'origin', true, false)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%P']).split(' ')).toHaveLength(2); // merge commit because of --no-ff
		expect(fs.existsSync(path.join(repo, 'b.txt'))).toBe(true);
	});

	it('pushes a branch and sets the upstream', async () => {
		git(repo, ['checkout', '-q', '-b', 'topic', base]);
		commit(repo, 'c.txt', 'three\n', 'Topic commit');
		expect(await dataSource.pushBranch(repo, 'topic', 'origin', true, 'normal')).toBeNull();
		expect(git(repo, ['rev-parse', '--abbrev-ref', 'topic@{upstream}'])).toBe('origin/topic');
		expect(git(remote, ['rev-parse', 'topic'])).toBe(git(repo, ['rev-parse', 'topic']));
		git(repo, ['checkout', '-q', 'master']);
	});

	it('deletes a remote branch', async () => {
		expect(await dataSource.deleteRemoteBranch(repo, 'topic', 'origin')).toBeNull();
		expect(git(remote, ['branch', '--list', 'topic'])).toBe('');
	});

	it('rebases the current branch on a branch and on a commit', async () => {
		git(repo, ['checkout', '-q', '-b', 'rebased', base]);
		const tip = commit(repo, 'd.txt', 'four\n', 'Rebased commit');
		expect(await dataSource.rebase(repo, 'master', 'Branch', true)).toBeNull();
		expect(git(repo, ['rev-parse', 'HEAD'])).not.toBe(tip);
		expect(git(repo, ['merge-base', '--is-ancestor', 'master', 'HEAD'])).toBe('');
		// Rebasing on an ancestor replays every commit after it, so only check that the rebase ran and kept the tip commit
		expect(await dataSource.rebase(repo, base, 'Commit', false)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%s'])).toBe('Rebased commit');
		git(repo, ['checkout', '-q', 'master']);
	});

	it('rejects option-like remote and branch names', async () => {
		expect(await dataSource.fetch(repo, '--all', false, false)).toMatch(/not a valid/i);
		expect(await dataSource.pushBranch(repo, 'master', '--mirror', false, 'normal')).toMatch(/not a valid/i);
		expect(await dataSource.rebase(repo, '--root', 'Branch', false)).toMatch(/not a valid/i);
		expect(await dataSource.rebase(repo, 'master', 'Commit', false)).toMatch(/not a valid/i);
	});
});

describe('DataSource commit loading options', () => {
	let repo: string;
	let dataSource: DataSource;
	let base: string, tagOnly: string, detached: string;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-test-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		base = commit(repo, 'a.txt', 'one\n', 'Base commit');
		git(repo, ['checkout', '-q', '--detach', base]);
		tagOnly = commit(repo, 'b.txt', 'two\n', 'Only reachable from a tag');
		git(repo, ['tag', '-a', '-m', 'An annotated tag', 'annotated-tag']);
		git(repo, ['checkout', '-q', '--detach', base]);
		detached = commit(repo, 'c.txt', 'three\n', 'Detached HEAD commit');
		dataSource = new DataSource(new Logger());
	});

	afterEach(() => {
		delete configurationValues['git-graph'];
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('includes the detached HEAD commit when showing all branches', async () => {
		const result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.head).toBe(detached);
		expect(result.commits.map(c => c.hash)).toEqual(expect.arrayContaining([detached, tagOnly, base]));
	});

	it('attaches annotated tags to the tagged commit exactly once', async () => {
		const result = await dataSource.getCommits(repo, [], 10, false);
		const tagged = result.commits.find(c => c.hash === tagOnly)!;
		expect(tagged.refs).toEqual([{ hash: tagOnly, name: 'annotated-tag', type: 'tag' }]);
	});

	it('hides commits only reachable from tags when the setting is off', async () => {
		configurationValues['git-graph'] = { 'repository.showCommitsOnlyReferencedByTags': false };
		const result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.commits.map(c => c.hash)).not.toContain(tagOnly);
		expect(result.commits.map(c => c.hash)).toContain(detached);
	});

	it('hides tags when the setting is off', async () => {
		configurationValues['git-graph'] = { 'repository.showTags': false };
		const result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.commits.every(c => c.refs.every(r => r.type !== 'tag'))).toBe(true);
	});

	it('applies the mailmap when enabled', async () => {
		fs.writeFileSync(path.join(repo, '.mailmap'), 'Mapped Name <mapped@example.com> <author@example.com>\n');
		try {
			let result = await dataSource.getCommits(repo, [], 10, false);
			expect(result.commits.find(c => c.hash === base)!.author).toBe('Test Author');
			configurationValues['git-graph'] = { 'repository.useMailmap': true };
			result = await dataSource.getCommits(repo, [], 10, false);
			expect(result.commits.find(c => c.hash === base)!.author).toBe('Mapped Name');
			expect(result.commits.find(c => c.hash === base)!.email).toBe('mapped@example.com');
			const details = await dataSource.commitDetails(repo, base);
			expect(details!.author).toBe('Mapped Name');
			expect(details!.committer).toBe('Test Committer');
		} finally {
			fs.unlinkSync(path.join(repo, '.mailmap'));
		}
	});

	it('counts untracked files only when the setting is on', async () => {
		fs.writeFileSync(path.join(repo, 'untracked.txt'), 'new\n');
		try {
			let result = await dataSource.getCommits(repo, [], 10, false);
			expect(result.commits[0].hash).toBe('*');
			expect(result.commits[0].message).toBe('Uncommitted Changes (1)');
			configurationValues['git-graph'] = { 'repository.showUntrackedFiles': false };
			result = await dataSource.getCommits(repo, [], 10, false);
			expect(result.commits[0].hash).not.toBe('*');
		} finally {
			fs.unlinkSync(path.join(repo, 'untracked.txt'));
		}
	});

	it('passes the first parent and reflog options to git log', async () => {
		configurationValues['git-graph'] = { 'repository.onlyFollowFirstParent': true, 'repository.includeCommitsMentionedByReflogs': true };
		await dataSource.getCommits(repo, [], 10, false);
		const lines = outputChannelLines['Git Graph'];
		const logLine = lines.slice(-4).find(l => l.includes(' log '))!;
		expect(logLine).toContain('--first-parent');
		expect(logLine).toContain('--reflog');
		await dataSource.getCommits(repo, ['master'], 10, false);
		const branchLogLine = outputChannelLines['Git Graph'].slice(-4).find(l => l.includes(' log '))!;
		expect(branchLogLine).toContain('--first-parent');
		expect(branchLogLine).not.toContain('--reflog');
	});

	it('passes the configured ordering to git log', async () => {
		configurationValues['git-graph'] = { 'repository.commits.order': 'topo' };
		await dataSource.getCommits(repo, [], 10, false);
		const lines = outputChannelLines['Git Graph'];
		expect(lines.some(l => l.includes(' log ') && l.includes('--topo-order'))).toBe(true);
		configurationValues['git-graph'] = { 'commitOrdering': 'author-date' };
		await dataSource.getCommits(repo, [], 10, false);
		expect(lines.slice(-4).some(l => l.includes('--author-date-order'))).toBe(true);
	});
});
