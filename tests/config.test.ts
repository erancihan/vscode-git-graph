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
			applyStash: { reinstateIndex: false },
			cherryPick: { noCommit: false, recordOrigin: false },
			createBranch: { checkOut: false },
			deleteBranch: { forceDelete: false },
			fetchIntoLocalBranch: { forceFetch: false },
			merge: { noFastForward: true, noCommit: false, squashCommits: false },
			popStash: { reinstateIndex: false },
			pullBranch: { noFastForward: false, squashCommits: false },
			rebase: { ignoreDate: true, launchInteractiveRebase: false },
			resetCurrentBranchToCommit: { mode: 'mixed' },
			resetUncommittedChanges: { mode: 'mixed' },
			stashUncommittedChanges: { includeUntracked: false },
			general: { referenceInputSpaceSubstitution: null }
		});
	});

	it('maps the setting values to dialog values', () => {
		setConfig({
			'dialog.addTag.type': 'Lightweight',
			'dialog.deleteBranch.forceDelete': 'true',
			'dialog.merge.noFastForward': false,
			'dialog.resetCurrentBranchToCommit.mode': 'Hard',
			'dialog.resetUncommittedChanges.mode': 'Hard',
			'dialog.merge.squashCommits': true,
			'dialog.cherryPick.recordOrigin': true,
			'dialog.createBranch.checkOut': true,
			'dialog.rebase.launchInteractiveRebase': true,
			'dialog.general.referenceInputSpaceSubstitution': 'Underscore'
		});
		expect(getConfig().dialogDefaults()).toEqual({
			addTag: { type: 'lightweight' },
			applyStash: { reinstateIndex: false },
			cherryPick: { noCommit: false, recordOrigin: true },
			createBranch: { checkOut: true },
			deleteBranch: { forceDelete: true },
			fetchIntoLocalBranch: { forceFetch: false },
			merge: { noFastForward: false, noCommit: false, squashCommits: true },
			popStash: { reinstateIndex: false },
			pullBranch: { noFastForward: false, squashCommits: false },
			rebase: { ignoreDate: true, launchInteractiveRebase: true },
			resetCurrentBranchToCommit: { mode: 'hard' },
			resetUncommittedChanges: { mode: 'hard' },
			stashUncommittedChanges: { includeUntracked: false },
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
		expect(Object.keys(visibility.commit).sort()).toEqual(['addTag', 'archive', 'bisect', 'checkout', 'cherrypick', 'codeReview', 'copyHash', 'createBranch', 'createWorktree', 'drop', 'filterByAuthor', 'merge', 'rebase', 'reset', 'revert', 'reword']);
		expect(visibility.uncommittedChanges).toEqual({ reset: true, clean: true, stash: true, amend: true });
		expect(Object.keys(visibility.stash).sort()).toEqual(['apply', 'copyHash', 'copyName', 'createBranch', 'drop', 'pop']);
		expect(visibility.tag).toEqual({ delete: true, push: true, archive: true, copyName: true });
	});

	it('hides only the actions that are set to false', () => {
		setConfig({ 'contextMenuActionsVisibility': { commit: { reset: false, checkout: 'false' }, tag: { push: false }, unknownMenu: { x: false } } });
		const visibility = getConfig().contextMenuActionsVisibility();
		expect(visibility.commit.reset).toBe(false);
		expect(visibility.commit.checkout).toBe(false);
		expect(visibility.commit.addTag).toBe(true);
		expect(visibility.tag).toEqual({ delete: true, push: false, archive: true, copyName: true });
		expect(visibility.branch.delete).toBe(true);
	});

	it('ignores values that are not objects', () => {
		setConfig({ 'contextMenuActionsVisibility': 'none' });
		expect(getConfig().contextMenuActionsVisibility().commit.reset).toBe(true);
		setConfig({ 'contextMenuActionsVisibility': { commit: false } });
		expect(getConfig().contextMenuActionsVisibility().commit.reset).toBe(true);
	});
});

