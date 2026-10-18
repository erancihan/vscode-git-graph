import * as vscode from 'vscode';
import { CommitOrdering, ContextMenuActionsVisibility, DateFormat, DateType, DialogDefaults, GitResetMode, GraphStyle, KeyboardShortcuts, SquashMessageFormat, TabIconColourTheme } from './types';

const DEFAULT_GRAPH_COLOURS = ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00'];
const GRAPH_COLOUR_REGEX = /^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/;

/**
 * Typed access to the `git-graph.*` settings.
 *
 * Settings use grouped names such as `git-graph.date.format`. The flat names from earlier versions
 * (`git-graph.dateFormat`) are still read when the grouped name is not set anywhere, so existing
 * user and workspace configurations keep working. Values are coerced to the expected type, because
 * `settings.json` edits and remote settings sync can leave a string where a boolean or a number is
 * expected.
 */
class Config {
	private readonly workspaceConfiguration: vscode.WorkspaceConfiguration;

	constructor() {
		this.workspaceConfiguration = vscode.workspace.getConfiguration('git-graph');
	}

	/* Commit Details View */

	public autoCenterCommitDetailsView() {
		return this.getBoolean('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView', true);
	}

	/* Date */

	public dateFormat(): DateFormat {
		return this.getEnum<DateFormat>('date.format', 'dateFormat', ['Date & Time', 'Date Only', 'Relative'], 'Date & Time');
	}

	public dateType(): DateType {
		return this.getEnum<DateType>('date.type', 'dateType', ['Author Date', 'Commit Date'], 'Author Date');
	}

	/* Context Menus */

	/**
	 * Which context menu actions are shown. Every action defaults to visible; the setting only needs
	 * the entries that are set to false.
	 */
	public contextMenuActionsVisibility(): ContextMenuActionsVisibility {
		const value = this.get<unknown>('contextMenuActionsVisibility', null, {});
		const setting = typeof value === 'object' && value !== null ? <{ [menu: string]: unknown }>value : {};
		const read = <T extends { [action: string]: boolean }>(menu: string, defaults: T): T => {
			const actions = typeof setting[menu] === 'object' && setting[menu] !== null ? <{ [action: string]: unknown }>setting[menu] : {};
			const result = <{ [action: string]: boolean }>{};
			for (const action of Object.keys(defaults)) {
				result[action] = coerceBoolean(actions[action], defaults[action]);
			}
			return <T>result;
		};
		return {
			branch: read('branch', { checkout: true, rename: true, delete: true, merge: true, rebase: true, push: true, copyName: true }),
			commit: read('commit', { addTag: true, createBranch: true, checkout: true, cherrypick: true, revert: true, drop: true, merge: true, rebase: true, reset: true, copyHash: true }),
			remoteBranch: read('remoteBranch', { checkout: true, delete: true, fetch: true, pull: true, copyName: true }),
			stash: read('stash', { apply: true, createBranch: true, pop: true, drop: true, copyName: true, copyHash: true }),
			tag: read('tag', { delete: true, push: true, copyName: true }),
			uncommittedChanges: read('uncommittedChanges', { reset: true, clean: true, stash: true })
		};
	}

	/* Dialogs */

