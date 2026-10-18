import { buildTerminalCommand, isTerminalSafeArgument } from '../src/terminal';

describe('isTerminalSafeArgument', () => {
	it('accepts reference names and hashes', () => {
		expect(isTerminalSafeArgument('master')).toBe(true);
		expect(isTerminalSafeArgument('feature/my-branch_2.0')).toBe(true);
		expect(isTerminalSafeArgument('origin/HEAD')).toBe(true);
		expect(isTerminalSafeArgument('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678')).toBe(true);
		expect(isTerminalSafeArgument('v1.2.3+build')).toBe(true);
	});

	it('refuses characters that some shell expands', () => {
		expect(isTerminalSafeArgument('stash@{0}')).toBe(false);
		expect(isTerminalSafeArgument('a{b,c}')).toBe(false);
		expect(isTerminalSafeArgument('%PATH%')).toBe(false);
		expect(isTerminalSafeArgument('~root')).toBe(false);
		expect(isTerminalSafeArgument('a^b')).toBe(false);
		expect(isTerminalSafeArgument('a=b')).toBe(false);
		expect(isTerminalSafeArgument('a:b')).toBe(false);
	});

	it('refuses shell metacharacters and options', () => {
		expect(isTerminalSafeArgument('a;rm -rf x')).toBe(false);
		expect(isTerminalSafeArgument('$(whoami)')).toBe(false);
		expect(isTerminalSafeArgument('`id`')).toBe(false);
		expect(isTerminalSafeArgument('a b')).toBe(false);
		expect(isTerminalSafeArgument("it's")).toBe(false);
		expect(isTerminalSafeArgument('x|y')).toBe(false);
		expect(isTerminalSafeArgument('--exec=evil')).toBe(false);
		expect(isTerminalSafeArgument('')).toBe(false);
	});
});

describe('buildTerminalCommand', () => {
	it('joins the executable and its arguments', () => {
		expect(buildTerminalCommand('git', ['rebase', '--interactive', 'master'], null)).toBe('git rebase --interactive master');
		expect(buildTerminalCommand('/usr/bin/git', ['rebase', '--interactive', 'abc123'], '/bin/bash')).toBe('/usr/bin/git rebase --interactive abc123');
	});

	it('quotes an executable path that contains spaces', () => {
		expect(buildTerminalCommand('C:\\Program Files\\Git\\bin\\git.exe', ['status'], 'C:\\Windows\\System32\\cmd.exe')).toBe('"C:\\Program Files\\Git\\bin\\git.exe" status');
		expect(buildTerminalCommand('C:\\Program Files\\Git\\bin\\git.exe', ['status'], 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')).toBe('& "C:\\Program Files\\Git\\bin\\git.exe" status');
		expect(buildTerminalCommand('/Applications/My Tools/git', ['status'], '/usr/local/bin/pwsh')).toBe('& "/Applications/My Tools/git" status');
	});

	it('refuses unsafe arguments, options with user data and unquotable executables', () => {
		expect(buildTerminalCommand('git', ['rebase', '--interactive', 'x; rm -rf /'], null)).toBeNull();
		expect(buildTerminalCommand('git', ['rebase', '--exec=touch pwned', 'master'], null)).toBeNull();
		expect(buildTerminalCommand('/tmp/"quoted"/git', ['status'], null)).toBeNull();
	});
});
