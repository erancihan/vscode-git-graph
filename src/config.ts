import * as vscode from 'vscode';
import { CommitOrdering, DateFormat, DateType, GraphStyle, TabIconColourTheme } from './types';

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

	public showTags() {
		return this.getBoolean('repository.showTags', 'showTags', true);
	}

	public showUncommittedChanges() {
		return this.getBoolean('repository.showUncommittedChanges', 'showUncommittedChanges', true);
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