	/** Default values of the inputs in the action dialogs. */
	public dialogDefaults(): DialogDefaults {
		const substitution = this.getEnum('dialog.general.referenceInputSpaceSubstitution', null, ['None', 'Hyphen', 'Underscore'], 'None');
		return {
			addTag: {
				type: this.getEnum('dialog.addTag.type', null, ['Annotated', 'Lightweight'], 'Annotated') === 'Lightweight' ? 'lightweight' : 'annotated'
			},
			applyStash: {
				reinstateIndex: this.getBoolean('dialog.applyStash.reinstateIndex', null, false)
			},
			cherryPick: {
				noCommit: this.getBoolean('dialog.cherryPick.noCommit', null, false),
				recordOrigin: this.getBoolean('dialog.cherryPick.recordOrigin', null, false)
			},
			createBranch: {
				checkOut: this.getBoolean('dialog.createBranch.checkOut', null, false)
			},
			deleteBranch: {
				forceDelete: this.getBoolean('dialog.deleteBranch.forceDelete', null, false)
			},
			fetchIntoLocalBranch: {
				forceFetch: this.getBoolean('dialog.fetchIntoLocalBranch.forceFetch', null, false)
			},
			merge: {
				noFastForward: this.getBoolean('dialog.merge.noFastForward', null, true),
				noCommit: this.getBoolean('dialog.merge.noCommit', null, false),
				squashCommits: this.getBoolean('dialog.merge.squashCommits', null, false)
			},
			popStash: {
				reinstateIndex: this.getBoolean('dialog.popStash.reinstateIndex', null, false)
			},
			pullBranch: {
				noFastForward: this.getBoolean('dialog.pullBranch.noFastForward', null, false),
				squashCommits: this.getBoolean('dialog.pullBranch.squashCommits', null, false)
			},
			rebase: {
				ignoreDate: this.getBoolean('dialog.rebase.ignoreDate', null, true)
			},
			resetCurrentBranchToCommit: {
				mode: <GitResetMode>this.getEnum('dialog.resetCurrentBranchToCommit.mode', null, ['Soft', 'Mixed', 'Hard'], 'Mixed').toLowerCase()
			},
			resetUncommittedChanges: {
				mode: this.getEnum('dialog.resetUncommittedChanges.mode', null, ['Mixed', 'Hard'], 'Mixed') === 'Hard' ? 'hard' : 'mixed'
			},
			stashUncommittedChanges: {
				includeUntracked: this.getBoolean('dialog.stashUncommittedChanges.includeUntracked', null, false)
			},
			general: {
				referenceInputSpaceSubstitution: substitution === 'Hyphen' ? '-' : substitution === 'Underscore' ? '_' : null
			}
		};
	}

	/** Message of the commit that a squash merge creates. */
	public squashMessageFormat(): SquashMessageFormat {
		return this.getEnum<SquashMessageFormat>('dialog.merge.squashMessageFormat', null, ['Default', 'Git SQUASH_MSG'], 'Default');
	}

	/* Keyboard Shortcuts */

	/** The letters of the rebindable shortcuts. An invalid value falls back to the default letter. */
	public keyboardShortcuts(): KeyboardShortcuts {
		return {
			find: this.getShortcutLetter('keyboardShortcut.find', 'f')
		};
	}

	private getShortcutLetter(section: string, defaultLetter: string) {
		const value = this.get<unknown>(section, null, defaultLetter);
		return typeof value === 'string' && /^[a-z]$/i.test(value.trim()) ? value.trim().toLowerCase() : defaultLetter;
	}

	/* Graph */

	public graphColours() {
		const colours = this.get<unknown>('graph.colours', 'graphColours', DEFAULT_GRAPH_COLOURS);
		const valid = Array.isArray(colours)
			? colours.filter((v): v is string => typeof v === 'string' && GRAPH_COLOUR_REGEX.test(v))
			: [];
		return valid.length > 0 ? valid : DEFAULT_GRAPH_COLOURS;
	}

	public graphStyle(): GraphStyle {
		return this.getEnum<GraphStyle>('graph.style', 'graphStyle', ['rounded', 'angular'], 'rounded');
	}

	/* Repository */

	public commitOrdering(): CommitOrdering {
		return this.getEnum<CommitOrdering>('repository.commits.order', 'commitOrdering', ['date', 'author-date', 'topo'], 'date');
	}

	public fetchAndPrune() {
		return this.getBoolean('repository.fetchAndPrune', 'fetchAndPrune', false);
	}

	public fetchAndPruneTags() {
		return this.getBoolean('repository.fetchAndPruneTags', null, false);
	}

	public fetchAvatars() {
		return this.getBoolean('repository.commits.fetchAvatars', 'fetchAvatars', false);
	}

	public initialLoadCommits() {
		return this.getPositiveInteger('repository.commits.initialLoad', 'initialLoadCommits', 300);
	}

	public loadMoreCommits() {
		return this.getPositiveInteger('repository.commits.loadMore', 'loadMoreCommits', 100);
	}

	public loadMoreCommitsAutomatically() {
		return this.getBoolean('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically', false);
	}

	public showCommitsOnlyReferencedByTags() {
		return this.getBoolean('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags', true);
	}

	public showCurrentBranchByDefault() {
		return this.getBoolean('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault', false);
	}

	public showRemoteBranches() {
		return this.getBoolean('repository.showRemoteBranches', null, true);
	}

	public showRemoteHeads() {
		return this.getBoolean('repository.showRemoteHeads', null, true);
	}

	public showStashes() {
		return this.getBoolean('repository.showStashes', null, true);
	}

	public showTags() {
		return this.getBoolean('repository.showTags', 'showTags', true);
	}

