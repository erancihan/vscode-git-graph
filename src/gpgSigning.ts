import * as fs from 'fs';
import * as path from 'path';

/**
 * Environment and git arguments that route gpg through `resources/gpg-wrapper.sh`, so a signing
 * command that cannot show its own passphrase prompt asks for the passphrase in Visual Studio Code
 * (see resources/gpg-wrapper.js). The askpass pipe variables must be present in the same
 * environment; AskpassManager provides them.
 */
export function gpgWrapperEnvironment(extensionPath: string, gitPath: string): { [key: string]: string } {
	return {
		GIT_GRAPH_GPG_NODE: process.execPath,
		GIT_GRAPH_GPG_MAIN: path.join(extensionPath, 'resources', 'gpg-wrapper.js'),
		GIT_GRAPH_GIT: gitPath,
		ELECTRON_RUN_AS_NODE: '1'
	};
}

/** The `-c gpg.program=...` pair to put before the git subcommand. */
export function gpgWrapperArgs(extensionPath: string): string[] {
	return ['-c', 'gpg.program=' + gpgWrapperPath(extensionPath)];
}

export function gpgWrapperPath(extensionPath: string) {
	return path.join(extensionPath, 'resources', 'gpg-wrapper.sh');
}

/** The packaged script may have lost its executable bit; best effort, nothing to do on Windows. */
export function ensureGpgWrapperExecutable(extensionPath: string) {
	if (process.platform === 'win32') return;
	try { fs.chmodSync(gpgWrapperPath(extensionPath), 0o755); } catch (e) { /* read-only install */ }
}

/** True when git's error output says that signing failed. */
export function isSigningFailure(message: string) {
	return /gpg failed to sign the data|gpg: signing failed|failed to write commit object|error: unable to sign|cannot sign tag|gpg: skipped .* No secret key|ssh-keygen .* failed/i.test(message);
}

/** The message with a hint about where the passphrase prompt comes from. */
export function withSigningHint(message: string, promptEnabled: boolean) {
	if (!isSigningFailure(message)) return message;
	return message + '\n\n' + (promptEnabled
		? 'Git Graph asks for the GPG passphrase in an input box when gpg cannot show its own prompt. If no prompt appeared, check that gpg-agent is running and that the key exists (gpg --list-secret-keys), or sign from a terminal once so the agent caches the passphrase.'
		: 'Git Graph runs git without a terminal, so gpg cannot show a text-mode passphrase prompt. Enable git-graph.gpg.passphrasePrompt to get an input box, use a graphical pinentry, or sign from a terminal once so the agent caches the passphrase.');
}
