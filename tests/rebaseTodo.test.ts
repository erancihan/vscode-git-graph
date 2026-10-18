import { applyAutosquash, moveTodoEntry, parseAutosquashSubject, serializeTodo, shellQuote, validateTodo } from '../src/rebaseTodo';
import { GitRebaseTodoEntry } from '../src/types';

const H = (n: number) => n.toString(16).padStart(40, '0');
const entry = (n: number, subject: string, action: GitRebaseTodoEntry['action'] = 'pick', message: string | null = null): GitRebaseTodoEntry => ({ action, hash: H(n), subject, message });

describe('rebase todo helpers', () => {
	it('parses autosquash subjects', () => {
		expect(parseAutosquashSubject('fixup! Add tests')).toEqual({ action: 'fixup', needle: 'Add tests' });
		expect(parseAutosquashSubject('squash! fixup! Add tests')).toEqual({ action: 'squash', needle: 'Add tests' });
		expect(parseAutosquashSubject('Add tests')).toBeNull();
		expect(parseAutosquashSubject('fixup! ')).toBeNull();
	});

	it('moves fixup!/squash! commits after their target like git --autosquash', () => {
		const todo = [entry(1, 'Add feature'), entry(2, 'Other work'), entry(3, 'fixup! Add feature'), entry(4, 'squash! Other'), entry(5, 'fixup! Add feature'), entry(6, 'fixup! Nothing matches')];
		expect(applyAutosquash(todo).map((e) => e.action + ' ' + e.subject)).toEqual([
			'pick Add feature', 'fixup fixup! Add feature', 'fixup fixup! Add feature', 'pick Other work', 'squash squash! Other', 'pick fixup! Nothing matches'
		]);
	});

	it('matches a hash prefix as the autosquash target', () => {
		const todo = [entry(0xabc, 'x'), entry(2, 'fixup! ' + H(0xabc).substring(0, 7))];
		expect(applyAutosquash(todo).map((e) => e.action)).toEqual(['pick', 'fixup']);
	});

	it('validates todo lists from the webview', () => {
		const range = [H(1), H(2), H(3)];
		expect(validateTodo([entry(1, 'a'), entry(2, 'b'), entry(3, 'c')], range)).toBeNull();
		expect(validateTodo([entry(2, 'b', 'squash'), entry(1, 'a'), entry(3, 'c')], range)).toMatch(/first commit/);
		expect(validateTodo([entry(1, 'a', 'drop'), entry(2, 'b', 'fixup'), entry(3, 'c')], range)).toMatch(/first commit/);
		expect(validateTodo([entry(1, 'a'), entry(2, 'b')], range)).toMatch(/does not cover/);
		expect(validateTodo([entry(1, 'a'), entry(2, 'b'), entry(2, 'b')], range)).toMatch(/twice/);
		expect(validateTodo([entry(1, 'a'), entry(2, 'b'), entry(4, 'd')], range)).toMatch(/not part/);
		expect(validateTodo([{ action: 'exec', hash: H(1), subject: '', message: null }, entry(2, 'b'), entry(3, 'c')], range)).toMatch(/unknown action/);
		expect(validateTodo([{ action: 'pick', hash: 'HEAD', subject: '', message: null }], ['HEAD'])).toMatch(/invalid commit hash/);
		expect(validateTodo([{ action: 'pick', hash: H(1), subject: '', message: 5 }], [H(1)])).toMatch(/message/);
		expect(validateTodo([], [])).toMatch(/empty/);
		expect(validateTodo('pick', [])).toMatch(/empty/);
	});

	it('serialises picks, drops, edits and reorders verbatim', () => {
		const text = serializeTodo([entry(3, 'c'), entry(1, 'a\nwith newline', 'edit'), entry(2, 'b', 'drop')], (i) => '/tmp/m' + i, false);
		expect(text).toBe('pick ' + H(3) + ' c\nedit ' + H(1) + ' a with newline\ndrop ' + H(2) + ' b\n');
	});

	it('turns reword into pick + exec with the message file, quoted for the shell', () => {
		const text = serializeTodo([entry(1, 'a', 'reword', 'New message')], (i) => '/tmp/it\'s here/m' + i, true);
		expect(text).toBe('pick ' + H(1) + ' a\nexec git commit --amend --only --allow-empty -S -F \'/tmp/it\'\\\'\'s here/m0\'\n');
	});

	it('keeps git\'s combined message for a squash group without a message, and sets the typed one otherwise', () => {
		expect(serializeTodo([entry(1, 'a'), entry(2, 'b', 'squash'), entry(3, 'c', 'fixup')], (i) => '/m' + i, false))
			.toBe('pick ' + H(1) + ' a\nsquash ' + H(2) + ' b\nfixup ' + H(3) + ' c\n');
		expect(serializeTodo([entry(1, 'a'), entry(2, 'b', 'squash', 'Combined'), entry(3, 'c', 'squash'), entry(4, 'd')], (i) => '/m' + i, false))
			.toBe('pick ' + H(1) + ' a\nfixup ' + H(2) + ' b\nfixup ' + H(3) + ' c\nexec git commit --amend --only --allow-empty -F \'/m1\'\npick ' + H(4) + ' d\n');
	});

	it('applies a reword message after the fixups that follow the reworded commit', () => {
		expect(serializeTodo([entry(1, 'a', 'reword', 'Renamed'), entry(2, 'b', 'fixup')], (i) => '/m' + i, false))
			.toBe('pick ' + H(1) + ' a\nfixup ' + H(2) + ' b\nexec git commit --amend --only --allow-empty -F \'/m0\'\n');
	});

	it('quotes for the POSIX shell and moves entries', () => {
		expect(shellQuote('plain')).toBe('\'plain\'');
		expect(shellQuote('a\'b')).toBe('\'a\'\\\'\'b\'');
		expect(moveTodoEntry([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
		expect(moveTodoEntry([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
		expect(moveTodoEntry([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
	});
});
