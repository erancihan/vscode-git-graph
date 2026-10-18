import { GitRebaseAction, GitRebaseTodoEntry } from './types';

export const REBASE_ACTIONS: ReadonlyArray<GitRebaseAction> = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'];
const MAX_TODO_ENTRIES = 1000;
const MAX_MESSAGE_LENGTH = 65536;
const FULL_HASH = /^[0-9a-f]{40}$/;

/**
 * Rearrange the todo list the way `git rebase --autosquash` does: a commit whose subject starts
 * with "fixup! " or "squash! " moves directly after the earlier commit whose subject starts with
 * the rest of its subject (or whose hash starts with it), with the matching action. Repeated
 * prefixes ("fixup! fixup! x") are stripped. A commit without a target stays where it is.
 */
export function applyAutosquash(entries: ReadonlyArray<GitRebaseTodoEntry>): GitRebaseTodoEntry[] {
	const result: GitRebaseTodoEntry[] = [];
	const pending: { entry: GitRebaseTodoEntry, action: 'fixup' | 'squash', needle: string }[] = [];
	for (const entry of entries) {
		const parsed = parseAutosquashSubject(entry.subject);
		if (parsed === null) {
			result.push(entry);
		} else {
			pending.push({ entry: entry, action: parsed.action, needle: parsed.needle });
		}
	}
	for (const item of pending) {
		const originalIndex = entries.indexOf(item.entry);
		let target = -1;
		for (let i = 0; i < result.length; i++) {
			const candidate = result[i];
			if (candidate === item.entry || entries.indexOf(candidate) > originalIndex) continue;
			if (candidate.subject.indexOf(item.needle) === 0 || (item.needle.length >= 4 && candidate.hash.indexOf(item.needle) === 0)) {
				target = i;
				break;
			}
		}
		if (target === -1) {
			// No target: keep the original order among the entries that are already placed
			let insertAt = result.length;
			for (let i = 0; i < result.length; i++) {
				if (entries.indexOf(result[i]) > originalIndex) { insertAt = i; break; }
			}
			result.splice(insertAt, 0, item.entry);
			continue;
		}
		// Place after the target and after the fixups already attached to it
		let insertAt = target + 1;
		while (insertAt < result.length && (result[insertAt].action === 'fixup' || result[insertAt].action === 'squash') && pending.some((p) => p.entry === result[insertAt])) insertAt++;
		result.splice(insertAt, 0, { ...item.entry, action: item.action });
	}
	return result;
}

/** The autosquash action and search text of a subject, or null when the subject has no fixup!/squash! prefix. */
export function parseAutosquashSubject(subject: string): { action: 'fixup' | 'squash', needle: string } | null {
	let action: 'fixup' | 'squash' | null = null, rest = subject;
	for (; ;) {
		const match = /^(fixup|squash)! /.exec(rest);
		if (match === null) break;
		if (action === null) action = match[1] === 'fixup' ? 'fixup' : 'squash';
		rest = rest.substring(match[0].length);
	}
	return action === null || rest.trim() === '' ? null : { action: action, needle: rest.trim() };
}

/**
 * Check a todo list that came from the webview against the commits git reports in the range:
 * every entry must be a known action with a full hash from the range, each hash exactly once,
 * with an optional message of a sane size, and the first entry cannot be squashed or fixed up
 * into a commit that does not exist. Returns an error message, or null when the list is valid.
 */
