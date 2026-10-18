import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AskpassManager } from '../src/askpassManager';
import { gpgWrapperArgs, isSigningFailure, withSigningHint } from '../src/gpgSigning';
import { Logger } from '../src/logger';

const WRAPPER = path.join(__dirname, '..', 'resources', 'gpg-wrapper.js');

function runWrapper(args: string[], env: NodeJS.ProcessEnv, input: string) {
	return new Promise<{ code: number, stdout: string, stderr: string }>((resolve) => {
		const child = cp.execFile(process.execPath, [WRAPPER, ...args], { env }, (error, stdout, stderr) => {
			resolve({ code: error && typeof (<{ code?: number }>error).code === 'number' ? <number>(<{ code?: number }>error).code : error ? 1 : 0, stdout: stdout.toString(), stderr: stderr.toString() });
		});
		child.stdin!.end(input);
	});
}

describe('gpg wrapper', () => {
	let dir: string, fakeGpg: string, manager: AskpassManager;
	const prompts: string[] = [];
	let answers: (string | null)[] = [];

	beforeAll(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-gpg-'));
		const fakeJs = path.join(dir, 'fake-gpg.js');
		fs.writeFileSync(fakeJs, `
const fs = require('fs');
const args = process.argv.slice(2);
if (args.indexOf('--verify') !== -1) { process.stdout.write('verify-ok'); process.exit(0); }
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
	const payload = Buffer.concat(chunks).toString();
	if (args.indexOf('--pinentry-mode') === -1) {
		process.stderr.write('gpg: signing failed: Inappropriate ioctl for device\\n[GNUPG:] FAILURE sign 83918950\\n');
		process.exit(2);
	}
	const passphrase = fs.readFileSync(3, 'utf8').trim();
	if (passphrase === 'secret') {
		process.stdout.write('-----BEGIN PGP SIGNATURE-----\\nlen=' + payload.length + '\\n');
		process.stderr.write('[GNUPG:] SIG_CREATED D\\n');
		process.exit(0);
	}
	process.stderr.write('[GNUPG:] BAD_PASSPHRASE 0\\ngpg: signing failed: Bad passphrase\\n');
	process.exit(2);
});
`);
		fakeGpg = path.join(dir, 'fake-gpg.sh');
		fs.writeFileSync(fakeGpg, '#!/bin/sh\nexec "' + process.execPath + '" "' + fakeJs + '" "$@"\n');
		fs.chmodSync(fakeGpg, 0o755);
		manager = new AskpassManager(path.join(__dirname, '..'), async (prompt) => { prompts.push(prompt); return answers.length > 0 ? answers.shift()! : null; }, new Logger());
		await manager.start();
	});

	afterAll(() => {
		manager.dispose();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	const env = () => ({ ...process.env, ...manager.getPipeEnvironment(), GIT_GRAPH_GPG_PROGRAM: fakeGpg });

	it('asks for the passphrase when gpg cannot prompt, retries after a wrong one, and signs the original input', async () => {
		prompts.length = 0;
		answers = ['wrong', 'secret'];
		const result = await runWrapper(['--status-fd=2', '-bsau', 'ABCDEF01'], env(), 'commit data!');
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('-----BEGIN PGP SIGNATURE-----');
		expect(result.stdout).toContain('len=12');
		expect(result.stderr).toContain('SIG_CREATED');
		expect(prompts).toEqual(['Passphrase for the GPG key ABCDEF01 (git needs it to sign)', 'Wrong passphrase. Passphrase for the GPG key ABCDEF01']);
	});

	it('reports the original failure when the prompt is cancelled', async () => {
		prompts.length = 0;
		answers = [null];
		const result = await runWrapper(['--status-fd=2', '-bsau', 'KEY'], env(), 'data');
		expect(result.code).toBe(2);
		expect(result.stderr).toContain('Inappropriate ioctl');
		expect(prompts.length).toBe(1);
	});

	it('passes non-signing calls through without asking', async () => {
		prompts.length = 0;
		const result = await runWrapper(['--keyid-format=long', '--status-fd=1', '--verify', 'sig', '-'], env(), '');
		expect(result.code).toBe(0);
		expect(result.stdout).toBe('verify-ok');
		expect(prompts.length).toBe(0);
	});

	it('fails like gpg when no prompt pipe is available', async () => {
		const noPipe: NodeJS.ProcessEnv = { ...process.env, GIT_GRAPH_GPG_PROGRAM: fakeGpg };
		delete noPipe.GIT_GRAPH_ASKPASS_PIPE;
		delete noPipe.GIT_GRAPH_ASKPASS_NONCE;
		const result = await runWrapper(['-bsau', 'KEY'], noPipe, 'data');
		expect(result.code).toBe(2);
		expect(result.stderr).toContain('Inappropriate ioctl');
	});
});

describe('gpg signing helpers', () => {
	it('recognises signing failures and adds the hint', () => {
		expect(isSigningFailure('error: gpg failed to sign the data\nfatal: failed to write commit object')).toBe(true);
		expect(isSigningFailure('CONFLICT (content): Merge conflict in a.txt')).toBe(false);
		expect(withSigningHint('error: gpg failed to sign the data', true)).toMatch(/input box/);
		expect(withSigningHint('error: gpg failed to sign the data', false)).toMatch(/git-graph\.gpg\.passphrasePrompt/);
		expect(withSigningHint('nothing to commit', true)).toBe('nothing to commit');
		expect(gpgWrapperArgs('/ext')).toEqual(['-c', 'gpg.program=' + path.join('/ext', 'resources', 'gpg-wrapper.sh')]);
	});
});
