import { defaultRepoState, normaliseRepoState, sortRepoPaths } from '../src/repoManager';
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
	});
});
