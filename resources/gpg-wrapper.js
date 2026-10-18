// gpg wrapper used by Git Graph (set as gpg.program for the git processes it starts).
//
// Git has no terminal when Git Graph runs it, so a curses pinentry cannot ask for the passphrase and
// signing fails with "gpg failed to sign the data". This wrapper runs the real gpg first; when that
// works (cached passphrase, GUI pinentry, key without passphrase) nothing changes. Otherwise it asks
// for the passphrase through the Git Graph askpass pipe (an input box in Visual Studio Code) and
// runs gpg again with --pinentry-mode loopback, handing the passphrase over on file descriptor 3.
// The passphrase is never written to disk or to the command line. Calls that do not sign (for
// example signature verification) are passed through unchanged.
'use strict';
const cp = require('child_process');
const net = require('net');

const args = process.argv.slice(2);
const MAX_ATTEMPTS = 3;

/** Environment for the real gpg and for git: without GIT_CONFIG_PARAMETERS, which would point gpg.program back at this wrapper. */
const childEnv = Object.assign({}, process.env);
delete childEnv.GIT_CONFIG_PARAMETERS;

function realGpgProgram() {
	if (process.env.GIT_GRAPH_GPG_PROGRAM) return process.env.GIT_GRAPH_GPG_PROGRAM;
	try {
		const configured = cp.execFileSync(process.env.GIT_GRAPH_GIT || 'git', ['config', '--get', 'gpg.program'], { env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
		if (configured !== '' && configured.indexOf('gpg-wrapper') === -1) return configured;
	} catch (e) { /* not configured */ }
	return 'gpg';
}

function isSigningCall() {
	return args.some((arg) => arg === '--sign' || arg === '--detach-sign' || arg === '--clearsign' || /^-[abs]*s[abs]*u?$/.test(arg));
}

function keyId() {
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--local-user' || args[i] === '-u') return args[i + 1] || '';
		if (/^-[abs]*u$/.test(args[i])) return args[i + 1] || '';
	}
	return '';
}

/** Ask the extension for the passphrase. Resolves with null when there is no pipe or the user cancelled. */
function askPassphrase(prompt) {
	const pipePath = process.env.GIT_GRAPH_ASKPASS_PIPE, nonce = process.env.GIT_GRAPH_ASKPASS_NONCE;
	if (!pipePath || !nonce) return Promise.resolve(null);
	return new Promise((resolve) => {
		let buffer = '', done = false;
		const finish = (value) => { if (!done) { done = true; resolve(value); } };
		const socket = net.connect(pipePath, () => { socket.write(JSON.stringify({ nonce: nonce, prompt: prompt }) + '\n'); });
		socket.setEncoding('utf8');
		socket.on('data', (chunk) => {
			buffer += chunk;
			const newline = buffer.indexOf('\n');
			if (newline === -1) return;
			try {
				const response = JSON.parse(buffer.substring(0, newline));
				finish(typeof response.value === 'string' ? response.value : null);
			} catch (e) {
				finish(null);
			}
			socket.end();
		});
		socket.on('error', () => finish(null));
		socket.on('close', () => finish(null));
	});
}

function readStdin() {
	return new Promise((resolve) => {
		const chunks = [];
		process.stdin.on('data', (chunk) => chunks.push(chunk));
		process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
		process.stdin.on('error', () => resolve(Buffer.concat(chunks)));
		process.stdin.resume();
	});
}

/** Run gpg once. `passphrase` null: normal run; otherwise loopback pinentry with the passphrase on fd 3. */
function runGpg(program, input, passphrase) {
	return new Promise((resolve) => {
		const extra = passphrase === null ? ['--batch', '--no-tty'] : ['--batch', '--no-tty', '--pinentry-mode', 'loopback', '--passphrase-fd', '3'];
		const stdio = passphrase === null ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe', 'pipe'];
		let child;
		try {
			child = cp.spawn(program, extra.concat(args), { env: childEnv, stdio: stdio });
		} catch (e) {
			resolve({ code: 127, stdout: Buffer.alloc(0), stderr: Buffer.from('gpg-wrapper: unable to start ' + program + ': ' + e.message + '\n') });
			return;
		}
		const stdout = [], stderr = [];
		child.stdout.on('data', (chunk) => stdout.push(chunk));
		child.stderr.on('data', (chunk) => stderr.push(chunk));
		child.on('error', (e) => resolve({ code: 127, stdout: Buffer.alloc(0), stderr: Buffer.from('gpg-wrapper: unable to start ' + program + ': ' + e.message + '\n') }));
		child.on('close', (code) => resolve({ code: code === null ? 1 : code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
		if (passphrase !== null) {
			child.stdio[3].on('error', () => { });
			child.stdio[3].end(passphrase + '\n');
		}
		child.stdin.on('error', () => { });
		child.stdin.end(input);
	});
}

function finish(result) {
	process.stdout.write(result.stdout, () => {
		process.stderr.write(result.stderr, () => process.exit(result.code));
	});
}

const program = realGpgProgram();

if (!isSigningCall()) {
	// Verification and other calls: behave exactly like gpg
	const child = cp.spawn(program, args, { env: childEnv, stdio: 'inherit' });
	child.on('error', (e) => { process.stderr.write('gpg-wrapper: unable to start ' + program + ': ' + e.message + '\n'); process.exit(127); });
	child.on('close', (code) => process.exit(code === null ? 1 : code));
} else {
	readStdin().then(async (input) => {
		const first = await runGpg(program, input, null);
		if (first.code === 0) return finish(first);
		const id = keyId();
		let prompt = 'Passphrase for the GPG key' + (id !== '' ? ' ' + id : '') + ' (git needs it to sign)';
		let last = first;
		for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
			const passphrase = await askPassphrase(prompt);
			if (passphrase === null) break; // no prompt available, or cancelled: report the original failure
			last = await runGpg(program, input, passphrase);
			if (last.code === 0) return finish(last);
			if (last.stderr.toString().indexOf('BAD_PASSPHRASE') === -1 && !/bad passphrase/i.test(last.stderr.toString())) break;
			prompt = 'Wrong passphrase. Passphrase for the GPG key' + (id !== '' ? ' ' + id : '');
		}
		finish(last === first ? first : last);
	});
}
