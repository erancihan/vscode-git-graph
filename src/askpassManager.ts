import * as crypto from 'crypto';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { AskpassResponse, parseAskpassRequest } from './askpassClient';
import { Logger } from './logger';

export type AskpassPromptHandler = (prompt: string, isPassword: boolean) => Promise<string | null>;

/** Environment variables that make git call the Git Graph askpass helper. */
export interface AskpassEnvironment {
	[key: string]: string;
}

/**
 * Lets git ask the user for credentials (HTTPS user names and passwords, SSH passphrases) when no
 * credential helper answers. A local server listens on a random pipe; `resources/askpass.sh` runs
 * `askpassMain.js`, which connects to the pipe, sends the prompt together with a per-session nonce,
 * and prints the answer the user typed into the input box.
 */
export class AskpassManager {
	private readonly logger: Logger;
	private readonly promptHandler: AskpassPromptHandler;
	private readonly extensionPath: string;
	private readonly nonce: string;
	private server: net.Server | null = null;
	private pipePath: string | null = null;
	private busy: Promise<unknown> = Promise.resolve();

	constructor(extensionPath: string, promptHandler: AskpassPromptHandler, logger: Logger) {
		this.extensionPath = extensionPath;
		this.promptHandler = promptHandler;
		this.logger = logger;
		this.nonce = crypto.randomBytes(24).toString('hex');
	}

	/** Start listening. Safe to call more than once. Resolves when the pipe is ready or could not be created. */
	public start(): Promise<void> {
		if (this.server !== null) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const pipePath = createPipePath();
			const server = net.createServer((socket) => this.handleConnection(socket));
			server.on('error', (e) => {
				this.logger.logError('Askpass server error: ' + e.message);
				if (this.server === null) resolve();
			});
			server.listen(pipePath, () => {
				this.server = server;
				this.pipePath = pipePath;
				if (process.platform !== 'win32') {
					try { fs.chmodSync(pipePath, 0o600); } catch (e) { /* best effort */ }
					try { fs.chmodSync(path.join(this.extensionPath, 'resources', 'askpass.sh'), 0o755); } catch (e) { /* read-only install: the packaged mode applies */ }
				}
				this.logger.log('Askpass helper ready');
				resolve();
			});
		});
	}

	/** Environment for git processes, or an empty object when the helper is not running. */
	public getEnvironment(): AskpassEnvironment {
		if (this.server === null || this.pipePath === null) return {};
		return {
			GIT_ASKPASS: path.join(this.extensionPath, 'resources', 'askpass.sh'),
			GIT_GRAPH_ASKPASS_NODE: process.execPath,
			GIT_GRAPH_ASKPASS_MAIN: path.join(this.extensionPath, 'out', 'askpassMain.js'),
			GIT_GRAPH_ASKPASS_PIPE: this.pipePath,
			GIT_GRAPH_ASKPASS_NONCE: this.nonce,
			// Never let git fall back to a terminal prompt: there is none, it would hang
			GIT_TERMINAL_PROMPT: '0'
		};
	}

	public dispose() {
		if (this.server !== null) {
			this.server.close();
			this.server = null;
		}
		if (this.pipePath !== null && process.platform !== 'win32') {
			try { fs.unlinkSync(this.pipePath); } catch (e) { /* already gone */ }
		}
		this.pipePath = null;
	}

	private handleConnection(socket: net.Socket) {
		let buffer = '', handled = false;
		socket.setEncoding('utf8');
		const answer = (response: AskpassResponse) => {
			socket.end(JSON.stringify(response) + '\n');
		};
		const timer = setTimeout(() => { if (!handled) { handled = true; socket.destroy(); } }, 10000); // a client that never sends a request
		socket.on('data', (chunk: string) => {
			if (handled) return;
			buffer += chunk;
			if (buffer.length > 8192) { handled = true; clearTimeout(timer); socket.destroy(); return; }
			const newline = buffer.indexOf('\n');
			if (newline === -1) return;
			handled = true;
			clearTimeout(timer);
			const request = parseAskpassRequest(buffer.substring(0, newline));
			if (request === null || request.nonce !== this.nonce) {
				this.logger.logError('Askpass request refused (bad format or nonce)');
				answer({ value: null });
				return;
			}
			// Prompts are shown one at a time, in the order they arrive
			this.busy = this.busy.then(() => this.promptHandler(request.prompt, isPasswordPrompt(request.prompt))).then((value) => {
				answer({ value: value });
			}, (e) => {
				this.logger.logError('Askpass prompt failed: ' + (e instanceof Error ? e.message : String(e)));
				answer({ value: null });
			});
		});
		socket.on('error', () => { /* client went away */ });
	}
}

/** Git's prompts for secrets contain "password" or "passphrase"; everything else (user names) is shown in clear text. */
export function isPasswordPrompt(prompt: string) {
	return /password|passphrase/i.test(prompt);
}

/** A random pipe name: a named pipe on Windows, a socket in the temp folder elsewhere. */
export function createPipePath() {
	const name = 'git-graph-askpass-' + crypto.randomBytes(12).toString('hex');
	return process.platform === 'win32' ? '\\\\.\\pipe\\' + name : path.join(os.tmpdir(), name + '.sock');
}
