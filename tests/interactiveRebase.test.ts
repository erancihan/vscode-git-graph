import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, parseRebaseRange } from '../src/dataSource';
import { Logger } from '../src/logger';
import { GitRebaseTodoEntry } from '../src/types';

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

/** Subjects of the commits reachable from HEAD, oldest first. */
function subjects(repo: string) {
	return git(repo, ['log', '--reverse', '--format=%s']).split('\n');
}

function rebaseTempDirs() {
	return fs.readdirSync(os.tmpdir()).filter((name) => name.indexOf('git-graph-rebase-') === 0).length;
}

describe('parseRebaseRange', () => {
	it('reads hash, parent count and subject', () => {
		expect(parseRebaseRange('a\x1fb\x1fSubject\n')).toEqual([{ hash: 'a', parents: 1, subject: 'Subject' }]);
		expect(parseRebaseRange('a\x1fb c\x1fMerge\nd\x1f\x1fRoot\n')).toEqual([{ hash: 'a', parents: 2, subject: 'Merge' }, { hash: 'd', parents: 0, subject: 'Root' }]);
	});
});

describe('interactive rebase editor (DataSource)', () => {
	let repo: string, dataSource: DataSource;
	let a: string, b: string, c: string, d: string;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-irebase-'));
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'Test Committer']);
		git(repo, ['config', 'user.email', 'committer@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		git(repo, ['config', 'rebase.autosquash', 'false']);
		a = commit(repo, 'a.txt', 'a\n', 'A: first');
		b = commit(repo, 'b.txt', 'b\n', 'B: second');
		c = commit(repo, 'c.txt', 'c\n', 'C: third');
		d = commit(repo, 'd.txt', 'd\n', 'D: fourth');
		dataSource = new DataSource(new Logger());
		dataSource.setExtensionPath(path.join(__dirname, '..'));
	});

	afterAll(() => {
		dataSource.dispose();
		fs.rmSync(repo, { recursive: true, force: true });
	});

	beforeEach(() => {
		if (fs.existsSync(path.join(repo, '.git', 'rebase-merge'))) git(repo, ['rebase', '--abort']);
		git(repo, ['checkout', '-q', 'master']);
		git(repo, ['reset', '-q', '--hard', d]);
	});

	it('lists the commits after the base as picks, oldest first', async () => {
		const result = await dataSource.getRebaseTodo(repo, a);
		expect(result.error).toBeNull();
		expect(result.headHash).toBe(d);
		expect(result.todo!.map((entry) => entry.action + ' ' + entry.hash + ' ' + entry.subject)).toEqual(['pick ' + b + ' B: second', 'pick ' + c + ' C: third', 'pick ' + d + ' D: fourth']);
		expect(result.todo!.every((entry) => entry.message === null)).toBe(true);
	});

	it('refuses bases that are not ancestors, HEAD itself, and merge commits in the range', async () => {
		expect((await dataSource.getRebaseTodo(repo, d)).error).toMatch(/no commits after/);
		expect((await dataSource.getRebaseTodo(repo, 'HEAD')).error).toMatch(/Invalid/);
		git(repo, ['checkout', '-q', '-b', 'side', a]);
		const side = commit(repo, 's.txt', 's\n', 'S: side');
		git(repo, ['checkout', '-q', 'master']);
		expect((await dataSource.getRebaseTodo(repo, side)).error).toMatch(/not an ancestor/);
		git(repo, ['merge', '-q', '--no-ff', '-m', 'M: merge', 'side']);
		expect((await dataSource.getRebaseTodo(repo, a)).error).toMatch(/merge commit/);
		git(repo, ['branch', '-D', 'side']);
	});

	it('applies autosquash when rebase.autosquash is set', async () => {
		commit(repo, 'b.txt', 'b2\n', 'fixup! B: second');
		expect((await dataSource.getRebaseTodo(repo, a)).todo!.map((entry) => entry.action)).toEqual(['pick', 'pick', 'pick', 'pick']);
		git(repo, ['config', 'rebase.autosquash', 'true']);
		const todo = (await dataSource.getRebaseTodo(repo, a)).todo!;
		git(repo, ['config', 'rebase.autosquash', 'false']);
		expect(todo.map((entry) => entry.action + ' ' + entry.subject)).toEqual(['pick B: second', 'fixup fixup! B: second', 'pick C: third', 'pick D: fourth']);
	});

	it('reorders, rewords, squashes and drops without opening an editor', async () => {
		const before = rebaseTempDirs();
		const todo: GitRebaseTodoEntry[] = [
			{ action: 'reword', hash: b, subject: 'B: second', message: 'B: reworded\n\nWith a body.' },
			{ action: 'pick', hash: d, subject: 'D: fourth', message: null },
			{ action: 'squash', hash: c, subject: 'C: third', message: 'C and D together' }
		];
		expect(await dataSource.interactiveRebase(repo, a, d, todo)).toBeNull();
		expect(subjects(repo)).toEqual(['A: first', 'B: reworded', 'C and D together']);
		expect(git(repo, ['log', '-1', '--format=%B', 'HEAD~1'])).toBe('B: reworded\n\nWith a body.');
		expect(fs.readdirSync(repo).filter((name) => name.endsWith('.txt')).sort()).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt']);
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		expect(rebaseTempDirs()).toBe(before);

		expect(await dataSource.interactiveRebase(repo, a, git(repo, ['rev-parse', 'HEAD']), [
			{ action: 'drop', hash: git(repo, ['rev-parse', 'HEAD~1']), subject: '', message: null },
			{ action: 'pick', hash: git(repo, ['rev-parse', 'HEAD']), subject: '', message: null }
		])).toBeNull();
		expect(subjects(repo)).toEqual(['A: first', 'C and D together']);
		expect(fs.existsSync(path.join(repo, 'b.txt'))).toBe(false);
	});

	it('keeps the combined message of a squash group without a message', async () => {
		expect(await dataSource.interactiveRebase(repo, a, d, [
			{ action: 'pick', hash: b, subject: 'B: second', message: null },
			{ action: 'squash', hash: c, subject: 'C: third', message: null },
			{ action: 'fixup', hash: d, subject: 'D: fourth', message: null }
		])).toBeNull();
		expect(subjects(repo)).toEqual(['A: first', 'B: second']);
		expect(git(repo, ['log', '-1', '--format=%B'])).toMatch(/B: second[\s\S]*C: third/);
		expect(git(repo, ['log', '-1', '--format=%B'])).not.toMatch(/D: fourth/);
	});

	it('refuses stale or inconsistent requests without touching the branch', async () => {
		const pick = (hash: string): GitRebaseTodoEntry => ({ action: 'pick', hash: hash, subject: '', message: null });
		expect(await dataSource.interactiveRebase(repo, a, c, [pick(b), pick(c), pick(d)])).toMatch(/HEAD\) changed/);
		expect(await dataSource.interactiveRebase(repo, a, d, [pick(b), pick(c)])).toMatch(/does not cover/);
		expect(await dataSource.interactiveRebase(repo, a, d, [pick(b), pick(c), pick(a)])).toMatch(/not part of the rebase/);
		expect(await dataSource.interactiveRebase(repo, a, d, [{ ...pick(b), action: 'drop' }, { ...pick(c), action: 'drop' }, { ...pick(d), action: 'drop' }])).toMatch(/Every commit is dropped/);
		expect(await dataSource.interactiveRebase(repo, a, d, [{ ...pick(b), action: 'squash' }, pick(c), pick(d)])).toMatch(/first commit/);
		expect(await dataSource.interactiveRebase(repo, 'master', d, [pick(b), pick(c), pick(d)])).toMatch(/not a valid reference name or commit hash/);
		expect(git(repo, ['rev-parse', 'HEAD'])).toBe(d);
	});

	it('stops for "edit" and hands over to the operation bar, then cleans up on continue', async () => {
		const before = rebaseTempDirs();
		const status = await dataSource.interactiveRebase(repo, a, d, [
			{ action: 'pick', hash: b, subject: '', message: null },
			{ action: 'edit', hash: c, subject: '', message: null },
			{ action: 'pick', hash: d, subject: '', message: null }
		]);
		expect(status).toBeNull();
		expect((await dataSource.getOperationInProgress(repo))!.type).toBe('rebase');
		expect(git(repo, ['rev-parse', 'HEAD'])).toBe(c);
		expect(rebaseTempDirs()).toBe(before + 1);
		expect(await dataSource.operationAction(repo, 'rebase', 'continue')).toBeNull();
		expect(await dataSource.getOperationInProgress(repo)).toBeNull();
		expect(subjects(repo)).toEqual(['A: first', 'B: second', 'C: third', 'D: fourth']);
		expect(rebaseTempDirs()).toBe(before);
	});

	it('folds a commit into its parent', async () => {
		expect(await dataSource.fixupCommit(repo, c)).toBeNull();
		expect(subjects(repo)).toEqual(['A: first', 'B: second', 'D: fourth']);
		expect(git(repo, ['show', '--stat', '--format=', 'HEAD~1'])).toMatch(/c\.txt/);
		expect(await dataSource.fixupCommit(repo, b)).toMatch(/first commit of the repository/);
		expect(await dataSource.fixupCommit(repo, a)).toMatch(/no parent/);
	});
});
