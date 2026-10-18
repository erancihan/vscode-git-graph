import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from '../src/dataSource';
import { Logger } from '../src/logger';

function git(repo: string, args: string[]) {
	return cp.execFileSync('git', ['-c', 'color.ui=false', ...args], {
		cwd: repo, encoding: 'utf8',
		env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@example.com', GIT_COMMITTER_NAME: 'C', GIT_COMMITTER_EMAIL: 'c@example.com', GIT_CONFIG_NOSYSTEM: '1', HOME: repo, XDG_CONFIG_HOME: repo }
	}).trim();
}
function commit(repo: string, file: string, content: string, message: string) {
	fs.writeFileSync(path.join(repo, file), content);
	git(repo, ['add', file]);
	git(repo, ['commit', '-q', '-m', message]);
	return git(repo, ['rev-parse', 'HEAD']);
}

describe('uncommitted changes rows of other worktrees', () => {
	let root: string, repo: string, worktree: string, dataSource: DataSource;
	let a: string, b: string, c: string;

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-wt-'));
		repo = path.join(root, 'main');
		worktree = path.join(root, 'feature-wt');
		fs.mkdirSync(repo);
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'C']);
		git(repo, ['config', 'user.email', 'c@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		a = commit(repo, 'a.txt', 'a\n', 'A');
		b = commit(repo, 'b.txt', 'b\n', 'B');
		c = commit(repo, 'c.txt', 'c\n', 'C');
		git(repo, ['worktree', 'add', '-q', '--detach', worktree, b]);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	const load = async (maxCommits = 300) => (await dataSource.getCommits(repo, ['master'], maxCommits, false)).commits;

	it('adds no row while the other worktree is clean', async () => {
		const commits = await load();
		expect(commits.map((commit) => commit.hash)).toEqual([c, b, a]);
		expect(commits.every((commit) => commit.worktree === null)).toBe(true);
	});

	it('adds a row above the commit the dirty worktree has checked out', async () => {
		fs.writeFileSync(path.join(worktree, 'a.txt'), 'changed\n');
		const commits = await load();
		expect(commits.map((commit) => commit.hash.charAt(0) === '*' ? '*' : commit.hash)).toEqual([c, '*', b, a]);
		const row = commits[1];
		expect(row.worktree).toEqual({ path: fs.realpathSync(worktree), name: 'feature-wt' });
		expect(row.parentHashes).toEqual([b]);
		expect(row.message).toBe('Uncommitted Changes in feature-wt (1)');
		expect(row.refs).toEqual([]);
		// The main repository is still clean, so there is no plain "Uncommitted Changes" row
		expect(commits.some((commit) => commit.hash === '*')).toBe(false);
	});

	it('adds no row when the checked-out commit is not loaded', async () => {
		const commits = await load(1);
		expect(commits.filter((commit) => commit.worktree !== null)).toEqual([]);
	});
});
