import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from '../src/dataSource';
import { Logger } from '../src/logger';

/**
 * The Repository Settings widget reads user.name and user.email through `git config`, so values
 * that arrive through `include.path` and `includeIf` directives are seen, and no global .gitconfig
 * is needed. This test documents that behaviour (issue #18, upstream items #281 and #376).
 */
describe('git config includes', () => {
	let repo: string, dataSource: DataSource;

	beforeAll(() => {
		repo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-includes-'));
		cp.execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: repo });
		fs.writeFileSync(path.join(repo, '.git', 'identity.config'), '[user]\n\tname = Included Name\n\temail = included@example.com\n');
		cp.execFileSync('git', ['config', '--local', 'include.path', 'identity.config'], { cwd: repo });
		dataSource = new DataSource(new Logger());
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it('reads user details that come from an included file', async () => {
		const details = await dataSource.getUserDetails(repo);
		expect(details.localName).toBe('Included Name');
		expect(details.localEmail).toBe('included@example.com');
	});

	it('does not require a global configuration file', async () => {
		const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-home-'));
		const original = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL };
		process.env.HOME = home;
		process.env.XDG_CONFIG_HOME = home;
		process.env.GIT_CONFIG_GLOBAL = path.join(home, 'missing.gitconfig');
		try {
			const details = await dataSource.getUserDetails(repo);
			expect(details.globalName).toBeNull();
			expect(details.globalEmail).toBeNull();
			expect(details.localName).toBe('Included Name');
		} finally {
			for (const key of Object.keys(original) as (keyof typeof original)[]) {
				if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
			}
			fs.rmSync(home, { recursive: true, force: true });
		}
	});
});
