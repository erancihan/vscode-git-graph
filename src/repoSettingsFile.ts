import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { normaliseRepoState } from './repoManager';
import { GitRepoState } from './types';

/** Path of the shareable settings file, relative to the repository root. */
export const REPO_SETTINGS_FILE = '.vscode/git-graph.json';
const MAX_FILE_SIZE = 64 * 1024;

/** The fields of the repository state that make sense for a whole team; the display name and the column layout stay personal. */
export const EXPORTED_KEYS = <const>['hideRemotes', 'showTags', 'showStashes', 'includeCommitsMentionedByReflogs', 'onlyFollowFirstParent', 'issueLinkingConfig', 'onLoad'];
export type ExportedKey = typeof EXPORTED_KEYS[number];
export type ExportedRepoSettings = Partial<Pick<GitRepoState, ExportedKey>>;

/** The shareable part of a repository state, ready to be written as JSON. */
export function exportRepoSettings(state: GitRepoState): ExportedRepoSettings {
	const result: ExportedRepoSettings = {};
	for (const key of EXPORTED_KEYS) (<Record<string, unknown>><unknown>result)[key] = state[key];
	return result;
}

/** The JSON text of the settings file for a state. */
export function serializeRepoSettings(state: GitRepoState) {
	return JSON.stringify(exportRepoSettings(state), null, '\t') + '\n';
}

/**
 * Parse the settings file. Only known fields are read, each validated the way the stored state is;
 * fields that are missing or invalid are left out, so an import never touches what the file does
 * not mention. Returns null when the text is not a JSON object or is too large.
 */
export function parseRepoSettings(text: string): ExportedRepoSettings | null {
	if (text.length > MAX_FILE_SIZE) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
	const result: ExportedRepoSettings = {};
	for (const key of EXPORTED_KEYS) {
		if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
		const value = (<Record<string, unknown>>parsed)[key];
		if (value === null) {
			(<Record<string, unknown>><unknown>result)[key] = null; // an explicit null resets the field to the default
		} else {
			const validated = normaliseRepoState(<Partial<GitRepoState>>{ [key]: value });
			if (validated[key] !== null && !(Array.isArray(validated[key]) && (<unknown[]>validated[key]).length === 0 && !Array.isArray(value))) (<Record<string, unknown>><unknown>result)[key] = validated[key];
		}
	}
	return result;
}

/** A new state with the imported fields applied; everything else is kept. */
export function applyRepoSettings(state: GitRepoState, imported: ExportedRepoSettings): GitRepoState {
	const result: GitRepoState = { ...state };
	for (const key of EXPORTED_KEYS) {
		if (Object.prototype.hasOwnProperty.call(imported, key)) (<Record<string, unknown>><unknown>result)[key] = imported[key];
	}
	return result;
}

/** True when applying the file would change nothing. */
export function repoSettingsMatch(state: GitRepoState, imported: ExportedRepoSettings) {
	return JSON.stringify(exportRepoSettings(applyRepoSettings(state, imported))) === JSON.stringify(exportRepoSettings(state));
}

/** Identifies a version of the file, so an unchanged file is never offered twice. */
export function hashRepoSettings(text: string) {
	return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * The absolute path of the settings file when it is safe to read or write: the repository root
 * must be a real directory, `.vscode` (when it exists) a real directory and the file (when it
 * exists) a regular file, none of them symbolic links, so a repository cannot point the export at a
 * file outside itself. Returns null otherwise.
 */
export function repoSettingsFilePath(repo: string): string | null {
	const isLink = (candidate: string) => {
		try {
			return fs.lstatSync(candidate).isSymbolicLink();
		} catch (e) {
			return false; // does not exist yet
		}
	};
	let realRepo: string;
	try {
		realRepo = fs.realpathSync(repo);
	} catch (e) {
		return null;
	}
	const folder = path.join(realRepo, path.dirname(REPO_SETTINGS_FILE)), file = path.join(realRepo, REPO_SETTINGS_FILE);
	if (isLink(folder) || isLink(file)) return null;
	try {
		if (fs.existsSync(folder) && !fs.statSync(folder).isDirectory()) return null;
		if (fs.existsSync(file) && !fs.statSync(file).isFile()) return null;
	} catch (e) {
		return null;
	}
	return file;
}

/** Write the settings file atomically: a new temporary file next to it, then a rename. */
export function writeRepoSettingsFile(file: string, text: string) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const temp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
	fs.writeFileSync(temp, text, { flag: 'wx' });
	try {
		fs.renameSync(temp, file);
	} catch (e) {
		try { fs.unlinkSync(temp); } catch (e2) { /* nothing to clean */ }
		throw e;
	}
}

/**
 * A short, readable list of what a settings file would change, for the confirmation prompt. The
 * values come from a file in the repository, so control characters are removed and every value and
 * the whole text are cut to a fixed length.
 */
export function describeRepoSettings(imported: ExportedRepoSettings): string {
	const parts: string[] = [];
	const clean = (value: string) => {
		const text = value.replace(/[\x00-\x1f\x7f\u2028\u2029]/g, ' ');
		return text.length > 80 ? text.substring(0, 77) + '...' : text;
	};
	const flag = (key: ExportedKey, label: string) => {
		if (!Object.prototype.hasOwnProperty.call(imported, key)) return;
		const value = imported[key];
		parts.push(label + ': ' + (value === null ? 'default' : Array.isArray(value) ? (value.length > 0 ? clean(value.join(', ')) : 'none') : typeof value === 'object' ? clean(JSON.stringify(value)) : String(value)));
	};
	flag('showTags', 'show tags');
	flag('showStashes', 'show stashes');
	flag('includeCommitsMentionedByReflogs', 'reflog commits');
	flag('onlyFollowFirstParent', 'first parent only');
	flag('hideRemotes', 'hidden remotes');
	if (Object.prototype.hasOwnProperty.call(imported, 'onLoad')) {
		const onLoad = imported.onLoad;
		parts.push('branches on load: ' + (onLoad === null || onLoad === undefined ? 'default' : (onLoad.showCheckedOutBranch ? 'checked-out branch' : '') + (onLoad.showSpecificBranches.length > 0 ? (onLoad.showCheckedOutBranch ? ' + ' : '') + clean(onLoad.showSpecificBranches.join(', ')) : '')));
	}
	if (Object.prototype.hasOwnProperty.call(imported, 'issueLinkingConfig')) {
		const linking = imported.issueLinkingConfig;
		parts.push('issue linking: ' + (linking === null || linking === undefined ? 'none' : clean(linking.issue) + ' -> ' + clean(linking.url)));
	}
	const text = parts.join('; ');
	return text.length > 400 ? text.substring(0, 397) + '...' : text;
}
