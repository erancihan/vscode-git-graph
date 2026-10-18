import * as vscode from 'vscode';
import { getConfig } from './config';
import { Logger } from './logger';

/**
 * Characters that no shell (sh, bash, zsh, cmd, PowerShell) interprets, so the argument needs no
 * quoting. Braces, commas, `%`, `~`, `^` and `$` are left out on purpose: they drive brace
 * expansion, variable expansion, tilde expansion and escaping in one shell or another. Reference
 * names outside this set are refused instead of quoted, because the quoting rules differ between
 * shells.
 */
const TERMINAL_SAFE_ARGUMENT = /^[A-Za-z0-9_.\/@+-]+$/;

export function isTerminalSafeArgument(arg: string) {
	return TERMINAL_SAFE_ARGUMENT.test(arg) && !arg.startsWith('-');
}

/** Options (starting with `-`) that the extension itself adds. They must contain no user data. */
const TERMINAL_SAFE_OPTION = /^--?[A-Za-z0-9=-]+$/;

function isPowerShell(shellPath: string | null) {
	if (shellPath === null) return process.platform === 'win32' && !/cmd(\.exe)?$/i.test(process.env['ComSpec'] || '');
	return /(^|[\\\/])(pwsh|powershell)(\.exe)?$/i.test(shellPath);
}

/**
 * Builds the command line that is typed into the integrated terminal.
 * Returns null when an argument cannot be passed safely.
 * @param gitPath Path of the git executable.
 * @param args Arguments for git, in order.
 * @param shellPath The shell the terminal runs, or null for the default shell.
 */
export function buildTerminalCommand(gitPath: string, args: string[], shellPath: string | null): string | null {
	for (const arg of args) {
		if (!(arg.startsWith('-') ? TERMINAL_SAFE_OPTION.test(arg) : isTerminalSafeArgument(arg))) return null;
	}
	let executable = gitPath;
	if (!/^[A-Za-z0-9_.\/\\:-]+$/.test(gitPath)) {
		if (gitPath.indexOf('"') > -1) return null;
		executable = '"' + gitPath + '"';
		if (isPowerShell(shellPath)) executable = '& ' + executable;
	}
	return [executable].concat(args).join(' ');
}

/**
 * Opens a new integrated terminal in the repository and runs a git command in it.
 * Returns an error message, or null when the terminal was opened.
 */
export function runGitCommandInTerminal(repo: string, gitPath: string, args: string[], name: string, logger: Logger): string | null {
	const configuredShell = getConfig().integratedTerminalShell();
	const shellPath = configuredShell !== '' ? configuredShell : null;
	const command = buildTerminalCommand(gitPath, args, shellPath);
	if (command === null) return 'The command contains characters that cannot be passed to the terminal safely.';

	const options: vscode.TerminalOptions = { cwd: repo, name: name };
	if (shellPath !== null) options.shellPath = shellPath;
	try {
		const terminal = vscode.window.createTerminal(options);
		terminal.sendText(command, true);
		terminal.show();
		logger.log('Opened terminal "' + name + '" in ' + repo + ' and ran: ' + command);
		return null;
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		logger.logError('Unable to open a terminal: ' + message);
		return 'Unable to open a terminal: ' + message;
	}
}
