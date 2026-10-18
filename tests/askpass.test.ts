import * as fs from 'fs';
import * as net from 'net';
import { parseAskpassRequest, requestCredential } from '../src/askpassClient';
import { AskpassManager, createPipePath, isPasswordPrompt } from '../src/askpassManager';
import { Logger } from '../src/logger';

describe('askpass helpers', () => {
	it('recognises secret prompts', () => {
		expect(isPasswordPrompt("Password for 'https://user@github.com': ")).toBe(true);
		expect(isPasswordPrompt('Enter passphrase for key: ')).toBe(true);
		expect(isPasswordPrompt("Username for 'https://github.com': ")).toBe(false);
	});

	it('parses requests strictly', () => {
		expect(parseAskpassRequest('{"nonce":"n","prompt":"p"}')).toEqual({ nonce: 'n', prompt: 'p' });
		expect(parseAskpassRequest('{"nonce":1,"prompt":"p"}')).toBeNull();
		expect(parseAskpassRequest('nope')).toBeNull();
	});

	it('creates a random pipe path per call', () => {
		expect(createPipePath()).not.toBe(createPipePath());
	});
});

describe('AskpassManager', () => {
	const prompts: string[] = [];
	let manager: AskpassManager, env: { [key: string]: string };

	beforeAll(async () => {
		manager = new AskpassManager('/ext', async (prompt, isPassword) => {
			prompts.push(prompt + (isPassword ? ' [secret]' : ''));
			return prompt.indexOf('cancel') > -1 ? null : 'answer-for-' + prompt;
		}, new Logger());
		await manager.start();
		env = manager.getEnvironment();
	});

	afterAll(() => {
		manager.dispose();
	});

	it('exposes the environment for git', () => {
		expect(env['GIT_ASKPASS']).toMatch(/askpass\.sh$/);
		expect(env['GIT_GRAPH_ASKPASS_MAIN']).toMatch(/askpassMain\.js$/);
		expect(env['GIT_TERMINAL_PROMPT']).toBe('0');
		expect(env['GIT_GRAPH_ASKPASS_NONCE']).toHaveLength(48);
		if (process.platform !== 'win32') expect(fs.existsSync(env['GIT_GRAPH_ASKPASS_PIPE'])).toBe(true);
	});

	it('answers a request with the right nonce and marks password prompts', async () => {
		await expect(requestCredential(env['GIT_GRAPH_ASKPASS_PIPE'], env['GIT_GRAPH_ASKPASS_NONCE'], 'Username for x: ')).resolves.toBe('answer-for-Username for x: ');
		await expect(requestCredential(env['GIT_GRAPH_ASKPASS_PIPE'], env['GIT_GRAPH_ASKPASS_NONCE'], 'Password for x: ')).resolves.toBe('answer-for-Password for x: ');
		expect(prompts).toEqual(['Username for x: ', 'Password for x:  [secret]']);
	});

	it('refuses a wrong nonce and reports cancellation', async () => {
		await expect(requestCredential(env['GIT_GRAPH_ASKPASS_PIPE'], 'wrong', 'Username: ')).rejects.toThrow(/cancelled/);
		expect(prompts).toHaveLength(2); // the handler was not called
		await expect(requestCredential(env['GIT_GRAPH_ASKPASS_PIPE'], env['GIT_GRAPH_ASKPASS_NONCE'], 'please cancel')).rejects.toThrow(/cancelled/);
	});

	it('ignores garbage from a client', async () => {
		await new Promise<void>((resolve) => {
			const socket = net.createConnection(env['GIT_GRAPH_ASKPASS_PIPE']);
			socket.setEncoding('utf8');
			socket.on('connect', () => socket.write('not json\n'));
			socket.on('data', (chunk: string) => { expect(chunk.trim()).toBe('{"value":null}'); });
			socket.on('close', () => resolve());
		});
	});
});
