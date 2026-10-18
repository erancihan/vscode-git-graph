import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from '../src/dataSource';
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
		const result = await dataSource.getCommits(repo, '', 2, false);
		expect(result.moreCommitsAvailable).toBe(true);
		expect(result.commits.map(c => c.hash)).toEqual([third, second]);
		expect(result.head).toBe(second);
		const refs = result.commits[1].refs.map(r => r.type + ':' + r.name).sort();
		expect(refs).toEqual(['head:master', 'tag:v1']);
		expect(result.commits[0].refs.map(r => r.name)).toEqual(['feature/it\'s-here']);
	});

	it('loads commits of a single branch', async () => {
		const result = await dataSource.getCommits(repo, 'master', 10, false);
		expect(result.moreCommitsAvailable).toBe(false);
		expect(result.commits.map(c => c.hash)).toEqual([second, first]);
	});

	it('returns commit details including file changes', async () => {
		const details = await dataSource.commitDetails(repo, second);
		expect(details).not.toBeNull();
		expect(details!.author).toBe('Test Author');
		expect(details!.committer).toBe('Test Committer');
		expect(details!.body).toBe('Second commit with "quotes" and \'apostrophes\'');
		expect(details!.fileChanges).toEqual([{ oldFilePath: 'b.txt', newFilePath: 'b.txt', type: 'A', additions: 1, deletions: 0 }]);
	});

	it('returns the content of a file at a commit', async () => {
		expect(await dataSource.getCommitFile(repo, third, 'a.txt')).toBe('one\nthree\n');
		expect(await dataSource.getCommitFile(repo, first, 'missing.txt')).toBe('');
	});

	it('passes ref names with quotes and messages with spaces through unchanged', async () => {
		expect(await dataSource.createBranch(repo, 'it\'s-a-"branch"', first)).toBeNull();
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
		expect(await dataSource.createBranch(repo, '--help', first)).toMatch(/not a valid/i);
		expect(await dataSource.checkoutBranch(repo, '-b', null)).toMatch(/not a valid/i);
		expect(await dataSource.deleteBranch(repo, '--force', false)).toMatch(/not a valid/i);
		expect(await dataSource.mergeBranch(repo, '--squash', false)).toMatch(/not a valid/i);
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
		const result = await dataSource.getCommits(repo, '', 10, false);
		expect(result.head).toBe(detached);
		expect(result.commits.map(c => c.hash)).toEqual(expect.arrayContaining([detached, tagOnly, base]));
	});

	it('attaches annotated tags to the tagged commit exactly once', async () => {
		const result = await dataSource.getCommits(repo, '', 10, false);
		const tagged = result.commits.find(c => c.hash === tagOnly)!;
		expect(tagged.refs).toEqual([{ hash: tagOnly, name: 'annotated-tag', type: 'tag' }]);
	});

	it('hides commits only reachable from tags when the setting is off', async () => {
		configurationValues['git-graph'] = { 'repository.showCommitsOnlyReferencedByTags': false };
		const result = await dataSource.getCommits(repo, '', 10, false);
		expect(result.commits.map(c => c.hash)).not.toContain(tagOnly);
		expect(result.commits.map(c => c.hash)).toContain(detached);
	});

	it('hides tags when the setting is off', async () => {
		configurationValues['git-graph'] = { 'repository.showTags': false };
		const result = await dataSource.getCommits(repo, '', 10, false);
		expect(result.commits.every(c => c.refs.every(r => r.type !== 'tag'))).toBe(true);
	});

	it('applies the mailmap when enabled', async () => {
		fs.writeFileSync(path.join(repo, '.mailmap'), 'Mapped Name <mapped@example.com> <author@example.com>\n');
		try {
			let result = await dataSource.getCommits(repo, '', 10, false);
			expect(result.commits.find(c => c.hash === base)!.author).toBe('Test Author');
			configurationValues['git-graph'] = { 'repository.useMailmap': true };
			result = await dataSource.getCommits(repo, '', 10, false);
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
			let result = await dataSource.getCommits(repo, '', 10, false);
			expect(result.commits[0].hash).toBe('*');
			expect(result.commits[0].message).toBe('Uncommitted Changes (1)');
			configurationValues['git-graph'] = { 'repository.showUntrackedFiles': false };
			result = await dataSource.getCommits(repo, '', 10, false);
			expect(result.commits[0].hash).not.toBe('*');
		} finally {
			fs.unlinkSync(path.join(repo, 'untracked.txt'));
		}
	});

	it('passes the configured ordering to git log', async () => {
		configurationValues['git-graph'] = { 'repository.commits.order': 'topo' };
		await dataSource.getCommits(repo, '', 10, false);
		const lines = outputChannelLines['Git Graph'];
		expect(lines.some(l => l.includes(' log ') && l.includes('--topo-order'))).toBe(true);
		configurationValues['git-graph'] = { 'commitOrdering': 'author-date' };
		await dataSource.getCommits(repo, '', 10, false);
		expect(lines.slice(-4).some(l => l.includes('--author-date-order'))).toBe(true);
	});
});
