import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from '../src/dataSource';
import { Logger } from '../src/logger';
import { configurationValues } from './mocks/vscode';

describe('commit details dates and committer', () => {
	let repo: string, dataSource: DataSource, hash: string;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-details-'));
		const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: repo, XDG_CONFIG_HOME: repo, GIT_AUTHOR_NAME: 'Ada Author', GIT_AUTHOR_EMAIL: 'ada@example.com', GIT_AUTHOR_DATE: '1700000000 +0000', GIT_COMMITTER_NAME: 'Cy Committer', GIT_COMMITTER_EMAIL: 'cy@example.com', GIT_COMMITTER_DATE: '1700003600 +0000' };
		cp.execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: repo, env });
		cp.execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo, env });
		fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
		cp.execFileSync('git', ['add', 'a.txt'], { cwd: repo, env });
		cp.execFileSync('git', ['commit', '-q', '-m', 'Subject\n\nBody line'], { cwd: repo, env });
		hash = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, env, encoding: 'utf8' }).trim();
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		delete configurationValues['git-graph'];
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('returns both dates and both people', async () => {
		const details = (await dataSource.commitDetails(repo, hash))!;
		expect(details.author).toBe('Ada Author');
		expect(details.email).toBe('ada@example.com');
		expect(details.committer).toBe('Cy Committer');
		expect(details.committerEmail).toBe('cy@example.com');
		expect(details.authorDate).toBe(1700000000);
		expect(details.commitDate).toBe(1700003600);
		expect(details.date).toBe(1700000000); // default date type is the author date
		expect(details.body).toBe('Subject\n\nBody line');
	});

	it('follows git-graph.date.type for the main date', async () => {
		configurationValues['git-graph'] = { 'date.type': 'Commit Date' };
		const details = (await dataSource.commitDetails(repo, hash))!;
		expect(details.date).toBe(1700003600);
		expect(details.authorDate).toBe(1700000000);
	});
});
