import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Git Graph';

/**
 * Records extension events, git invocations and errors from external tools in an Output Channel.
 * Open it with "View > Output" and select "Git Graph".
 */
export class Logger implements vscode.Disposable {
	private readonly channel: vscode.OutputChannel;

	constructor() {
		this.channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
	}

	/** Log a general message. */
	public log(message: string) {
		this.channel.appendLine(formatLogLine(new Date(), message));
	}

	/** Log a command invocation, for example a git command and its arguments. */
	public logCmd(cmd: string, args: ReadonlyArray<string>) {
		this.log('> ' + formatCommandLine(cmd, args));
	}

	/** Log an error. */
	public logError(message: string) {
		this.log('ERROR: ' + message);
	}

	/** Bring the Output Channel into view. */
	public show() {
		this.channel.show(true);
	}

	public dispose() {
		this.channel.dispose();
	}
}

/** Format a log line as "[HH:MM:SS.mmm] message". */
export function formatLogLine(date: Date, message: string) {
	return '[' + pad(date.getHours(), 2) + ':' + pad(date.getMinutes(), 2) + ':' + pad(date.getSeconds(), 2) + '.' + pad(date.getMilliseconds(), 3) + '] ' + message;
}

/**
 * Format a command and its arguments as a single line that can be pasted into a shell.
 * Arguments that contain whitespace or quotes are wrapped in double quotes.
 */
export function formatCommandLine(cmd: string, args: ReadonlyArray<string>) {
	return [cmd].concat(args).map(quoteArg).join(' ');
}

function quoteArg(arg: string) {
	if (arg === '') return '""';
	if (!/[\s"'\\]/.test(arg)) return arg;
	return '"' + arg.replace(/(["\\])/g, '\\$1') + '"';
}

function pad(n: number, width: number) {
	let s = n.toString();
	while (s.length < width) s = '0' + s;
	return s;
}
