import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findGitExecutable } from '../src/gitExecutable';

/** A fake "git" that answers --version with exit code 0, or a broken one that exits with 1. */
function fakeGit(dir: string, name: string, works: boolean) {
	const file = path.join(dir, name);
	fs.writeFileSync(file, '#!/bin/sh\nexit ' + (works ? '0' : '1') + '\n', { mode: 0o755 });
	return file;
}

const realGit = cp.execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
const posix = process.platform !== 'win32';
const describePosix = posix ? describe : describe.skip;

describePosix('findGitExecutable', () => {
	let dir: string;

	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-exe-'));
	});

	afterAll(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('uses the first configured path that runs', async () => {
		const broken = fakeGit(dir, 'broken-git', false), good = fakeGit(dir, 'good-git', true);
		expect(await findGitExecutable([path.join(dir, 'missing'), broken, good], { platform: 'linux', env: { PATH: '' } })).toBe(good);
	});

	it('falls back to git on PATH when nothing is configured', async () => {
		const found = await findGitExecutable([], { platform: 'linux', env: { PATH: path.dirname(realGit) } });
		expect(found).toBe(path.join(path.dirname(realGit), 'git'));
	});

	it('searches PATH in order and skips directories without a working git', async () => {
		const first = fs.mkdtempSync(path.join(dir, 'a-')), second = fs.mkdtempSync(path.join(dir, 'b-'));
		fakeGit(second, 'git', true);
		const found = await findGitExecutable([], { platform: 'linux', env: { PATH: first + path.delimiter + second } });
		expect(found).toBe(path.join(second, 'git'));
	});

	it('returns git when nothing can be found', async () => {
		// win32 without ProgramFiles variables has no well-known locations, so only the configured path and PATH are checked
		expect(await findGitExecutable([path.join(dir, 'missing')], { platform: 'win32', env: { PATH: dir } })).toBe('git');
	});

	it('looks in the Git for Windows install locations on win32', async () => {
		// The lookup joins <root>/Git/cmd/git.exe; place a working script there and point ProgramFiles at the root.
		const root = fs.mkdtempSync(path.join(dir, 'pf-'));
		fs.mkdirSync(path.join(root, 'Git', 'cmd'), { recursive: true });
		const exe = fakeGit(path.join(root, 'Git', 'cmd'), 'git.exe', true);
		expect(await findGitExecutable([], { platform: 'win32', env: { PATH: '', ProgramFiles: root } })).toBe(exe);
	});
});
