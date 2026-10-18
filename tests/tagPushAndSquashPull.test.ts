import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from '../src/dataSource';
import { Logger } from '../src/logger';
import { configurationValues } from './mocks/vscode';

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

describe('tag push on add and squash pull', () => {
	let root: string, repo: string, remote: string, dataSource: DataSource;

	beforeAll(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-tagpull-'));
		repo = path.join(root, 'repo');
		remote = path.join(root, 'remote.git');
		fs.mkdirSync(repo);
		git(repo, ['init', '-q', '-b', 'master']);
		git(repo, ['config', 'user.name', 'C']);
		git(repo, ['config', 'user.email', 'c@example.com']);
		git(repo, ['config', 'commit.gpgsign', 'false']);
		commit(repo, 'a.txt', 'a\n', 'A');
		cp.execFileSync('git', ['init', '-q', '--bare', remote]);
		git(repo, ['remote', 'add', 'origin', remote]);
		git(repo, ['push', '-q', 'origin', 'master']);
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		delete configurationValues['git-graph'];
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('pushes a new tag to the chosen remote', async () => {
		const head = git(repo, ['rev-parse', 'HEAD']);
		expect(await dataSource.addTag(repo, 'v1', head, true, '', 'origin')).toBeNull();
		expect(cp.execFileSync('git', ['tag'], { cwd: remote, encoding: 'utf8' }).trim()).toBe('v1');
		expect(await dataSource.addTag(repo, 'v2', head, false, 'second', null)).toBeNull();
		expect(cp.execFileSync('git', ['tag'], { cwd: remote, encoding: 'utf8' }).trim()).toBe('v1');
		expect(await dataSource.addTag(repo, 'v3', head, true, '', '--upload-pack=x')).toMatch(/not a valid reference/);
	});

	it('commits a squash pull with the default message or SQUASH_MSG', async () => {
		// A feature branch on the remote with two commits
		git(repo, ['checkout', '-q', '-b', 'feature']);
		commit(repo, 'b.txt', 'b\n', 'B');
		commit(repo, 'c.txt', 'c\n', 'C');
		git(repo, ['push', '-q', 'origin', 'feature']);
		git(repo, ['checkout', '-q', 'master']);
		git(repo, ['branch', '-D', 'feature']);

		expect(await dataSource.pullBranch(repo, 'feature', 'origin', false, true)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%s'])).toBe('Merge remote-tracking branch \'origin/feature\'');
		expect(git(repo, ['status', '--porcelain'])).toBe('');
		expect(fs.existsSync(path.join(repo, 'c.txt'))).toBe(true);

		git(repo, ['reset', '-q', '--hard', 'HEAD~1']);
		configurationValues['git-graph'] = { 'dialog.pullBranch.squashMessageFormat': 'Git SQUASH_MSG' };
		expect(await dataSource.pullBranch(repo, 'feature', 'origin', false, true)).toBeNull();
		expect(git(repo, ['log', '-1', '--format=%B'])).toMatch(/Squashed commit[\s\S]*C[\s\S]*B/);
	});
});
