import * as net from 'net';

/** What the askpass helper sends to the extension. */
export interface AskpassRequest {
	nonce: string;
	prompt: string;
}
/** What the extension answers. `value` is null when the user cancelled. */
export interface AskpassResponse {
	value: string | null;
}

export function parseAskpassRequest(data: string): AskpassRequest | null {
	try {
		const parsed: unknown = JSON.parse(data);
		if (parsed && typeof parsed === 'object' && typeof (<AskpassRequest>parsed).nonce === 'string' && typeof (<AskpassRequest>parsed).prompt === 'string') {
			return { nonce: (<AskpassRequest>parsed).nonce, prompt: (<AskpassRequest>parsed).prompt };
		}
	} catch (e) {
		// not JSON
	}
	return null;
}

/**
 * Sends the prompt to the extension over the local pipe and resolves with the user's answer.
 * Rejects when the extension cannot be reached, answers with something unexpected, or the user cancels.
 */
export function requestCredential(pipePath: string, nonce: string, prompt: string, timeoutMs: number = 5 * 60 * 1000): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const socket = net.createConnection(pipePath);
		let buffer = '', settled = false;
		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			fn();
		};
		const timer = setTimeout(() => finish(() => reject(new Error('Timed out waiting for the credential prompt'))), timeoutMs);
		socket.setEncoding('utf8');
		socket.on('connect', () => {
			const request: AskpassRequest = { nonce: nonce, prompt: prompt };
			socket.write(JSON.stringify(request) + '\n');
		});
		socket.on('data', (chunk: string) => {
			buffer += chunk;
			const newline = buffer.indexOf('\n');
			if (newline === -1) return;
			let response: AskpassResponse | null = null;
			try {
				response = JSON.parse(buffer.substring(0, newline));
			} catch (e) {
				response = null;
			}
			if (response && typeof response.value === 'string') {
				const value = response.value;
				finish(() => resolve(value));
			} else {
				finish(() => reject(new Error('The credential prompt was cancelled')));
			}
		});
		socket.on('error', (e) => finish(() => reject(e)));
		socket.on('close', () => finish(() => reject(new Error('The connection to Git Graph was closed'))));
	});
}