export function validateTodo(todo: unknown, rangeHashes: ReadonlyArray<string>): string | null {
	if (!Array.isArray(todo) || todo.length === 0 || todo.length > MAX_TODO_ENTRIES) return 'The rebase todo list is empty or too long.';
	const seen: { [hash: string]: boolean } = {};
	for (const entry of todo) {
		if (typeof entry !== 'object' || entry === null) return 'The rebase todo list is malformed.';
		const action = (<{ action: unknown }>entry).action, hash = (<{ hash: unknown }>entry).hash, message = (<{ message: unknown }>entry).message;
		if (typeof action !== 'string' || REBASE_ACTIONS.indexOf(<GitRebaseAction>action) === -1) return 'The rebase todo list contains an unknown action.';
		if (typeof hash !== 'string' || !FULL_HASH.test(hash)) return 'The rebase todo list contains an invalid commit hash.';
		if (rangeHashes.indexOf(hash) === -1) return 'Commit ' + hash.substring(0, 8) + ' is not part of the rebase. Refresh the graph and try again.';
		if (seen[hash]) return 'Commit ' + hash.substring(0, 8) + ' appears twice in the rebase todo list.';
		seen[hash] = true;
		if (message !== null && message !== undefined && (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH)) return 'A commit message in the rebase todo list is invalid.';
	}
	if (rangeHashes.some((hash) => !seen[hash])) return 'The rebase todo list does not cover every commit. Refresh the graph and try again.';
	const firstKept = (<GitRebaseTodoEntry[]>todo).find((entry) => entry.action !== 'drop');
	if (firstKept !== undefined && (firstKept.action === 'squash' || firstKept.action === 'fixup')) return 'The first commit cannot be squashed or fixed up: there is no earlier commit to merge it into.';
	return null;
}

/**
 * The text of git's todo file for the list. No editor is needed: a "reword" becomes a pick followed
 * by an `exec` line that sets the message from a file, and a squash group with a message becomes
 * fixups followed by the same `exec` line (the last message typed in the group wins; a group without
 * a message keeps git's combined message). `messageFile(index)` returns the path of the file holding
 * the message of the entry at that index. Subjects are informational for git; line breaks are removed.
 */
export function serializeTodo(todo: ReadonlyArray<GitRebaseTodoEntry>, messageFile: (index: number) => string, signCommits: boolean): string {
	const lines: string[] = [];
	const amend = (index: number) => 'exec git commit --amend --only --allow-empty' + (signCommits ? ' -S' : '') + ' -F ' + shellQuote(messageFile(index));
	const hasMessage = (entry: GitRebaseTodoEntry) => typeof entry.message === 'string' && entry.message.trim() !== '';
	let pendingMessage = -1; // index of the squash whose message is applied at the end of its group
	for (let i = 0; i < todo.length; i++) {
		const entry = todo[i], subject = entry.subject.replace(/[\r\n]+/g, ' ');
		const groupContinues = i + 1 < todo.length && (todo[i + 1].action === 'squash' || todo[i + 1].action === 'fixup');
		if (entry.action === 'reword') {
			lines.push('pick ' + entry.hash + ' ' + subject);
			if (hasMessage(entry) && !groupContinues) lines.push(amend(i));
			else if (hasMessage(entry)) pendingMessage = i;
		} else if (entry.action === 'squash' || entry.action === 'fixup') {
			if (entry.action === 'squash' && hasMessage(entry)) pendingMessage = i;
			// With a message in the group, every squash becomes a fixup and the message is set once at the end
			lines.push((entry.action === 'squash' && pendingMessage !== -1 ? 'fixup' : entry.action) + ' ' + entry.hash + ' ' + subject);
			if (!groupContinues && pendingMessage !== -1) {
				lines.push(amend(pendingMessage));
				pendingMessage = -1;
			}
		} else {
			pendingMessage = -1;
			lines.push(entry.action + ' ' + entry.hash + ' ' + subject);
		}
	}
	return lines.join('\n') + '\n';
}

/** Quote a string for the POSIX shell git uses to run `exec` lines (also on Windows). */
export function shellQuote(value: string) {
	return '\'' + value.replace(/'/g, '\'\\\'\'') + '\'';
}

/** Move the entry at `from` to `to`, keeping every other entry in order. */
export function moveTodoEntry<T>(entries: ReadonlyArray<T>, from: number, to: number): T[] {
	const result = entries.slice();
	if (from < 0 || from >= result.length || to < 0 || to >= result.length) return result;
	const [entry] = result.splice(from, 1);
	result.splice(to, 0, entry);
	return result;
}
