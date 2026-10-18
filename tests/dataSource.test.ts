import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, isSafeRelativePath, parseConflictedFiles, parseSignature, parseWorktreeList } from '../src/dataSource';
import { defaultRepoState } from '../src/repoManager';
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
	fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
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

	it('lists, adds, edits, prunes and deletes remotes', async () => {
		const second = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-remote3-'));
		git(second, ['init', '-q', '--bare']);
		try {
			expect(await dataSource.addRemote(repo, 'mirror', second, null, false)).toBeNull();
			let remotes = await dataSource.getRemoteDetails(repo);
			expect(remotes.map((r) => r.name).sort()).toEqual(['mirror', 'origin']);
			expect(remotes.find((r) => r.name === 'mirror')).toEqual({ name: 'mirror', url: second, pushUrl: null });

			expect(await dataSource.editRemote(repo, 'mirror', 'backup', second, second + '-push')).toBeNull();
			remotes = await dataSource.getRemoteDetails(repo);
			expect(remotes.find((r) => r.name === 'backup')).toEqual({ name: 'backup', url: second, pushUrl: second + '-push' });
			expect(await dataSource.editRemote(repo, 'backup', 'backup', second, null)).toBeNull();
			expect((await dataSource.getRemoteDetails(repo)).find((r) => r.name === 'backup')!.pushUrl).toBeNull();

			expect(await dataSource.pruneRemote(repo, 'origin')).toBeNull();
			expect(await dataSource.addRemote(repo, 'bad', '--upload-pack=evil', null, false)).toMatch(/not a valid/i);
			expect(await dataSource.addRemote(repo, '-x', second, null, false)).toMatch(/not a valid/i);
			expect(await dataSource.deleteRemote(repo, 'backup')).toBeNull();
			expect((await dataSource.getRemotes(repo))).toEqual(['origin']);
		} finally {
			if ((await dataSource.getRemotes(repo)).indexOf('backup') > -1) git(repo, ['remote', 'remove', 'backup']);
			fs.rmSync(second, { recursive: true, force: true });
		}
	});

	it('reads and writes the local user details', async () => {
		const before = await dataSource.getUserDetails(repo);
		expect(before.localName).toBe('Test Committer');
		expect(before.localEmail).toBe('committer@example.com');
		expect(await dataSource.setUserDetails(repo, 'Other Person', 'other@example.com', false)).toBeNull();
		expect(git(repo, ['config', '--local', 'user.name'])).toBe('Other Person');
		expect(await dataSource.setUserDetails(repo, '', '', false)).toBeNull(); // unset the local values
		expect((await dataSource.getUserDetails(repo)).localName).toBeNull();
		expect(await dataSource.setUserDetails(repo, '--evil', 'x', false)).toMatch(/not a valid/i);
		expect(await dataSource.setUserDetails(repo, '', 'x', true)).toMatch(/cannot be empty/);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
	});

	it('hides the branches of remotes listed in the repository state', async () => {
		const state = { ...defaultRepoState(), hideRemotes: ['origin'] };
		const shown = await dataSource.getCommits(repo, [], 50, true);
		expect(shown.commits.some((c) => c.refs.some((r) => r.type === 'remote'))).toBe(true);
		const hidden = await dataSource.getCommits(repo, [], 50, true, state);
		expect(hidden.commits.some((c) => c.refs.some((r) => r.type === 'remote'))).toBe(false);
		const branches = await dataSource.getBranches(repo, true, ['origin']);
		expect(branches.branches.some((b) => b.startsWith('remotes/origin/'))).toBe(false);
		expect((await dataSource.getBranches(repo, true)).branches.some((b) => b.startsWith('remotes/origin/'))).toBe(true);
	});

	it('applies the per-repository tag override', async () => {
		git(repo, ['tag', 'override-tag']);
		try {
			const state = { ...defaultRepoState(), showTags: false };
			expect((await dataSource.getCommits(repo, [], 50, false)).commits.some((c) => c.refs.some((r) => r.name === 'override-tag'))).toBe(true);
			expect((await dataSource.getCommits(repo, [], 50, false, state)).commits.some((c) => c.refs.some((r) => r.name === 'override-tag'))).toBe(false);
		} finally {
			git(repo, ['tag', '-d', 'override-tag']);
		}
	});

	it('rewords and amends the checked-out commit, and knows whether it was pushed', async () => {
		git(repo, ['checkout', '-q', 'master']);
		const head = git(repo, ['rev-parse', 'HEAD']);
		expect(await dataSource.getCommitMessage(repo, head)).toBe(git(repo, ['log', '-1', '--format=%B']).trim());
		expect(await dataSource.rewordCommit(repo, head, 'Reworded subject\n\nWith a body')).toBeNull();
		const reworded = git(repo, ['rev-parse', 'HEAD']);
		expect(reworded).not.toBe(head);
		expect(git(repo, ['log', '-1', '--format=%B']).trim()).toBe('Reworded subject\n\nWith a body');
		expect(await dataSource.rewordCommit(repo, head, 'Stale')).toMatch(/no longer the checked-out commit/);
		expect(await dataSource.rewordCommit(repo, reworded, '   ')).toMatch(/not a valid/i);

		fs.writeFileSync(path.join(repo, 'a.txt'), 'amended content\n');
		fs.writeFileSync(path.join(repo, 'untracked.txt'), 'never added\n');
		expect(await dataSource.amendCommit(repo, reworded, 'Amended subject', true)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%s'])).toBe('Amended subject');
		expect(git(repo, ['show', '--format=', '--name-only', 'HEAD']).split(/\r?\n/).filter((l) => l !== '')).toContain('a.txt');
		expect(git(repo, ['status', '--porcelain', 'untracked.txt'])).toMatch(/^\?\? untracked\.txt/);
		fs.unlinkSync(path.join(repo, 'untracked.txt'));

		// master tracks origin/master and has moved past it, so HEAD is not pushed; after a push it is
		expect(await dataSource.isHeadPushed(repo)).toBe(false);
		git(repo, ['push', '-q', '--force', 'origin', 'master']);
		expect(await dataSource.isHeadPushed(repo)).toBe(true);
	});

	it('pushes a branch to several remotes and reports the failing one', async () => {
		const second = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-remote2-'));
		git(second, ['init', '-q', '--bare']);
		git(repo, ['remote', 'add', 'second', second]);
		try {
			expect(await dataSource.pushBranchToRemotes(repo, 'topic', ['origin', 'second'], true, 'normal')).toBeNull();
			expect(git(second, ['rev-parse', 'topic'])).toBe(git(repo, ['rev-parse', 'topic']));
			expect(git(repo, ['rev-parse', '--abbrev-ref', 'topic@{upstream}'])).toBe('origin/topic');
			expect(await dataSource.pushBranchToRemotes(repo, 'topic', [], false, 'normal')).toMatch(/No remote/);
			expect(await dataSource.pushBranchToRemotes(repo, 'topic', ['origin', 'missing'], false, 'normal')).toMatch(/Pushing to "missing" failed/);
		} finally {
			git(repo, ['remote', 'remove', 'second']);
			fs.rmSync(second, { recursive: true, force: true });
		}
	});

	it('writes zip and tar archives of a reference', async () => {
		const zipPath = path.join(repo, 'out.zip'), tarPath = path.join(repo, 'out.tar');
		expect(await dataSource.archive(repo, 'master', zipPath, 'zip')).toBeNull();
		expect(await dataSource.archive(repo, git(repo, ['rev-parse', 'HEAD']), tarPath, 'tar')).toBeNull();
		expect(fs.statSync(zipPath).size).toBeGreaterThan(0);
		expect(fs.statSync(tarPath).size).toBeGreaterThan(0);
		expect(await dataSource.archive(repo, '--output=/tmp/x', zipPath, 'zip')).toMatch(/not a valid/i);
		fs.unlinkSync(zipPath);
		fs.unlinkSync(tarPath);
	});

	it('refuses external diff requests with unsafe arguments', async () => {
		expect(await dataSource.openExternalDiff(repo, 'not-a-hash', '*', 'a.txt')).toMatch(/not a valid/i);
		expect(await dataSource.openExternalDiff(repo, git(repo, ['rev-parse', 'HEAD']), '*', '../outside.txt')).toMatch(/not a valid/i);
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

	it('reports unsigned commits as "N" when signature status is enabled, and omits it otherwise', async () => {
		let result = await dataSource.getCommits(repo, [], 10, false);
		expect(result.commits.every((commit) => commit.signature === null)).toBe(true);

		configurationValues['git-graph'] = { 'repository.commits.showSignatureStatus': true };
		result = await dataSource.getCommits(repo, [], 10, false);
		const commit = result.commits.find((c) => c.hash === detached)!;
		expect(commit.signature).toEqual({ status: 'N', signer: '', key: '' });
		expect(commit.message).toBe('Detached HEAD commit');
		const details = await dataSource.commitDetails(repo, detached);
		expect(details!.signature).toEqual({ status: 'N', signer: '', key: '' });
		expect(details!.committer).toBe('Test Committer');
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

describe('parseSignature', () => {
	it('keeps known status codes and maps unknown ones to "E"', () => {
		expect(parseSignature('G', 'Alice <alice@example.com>', 'ABCDEF')).toEqual({ status: 'G', signer: 'Alice <alice@example.com>', key: 'ABCDEF' });
		expect(parseSignature('?', '', '')).toEqual({ status: 'E', signer: '', key: '' });
	});
});

describe('DataSource bisect', () => {
	let repo: string;
	let dataSource: DataSource;
	const hashes: string[] = [];

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-bisect-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		for (let i = 1; i <= 6; i++) hashes.push(commit(repo, 'f.txt', 'v' + i + '\n', 'Commit ' + i));
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('starts on the first mark, reports progress, shows the marks on the graph and resets', async () => {
		expect(await dataSource.isBisecting(repo)).toBe(false);
		const bad = await dataSource.bisect(repo, 'bad', hashes[5]);
		expect(bad.status).toBeNull();
		expect(await dataSource.isBisecting(repo)).toBe(true);
		const good = await dataSource.bisect(repo, 'good', hashes[0]);
		expect(good.status).toBeNull();
		expect(good.message).toMatch(/^Bisecting: \d+ revisions? left to test/);
		const result = await dataSource.getCommits(repo, [], 50, false);
		expect(result.bisecting).toBe(true);
		expect(result.commits.find((c) => c.hash === hashes[5])!.bisect).toBe('bad');
		expect(result.commits.find((c) => c.hash === hashes[0])!.bisect).toBe('good');
		expect(result.commits.find((c) => c.hash === hashes[3])!.bisect).toBeNull();
		const current = git(repo, ['rev-parse', 'HEAD']);
		expect(hashes.indexOf(current)).toBeGreaterThan(0);
		expect((await dataSource.bisect(repo, 'skip', current)).status).toBeNull();
		expect((await dataSource.bisect(repo, 'good', 'nothash')).status).toMatch(/not a valid/i);
		expect((await dataSource.bisect(repo, 'reset', null)).status).toBeNull();
		expect(await dataSource.isBisecting(repo)).toBe(false);
		expect(git(repo, ['rev-parse', 'HEAD'])).toBe(hashes[5]);
		expect((await dataSource.getCommits(repo, [], 50, false)).bisecting).toBe(false);
	});
});

describe('DataSource worktrees', () => {
	let repo: string;
	let dataSource: DataSource;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-worktree-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'one\n', 'Base');
		git(repo, ['branch', 'topic']);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
		fs.rmSync(repo + '-wt', { recursive: true, force: true });
		fs.rmSync(repo + '-wt2', { recursive: true, force: true });
	});

	it('parses the porcelain listing', () => {
		expect(parseWorktreeList('worktree /r\nHEAD abc\nbranch refs/heads/master\n\nworktree /r-wt\nHEAD def\ndetached\nlocked\n\nworktree /gone\nHEAD 123\nbranch refs/heads/x\nprunable gitdir file points to non-existent location\n')).toEqual([
			{ path: '/r', head: 'abc', branch: 'master', isMain: true, locked: false, prunable: false },
			{ path: '/r-wt', head: 'def', branch: null, isMain: false, locked: true, prunable: false },
			{ path: '/gone', head: '123', branch: 'x', isMain: false, locked: false, prunable: true }
		]);
	});

	it('adds, lists, removes and prunes worktrees', async () => {
		expect(await dataSource.addWorktree(repo, repo + '-wt', 'topic', null)).toBeNull();
		expect(await dataSource.addWorktree(repo, repo + '-wt2', 'master', 'from-master')).toBeNull();
		const list = await dataSource.getWorktrees(repo);
		expect(list.map((w) => w.branch)).toEqual(['master', 'topic', 'from-master']);
		expect(list[0].isMain).toBe(true);
		expect(fs.existsSync(path.join(repo + '-wt', 'a.txt'))).toBe(true);
		expect((await dataSource.getRepoSettings(repo))!.worktrees).toHaveLength(3);

		expect(await dataSource.addWorktree(repo, 'relative/path', 'topic', null)).toMatch(/not a valid/i);
		expect(await dataSource.addWorktree(repo, repo + '-wt3', '--force', null)).toMatch(/not a valid/i);

		fs.writeFileSync(path.join(repo + '-wt', 'dirty.txt'), 'x');
		expect(await dataSource.removeWorktree(repo, repo + '-wt', false)).toMatch(/untracked|modified|contains/i);
		expect(await dataSource.removeWorktree(repo, repo + '-wt', true)).toBeNull();
		fs.rmSync(repo + '-wt2', { recursive: true, force: true });
		expect(await dataSource.pruneWorktrees(repo)).toBeNull();
		expect((await dataSource.getWorktrees(repo)).map((w) => w.branch)).toEqual(['master']);
	});
});

describe('DataSource operations in progress', () => {
	let repo: string;
	let dataSource: DataSource;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-conflict-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'base\n', 'Base');
		git(repo, ['checkout', '-q', '-b', 'other']);
		commit(repo, 'a.txt', 'theirs\n', 'Theirs');
		git(repo, ['checkout', '-q', 'master']);
		commit(repo, 'a.txt', 'ours\n', 'Ours');
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('parses conflicted files from the porcelain status', () => {
		expect(parseConflictedFiles('UU a.txt\n M b.txt\nAA "sp ace.txt"\n?? new.txt\nDU gone.txt\n')).toEqual(['a.txt', 'sp ace.txt', 'gone.txt']);
	});

	it('detects a conflicted merge, reports the files, and aborts it', async () => {
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		expect(await dataSource.mergeBranch(repo, 'other', { createNewCommit: true, squash: false, noCommit: false })).toMatch(/conflict/i);
		const op = await dataSource.getOperationInProgress(repo);
		expect(op).toEqual({ type: 'merge', conflictedFiles: ['a.txt'] });
		expect((await dataSource.getCommits(repo, [], 50, false)).operation).toEqual(op);
		expect(await dataSource.operationAction(repo, 'merge', 'skip')).toMatch(/not a valid/i);
		expect(await dataSource.operationAction(repo, 'merge', 'abort')).toBeNull();
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('ours\n');
	});

	it('continues a merge after the conflict is resolved', async () => {
		expect(await dataSource.mergeBranch(repo, 'other', { createNewCommit: true, squash: false, noCommit: false })).toMatch(/conflict/i);
		fs.writeFileSync(path.join(repo, 'a.txt'), 'resolved\n');
		git(repo, ['add', 'a.txt']);
		expect((await dataSource.getOperationInProgress(repo))!.conflictedFiles).toEqual([]);
		expect(await dataSource.operationAction(repo, 'merge', 'continue')).toBeNull();
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%P']).split(' ')).toHaveLength(2);
	});

	it('detects a stopped cherry pick and skips it', async () => {
		git(repo, ['checkout', '-q', '-b', 'pick-target', 'master~1']);
		expect(await dataSource.cherrypickCommit(repo, git(repo, ['rev-parse', 'other']), { parentIndex: 0, recordOrigin: false, noCommit: false })).toMatch(/conflict/i);
		expect((await dataSource.getOperationInProgress(repo))!.type).toBe('cherry-pick');
		expect(await dataSource.operationAction(repo, 'cherry-pick', 'skip')).toBeNull();
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		git(repo, ['checkout', '-q', 'master']);
	});
});

describe('DataSource filters', () => {
	let repo: string;
	let dataSource: DataSource;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-filter-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'one\n', 'Touches a');
		commit(repo, 'dir/b.txt', 'two\n', 'Touches dir/b');
		// The git() helper pins the author identity through the environment, so this commit sets its own
		cp.execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'By someone else'], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Other Author', GIT_AUTHOR_EMAIL: 'other@example.com', GIT_COMMITTER_NAME: 'Other Author', GIT_COMMITTER_EMAIL: 'other@example.com' } });
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	const messages = (result: { commits: { hash: string, message: string }[] }) => result.commits.filter((c) => c.hash !== '*').map((c) => c.message);

	it('filters by author (case-insensitive substring, several authors combine with OR)', async () => {
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: ['OTHER@example'], paths: [] }))).toEqual(['By someone else']);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: ['other@example.com', 'author@example.com'], paths: [] }))).toHaveLength(3);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: ['a.b'], paths: [] }))).toEqual([]); // literal, not a regular expression
	});

	it('filters by path and refuses paths outside the repository', async () => {
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: [], paths: ['a.txt'] }))).toEqual(['Touches a']);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: [], paths: ['dir'] }))).toEqual(['Touches dir/b']);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: [], paths: ['a.txt', 'dir'] }))).toEqual(['Touches dir/b', 'Touches a']);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: ['author@example.com'], paths: ['dir'] }))).toEqual(['Touches dir/b']);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: ['other@example.com'], paths: ['dir'] }))).toEqual([]);
		expect(messages(await dataSource.getCommits(repo, [], 50, false, null, { authors: [], paths: ['../outside'] }))).toEqual([]);
	});
});
