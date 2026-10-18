import { formatCommandLine, formatLogLine, Logger } from '../src/logger';
import { outputChannelLines } from './mocks/vscode';

describe('formatCommandLine', () => {
	it('joins the command and plain arguments with spaces', () => {
		expect(formatCommandLine('git', ['log', '--max-count=5'])).toBe('git log --max-count=5');
	});

	it('quotes arguments that contain whitespace', () => {
		expect(formatCommandLine('git', ['tag', '-m', 'Release 1.0'])).toBe('git tag -m "Release 1.0"');
	});

	it('escapes quotes and backslashes inside quoted arguments', () => {
		expect(formatCommandLine('git', ['commit', '-m', 'say "hi" C:\\x'])).toBe('git commit -m "say \\"hi\\" C:\\\\x"');
	});

	it('represents an empty argument as an empty quoted string', () => {
		expect(formatCommandLine('git', ['log', ''])).toBe('git log ""');
	});
});

describe('formatLogLine', () => {
	it('prefixes the message with a zero-padded timestamp', () => {
		const date = new Date(2026, 0, 1, 9, 5, 3, 7);
		expect(formatLogLine(date, 'hello')).toBe('[09:05:03.007] hello');
	});
});

describe('Logger', () => {
	it('writes commands and errors to the "Git Graph" output channel', () => {
		const logger = new Logger();
		logger.logCmd('git', ['status', '--porcelain']);
		logger.logError('boom');
		const lines = outputChannelLines['Git Graph'];
		expect(lines[lines.length - 2]).toMatch(/\] > git status --porcelain$/);
		expect(lines[lines.length - 1]).toMatch(/\] ERROR: boom$/);
	});
});