	public showUncommittedChanges() {
		return this.getBoolean('repository.showUncommittedChanges', 'showUncommittedChanges', true);
	}

	public signCommits() {
		return this.getBoolean('repository.sign.commits', null, false);
	}

	public signTags() {
		return this.getBoolean('repository.sign.tags', null, false);
	}

	public showUntrackedFiles() {
		return this.getBoolean('repository.showUntrackedFiles', 'showUntrackedFiles', true);
	}

	public useMailmap() {
		return this.getBoolean('repository.useMailmap', 'useMailmap', false);
	}

	/* General */

	public maxDepthOfRepoSearch() {
		return this.getNonNegativeInteger('maxDepthOfRepoSearch', null, 0);
	}

	public retainContextWhenHidden() {
		return this.getBoolean('retainContextWhenHidden', null, true);
	}

	public showStatusBarItem() {
		return this.getBoolean('showStatusBarItem', null, true);
	}

	public tabIconColourTheme(): TabIconColourTheme {
		return this.getEnum<TabIconColourTheme>('tabIconColourTheme', null, ['colour', 'grey'], 'colour');
	}

	/**
	 * Candidates for the git executable, from the `git.path` setting of the built-in Git extension.
	 * The setting is a string or an array of strings. An empty list means "use `git` from PATH".
	 */
	public gitPaths(): string[] {
		const path = vscode.workspace.getConfiguration('git').get<string | string[] | null>('path', null);
		if (typeof path === 'string') return [path];
		if (Array.isArray(path)) return path.filter((p): p is string => typeof p === 'string');
		return [];
	}

	/* Typed readers */

	/**
	 * Read `section`. When the user has not set it at any scope, read the deprecated `fallbackSection`
	 * instead. Return `defaultValue` when neither is set.
	 */
	private get<T>(section: string, fallbackSection: string | null, defaultValue: T): T {
		if (this.isSet(section)) {
			return this.workspaceConfiguration.get<T>(section, defaultValue);
		}
		if (fallbackSection !== null && this.isSet(fallbackSection)) {
			return this.workspaceConfiguration.get<T>(fallbackSection, defaultValue);
		}
		return defaultValue;
	}

	private isSet(section: string) {
		const info = this.workspaceConfiguration.inspect(section);
		return typeof info !== 'undefined' && (
			typeof info.globalValue !== 'undefined' ||
			typeof info.workspaceValue !== 'undefined' ||
			typeof info.workspaceFolderValue !== 'undefined' ||
			typeof info.globalLanguageValue !== 'undefined' ||
			typeof info.workspaceLanguageValue !== 'undefined' ||
			typeof info.workspaceFolderLanguageValue !== 'undefined'
		);
	}

	private getBoolean(section: string, fallbackSection: string | null, defaultValue: boolean) {
		return coerceBoolean(this.get<unknown>(section, fallbackSection, defaultValue), defaultValue);
	}

	private getPositiveInteger(section: string, fallbackSection: string | null, defaultValue: number) {
		const value = coerceInteger(this.get<unknown>(section, fallbackSection, defaultValue), defaultValue);
		return value > 0 ? value : defaultValue;
	}

	private getNonNegativeInteger(section: string, fallbackSection: string | null, defaultValue: number) {
		const value = coerceInteger(this.get<unknown>(section, fallbackSection, defaultValue), defaultValue);
		return value >= 0 ? value : defaultValue;
	}

	private getEnum<T extends string>(section: string, fallbackSection: string | null, allowed: ReadonlyArray<T>, defaultValue: T): T {
		const value = this.get<unknown>(section, fallbackSection, defaultValue);
		return typeof value === 'string' && (allowed as ReadonlyArray<string>).indexOf(value) > -1 ? <T>value : defaultValue;
	}
}

/** Accept booleans and the strings "true" and "false"; anything else yields the default. */
export function coerceBoolean(value: unknown, defaultValue: boolean) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const lower = value.trim().toLowerCase();
		if (lower === 'true') return true;
		if (lower === 'false') return false;
	}
	return defaultValue;
}

/** Accept finite numbers and numeric strings, truncated to an integer; anything else yields the default. */
export function coerceInteger(value: unknown, defaultValue: number) {
	if (typeof value === 'number' && isFinite(value)) return Math.trunc(value);
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (isFinite(parsed)) return Math.trunc(parsed);
	}
	return defaultValue;
}

export function getConfig() {
	return new Config();
}