describe('Config.commitDetailsView', () => {
	it('defaults to the file tree with compact folders and reads the flat fallbacks', () => {
		expect(getConfig().commitDetailsView()).toEqual({ fileViewType: 'tree', compactFolders: true, location: 'Inline', showChangeTypeLetters: false });
		setConfig({ 'defaultFileViewType': 'File List', 'commitDetailsViewFileTreeCompactFolders': false, 'commitDetailsView.location': 'Docked to Bottom', 'commitDetailsView.fileView.showChangeTypeLetters': true });
		expect(getConfig().commitDetailsView()).toEqual({ fileViewType: 'list', compactFolders: false, location: 'Docked to Bottom', showChangeTypeLetters: true });
		setConfig({ 'commitDetailsView.location': 'Floating' });
		expect(getConfig().commitDetailsView().location).toBe('Inline');
		setConfig({ 'commitDetailsView.fileView.type': 'File Tree', 'defaultFileViewType': 'File List' });
		expect(getConfig().commitDetailsView().fileViewType).toBe('tree');
	});
});

describe('Config.customBranchGlobPatterns', () => {
	it('keeps only entries with a name and a glob', () => {
		expect(getConfig().customBranchGlobPatterns()).toEqual([]);
		setConfig({ 'customBranchGlobPatterns': [{ name: ' Features ', glob: 'heads/feature/*' }, { name: '', glob: 'x' }, { glob: 'y' }, 'bad', null] });
		expect(getConfig().customBranchGlobPatterns()).toEqual([{ name: 'Features', glob: 'heads/feature/*' }]);
	});
});

describe('Config.defaultColumnVisibility', () => {
	it('shows every column by default and reads the setting leniently', () => {
		expect(getConfig().defaultColumnVisibility()).toEqual({ date: true, author: true, commit: true });
		setConfig({ 'defaultColumnVisibility': { Date: false, Commit: 'false', Other: false } });
		expect(getConfig().defaultColumnVisibility()).toEqual({ date: false, author: true, commit: false });
		setConfig({ 'defaultColumnVisibility': 'none' });
		expect(getConfig().defaultColumnVisibility()).toEqual({ date: true, author: true, commit: true });
	});
});

describe('Config.keyboardShortcuts', () => {
	it('returns the default letters and validates overrides', () => {
		expect(getConfig().keyboardShortcuts()).toEqual({ find: 'f', refresh: 'r', scrollToHead: 'h', scrollToStash: 's' });
		setConfig({ 'keyboardShortcut.find': 'G', 'keyboardShortcut.refresh': 'F5', 'keyboardShortcut.scrollToHead': ' j ' });
		expect(getConfig().keyboardShortcuts()).toEqual({ find: 'g', refresh: 'r', scrollToHead: 'j', scrollToStash: 's' });
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

describe('Config.integratedTerminalShell', () => {
	it('is empty by default and trims the configured path', () => {
		expect(getConfig().integratedTerminalShell()).toBe('');
		setConfig({ 'integratedTerminalShell': '  /bin/zsh ' });
		expect(getConfig().integratedTerminalShell()).toBe('/bin/zsh');
	});

	it('ignores values that are not strings', () => {
		setConfig({ 'integratedTerminalShell': 42 });
		expect(getConfig().integratedTerminalShell()).toBe('');
	});
});

describe('Config.referenceLabels', () => {
	it('returns defaults when nothing is set', () => {
		expect(getConfig().referenceLabels()).toEqual({ alignment: 'Normal', combineLocalAndRemoteBranchLabels: true });
	});

	it('reads the configured values and falls back for unknown alignments', () => {
		setConfig({ 'referenceLabels.alignment': 'Branches (on the left) & Tags (on the right)', 'referenceLabels.combineLocalAndRemoteBranchLabels': false });
		expect(getConfig().referenceLabels()).toEqual({ alignment: 'Branches (on the left) & Tags (on the right)', combineLocalAndRemoteBranchLabels: false });
		setConfig({ 'referenceLabels.alignment': 'Sideways' });
		expect(getConfig().referenceLabels().alignment).toBe('Normal');
	});
});

describe('Config.customPullRequestProviders', () => {
	it('keeps valid entries only', () => {
		expect(getConfig().customPullRequestProviders()).toEqual([]);
		setConfig({ 'customPullRequestProviders': [{ name: ' Gitea ', templateUrl: ' https://gitea.example.com/$sourceOwner ' }, { name: 'Bad', templateUrl: 'ftp://x' }, { name: '', templateUrl: 'https://x' }, 'nope'] });
		expect(getConfig().customPullRequestProviders()).toEqual([{ name: 'Gitea', templateUrl: 'https://gitea.example.com/$sourceOwner' }]);
	});
});
