import { defaultRepoState, isSafeIssuePattern, normaliseRepoState, sortRepoPaths } from '../src/repoManager';
import { GitRepoState } from '../src/types';

describe('sortRepoPaths', () => {
	const repos = ['/w/b/repo-z', '/w/a/repo-y', '/other/repo-a', '/w/a'];
	const workspace = ['/w/a', '/w/b'];

	it('sorts by full path', () => {
		expect(sortRepoPaths(repos, 'Full Path', workspace)).toEqual(['/other/repo-a', '/w/a', '/w/a/repo-y', '/w/b/repo-z']);
	});

	it('sorts by name, then by path', () => {
		expect(sortRepoPaths(repos, 'Name', workspace)).toEqual(['/w/a', '/other/repo-a', '/w/a/repo-y', '/w/b/repo-z']);
	});

	it('sorts by workspace folder order, then by path, with repositories outside the workspace last', () => {
		expect(sortRepoPaths(repos, 'Workspace Full Path', workspace)).toEqual(['/w/a', '/w/a/repo-y', '/w/b/repo-z', '/other/repo-a']);
	});

	it('does not change the input array', () => {
		const copy = repos.slice();
		sortRepoPaths(repos, 'Name', workspace);
		expect(repos).toEqual(copy);
	});
});

describe('normaliseRepoState', () => {
	it('fills the fields that older versions did not store', () => {
		expect(normaliseRepoState({ columnWidths: [40, 100, 100, 80], columnVisibility: null })).toEqual({ ...defaultRepoState(), columnWidths: [40, 100, 100, 80] });
		expect(normaliseRepoState(null)).toEqual(defaultRepoState());
	});

	it('keeps valid values and drops the rest', () => {
		const state = normaliseRepoState(<Partial<GitRepoState>><unknown>{ name: '  My Repo ', hideRemotes: ['origin', 3], showTags: false, showStashes: 'yes', onlyFollowFirstParent: true });
		expect(state.name).toBe('My Repo');
		expect(state.hideRemotes).toEqual(['origin']);
		expect(state.showTags).toBe(false);
		expect(state.showStashes).toBeNull();
		expect(state.onlyFollowFirstParent).toBe(true);
		expect(normaliseRepoState({ name: '   ' }).name).toBeNull();
		expect(normaliseRepoState(<Partial<GitRepoState>><unknown>{ onLoad: { showCheckedOutBranch: true, showSpecificBranches: ['develop', '-x', 7, 'bad\u0000name'] } }).onLoad).toEqual({ showCheckedOutBranch: true, showSpecificBranches: ['develop'] });
		expect(normaliseRepoState(<Partial<GitRepoState>><unknown>{ onLoad: { showCheckedOutBranch: false, showSpecificBranches: [] } }).onLoad).toBeNull();
		expect(normaliseRepoState(<Partial<GitRepoState>><unknown>{ onLoad: 'develop' }).onLoad).toBeNull();
		expect(normaliseRepoState({ issueLinkingConfig: { issue: '#(\\d+)', url: 'https://example.com/issues/$1' } }).issueLinkingConfig).toEqual({ issue: '#(\\d+)', url: 'https://example.com/issues/$1' });
		expect(normaliseRepoState({ issueLinkingConfig: { issue: '#(\\d+)', url: 'javascript:alert(1)' } }).issueLinkingConfig).toBeNull();
		expect(normaliseRepoState({ issueLinkingConfig: { issue: '', url: 'https://example.com' } }).issueLinkingConfig).toBeNull();
	});
});

describe('isSafeIssuePattern', () => {
	it('accepts ordinary patterns and rejects long, invalid or nested-quantifier ones', () => {
		expect(isSafeIssuePattern('#(\\d+)')).toBe(true);
		expect(isSafeIssuePattern('([A-Z]+-\\d+)')).toBe(true);
		expect(isSafeIssuePattern('(a+)+')).toBe(false);
		expect(isSafeIssuePattern('(\\d*)*')).toBe(false);
		expect(isSafeIssuePattern('(x{1,3})+')).toBe(false);
		expect(isSafeIssuePattern('(')).toBe(false);
		expect(isSafeIssuePattern('a'.repeat(201))).toBe(false);
		expect(isSafeIssuePattern('')).toBe(false);
		expect(normaliseRepoState({ issueLinkingConfig: { issue: '(a+)+', url: 'https://example.com/$1' } }).issueLinkingConfig).toBeNull();
	});
});
