import { coerceBoolean, coerceInteger, getConfig } from '../src/config';
import { configurationValues } from './mocks/vscode';

function setConfig(values: { [key: string]: unknown }) {
	configurationValues['git-graph'] = values;
}

afterEach(() => {
	delete configurationValues['git-graph'];
});

describe('Config', () => {
	it('returns defaults when nothing is set', () => {
		const config = getConfig();
		expect(config.dateFormat()).toBe('Date & Time');
		expect(config.dateType()).toBe('Author Date');
		expect(config.graphStyle()).toBe('rounded');
		expect(config.initialLoadCommits()).toBe(300);
		expect(config.loadMoreCommits()).toBe(100);
		expect(config.fetchAvatars()).toBe(false);
		expect(config.showUncommittedChanges()).toBe(true);
		expect(config.graphColours()).toHaveLength(12);
	});

	it('reads grouped names', () => {
		setConfig({ 'date.format': 'Relative', 'repository.commits.initialLoad': 50, 'graph.style': 'angular' });
		const config = getConfig();
		expect(config.dateFormat()).toBe('Relative');
		expect(config.initialLoadCommits()).toBe(50);
		expect(config.graphStyle()).toBe('angular');
	});

	it('falls back to the deprecated flat names', () => {
		setConfig({ 'dateFormat': 'Date Only', 'initialLoadCommits': 20, 'showUncommittedChanges': false });
		const config = getConfig();
		expect(config.dateFormat()).toBe('Date Only');
		expect(config.initialLoadCommits()).toBe(20);
		expect(config.showUncommittedChanges()).toBe(false);
	});

	it('prefers the grouped name when both are set', () => {
		setConfig({ 'dateFormat': 'Date Only', 'date.format': 'Relative' });
		expect(getConfig().dateFormat()).toBe('Relative');
	});

	it('coerces string booleans and numbers', () => {
		setConfig({ 'repository.commits.fetchAvatars': 'true', 'repository.commits.loadMore': '25' });
		const config = getConfig();
		expect(config.fetchAvatars()).toBe(true);
		expect(config.loadMoreCommits()).toBe(25);
	});

	it('ignores values outside the allowed range or enum', () => {
		setConfig({ 'date.type': 'Whenever', 'repository.commits.initialLoad': -5, 'maxDepthOfRepoSearch': 'deep' });
		const config = getConfig();
		expect(config.dateType()).toBe('Author Date');
		expect(config.initialLoadCommits()).toBe(300);
		expect(config.maxDepthOfRepoSearch()).toBe(0);
	});

	it('drops invalid graph colours and keeps the defaults when none are valid', () => {
		setConfig({ 'graph.colours': ['#123456', 'red', 'rgb(1, 2, 3)'] });
		expect(getConfig().graphColours()).toEqual(['#123456', 'rgb(1, 2, 3)']);
		setConfig({ 'graph.colours': ['red'] });
		expect(getConfig().graphColours()).toHaveLength(12);
	});
});

describe('Config.dialogDefaults', () => {
	it('returns the documented defaults', () => {
		expect(getConfig().dialogDefaults()).toEqual({
			addTag: { type: 'annotated' },
			deleteBranch: { forceDelete: false },
			merge: { noFastForward: true },
			resetCurrentBranchToCommit: { mode: 'mixed' },
			general: { referenceInputSpaceSubstitution: null }
		});
	});

	it('maps the setting values to dialog values', () => {
		setConfig({
			'dialog.addTag.type': 'Lightweight',
			'dialog.deleteBranch.forceDelete': 'true',
			'dialog.merge.noFastForward': false,
			'dialog.resetCurrentBranchToCommit.mode': 'Hard',
			'dialog.general.referenceInputSpaceSubstitution': 'Underscore'
		});
		expect(getConfig().dialogDefaults()).toEqual({
			addTag: { type: 'lightweight' },
			deleteBranch: { forceDelete: true },
			merge: { noFastForward: false },
			resetCurrentBranchToCommit: { mode: 'hard' },
			general: { referenceInputSpaceSubstitution: '_' }
		});
	});

	it('falls back for unknown enum values', () => {
		setConfig({ 'dialog.resetCurrentBranchToCommit.mode': 'Nuke', 'dialog.general.referenceInputSpaceSubstitution': 'Dash' });
		const defaults = getConfig().dialogDefaults();
		expect(defaults.resetCurrentBranchToCommit.mode).toBe('mixed');
		expect(defaults.general.referenceInputSpaceSubstitution).toBeNull();
	});
});

describe('Config.contextMenuActionsVisibility', () => {
	it('shows every action by default', () => {
		const visibility = getConfig().contextMenuActionsVisibility();
		expect(Object.values(visibility.commit).every(v => v === true)).toBe(true);
		expect(Object.keys(visibility.commit).sort()).toEqual(['addTag', 'checkout', 'cherrypick', 'copyHash', 'createBranch', 'merge', 'reset', 'revert']);
		expect(visibility.tag).toEqual({ delete: true, push: true, copyName: true });
	});

	it('hides only the actions that are set to false', () => {
		setConfig({ 'contextMenuActionsVisibility': { commit: { reset: false, checkout: 'false' }, tag: { push: false }, unknownMenu: { x: false } } });
		const visibility = getConfig().contextMenuActionsVisibility();
		expect(visibility.commit.reset).toBe(false);
		expect(visibility.commit.checkout).toBe(false);
		expect(visibility.commit.addTag).toBe(true);
		expect(visibility.tag).toEqual({ delete: true, push: false, copyName: true });
		expect(visibility.branch.delete).toBe(true);
	});

	it('ignores values that are not objects', () => {
		setConfig({ 'contextMenuActionsVisibility': 'none' });
		expect(getConfig().contextMenuActionsVisibility().commit.reset).toBe(true);
		setConfig({ 'contextMenuActionsVisibility': { commit: false } });
		expect(getConfig().contextMenuActionsVisibility().commit.reset).toBe(true);
	});
});

describe('coerceBoolean', () => {
	it('accepts booleans and boolean strings', () => {
		expect(coerceBoolean(true, false)).toBe(true);
		expect(coerceBoolean('False', true)).toBe(false);
		expect(coerceBoolean(' true ', false)).toBe(true);
	});

	it('returns the default for anything else', () => {
		expect(coerceBoolean('yes', false)).toBe(false);
		expect(coerceBoolean(1, false)).toBe(false);
		expect(coerceBoolean(undefined, true)).toBe(true);
	});
});

describe('coerceInteger', () => {
	it('accepts numbers and numeric strings, truncating fractions', () => {
		expect(coerceInteger(12.7, 0)).toBe(12);
		expect(coerceInteger('42', 0)).toBe(42);
	});

	it('returns the default for anything else', () => {
		expect(coerceInteger('many', 7)).toBe(7);
		expect(coerceInteger(NaN, 7)).toBe(7);
		expect(coerceInteger(null, 7)).toBe(7);
	});
});
