import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, isGitAtLeast, parseMergeTreeOutput } from '../src/dataSource';
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

describe('conflict prediction helpers', () => {
	it('compares git versions', () => {
		expect(isGitAtLeast('git version 2.38.0', 2, 38)).toBe(true);
		expect(isGitAtLeast('git version 2.37.9 (Apple Git-1)', 2, 38)).toBe(false);
		expect(isGitAtLeast('git version 3.0.0', 2, 38)).toBe(true);
		expect(isGitAtLeast('git version 2.56.0.windows.1', 2, 38)).toBe(true);
		expect(isGitAtLeast(null, 2, 38)).toBe(false);
		expect(isGitAtLeast('nonsense', 2, 38)).toBe(false);
	});

	it('parses merge-tree output', () => {
		const tree = 'a'.repeat(40);
		expect(parseMergeTreeOutput(tree + '\n')).toEqual([]);
		expect(parseMergeTreeOutput(tree + '\na.txt\ndir/b.txt\n')).toEqual(['a.txt', 'dir/b.txt']);
		expect(parseMergeTreeOutput('')).toBeNull();
		expect(parseMergeTreeOutput('fatal: not something we can merge\n')).toBeNull();
	});
});

describe('DataSource.predictConflicts', () => {
	let repo: string, dataSource: DataSource, conflicting: string;

	beforeAll(async () => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-predict-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'C']);
		git(repo, ['config', 'user.email', 'c@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'line\n', 'base');
		git(repo, ['checkout', '-q', '-b', 'conflicting']);
		conflicting = commit(repo, 'a.txt', 'theirs\n', 'theirs');
		git(repo, ['checkout', '-q', 'master']);
		git(repo, ['checkout', '-q', '-b', 'clean']);
		commit(repo, 'b.txt', 'b\n', 'clean addition');
		git(repo, ['checkout', '-q', 'master']);
		commit(repo, 'a.txt', 'ours\n', 'ours');
		dataSource = new DataSource(new Logger());
		for (let i = 0; i < 100 && dataSource.getGitVersion() === null; i++) await new Promise((resolve) => setTimeout(resolve, 50));
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('names the files that would conflict and leaves the working tree alone', async () => {
		expect(dataSource.getGitVersion()).not.toBeNull();
		expect(await dataSource.predictConflicts(repo, 'conflicting', 'Branch')).toEqual(['a.txt']);
		expect(await dataSource.predictConflicts(repo, conflicting, 'Commit')).toEqual(['a.txt']);
		expect(await dataSource.predictConflicts(repo, 'clean', 'Branch')).toEqual([]);
		expect(git(repo, ['status', '--porcelain'])).toBe('');
		expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('ours\n');
	});

	it('answers null for invalid or unknown targets', async () => {
		expect(await dataSource.predictConflicts(repo, '--output=/tmp/x', 'Branch')).toBeNull();
		expect(await dataSource.predictConflicts(repo, 'HEAD', 'Commit')).toBeNull();
		expect(await dataSource.predictConflicts(repo, 'no-such-branch', 'Branch')).toBeNull();
	});
});
