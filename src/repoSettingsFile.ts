import * as crypto from 'crypto';
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
