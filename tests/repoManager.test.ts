import { sortRepoPaths } from '../src/repoManager';

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
