import { buildPullRequestUrl, detectPullRequestProvider, parseRemoteUrl } from '../src/remoteUrl';

describe('parseRemoteUrl', () => {
	it('splits https, ssh and scp-like urls', () => {
		expect(parseRemoteUrl('https://github.com/erancihan/vscode-git-graph.git')).toEqual({ host: 'github.com', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteUrl('git@gitlab.com:group/sub/project.git')).toEqual({ host: 'gitlab.com', owner: 'group/sub', repo: 'project' });
		expect(parseRemoteUrl('ssh://git@Bitbucket.org:7999/team/repo')).toEqual({ host: 'bitbucket.org', owner: 'team', repo: 'repo' });
		expect(parseRemoteUrl('/srv/git/repo.git')).toBeNull();
		expect(parseRemoteUrl('https://example.com/repo')).toBeNull();
		expect(parseRemoteUrl(null)).toBeNull();
	});
});

describe('detectPullRequestProvider', () => {
	it('knows the three hosted providers', () => {
		expect(detectPullRequestProvider(parseRemoteUrl('git@github.com:a/b.git'))).toBe('GitHub');
		expect(detectPullRequestProvider(parseRemoteUrl('https://gitlab.com/a/b'))).toBe('GitLab');
		expect(detectPullRequestProvider(parseRemoteUrl('https://bitbucket.org/a/b'))).toBe('Bitbucket');
		expect(detectPullRequestProvider(parseRemoteUrl('https://gitea.example.com/a/b'))).toBeNull();
		expect(detectPullRequestProvider(null)).toBeNull();
	});
});

describe('buildPullRequestUrl', () => {
	const source = { remote: parseRemoteUrl('git@github.com:me/fork.git')!, branch: 'feature/x y' };
	const destination = { remote: parseRemoteUrl('https://github.com/org/upstream.git')!, branch: 'main' };

	it('builds the hosted provider urls', () => {
		expect(buildPullRequestUrl('GitHub', source, destination, [])).toBe('https://github.com/org/upstream/compare/main...me:feature%2Fx%20y?expand=1');
		const gl = { remote: parseRemoteUrl('https://gitlab.com/group/sub/project')!, branch: 'topic' };
		expect(buildPullRequestUrl('GitLab', gl, { remote: gl.remote, branch: 'main' }, [])).toBe('https://gitlab.com/group/sub/project/-/merge_requests/new?merge_request%5Bsource_branch%5D=topic&merge_request%5Btarget_branch%5D=main');
		const bb = { remote: parseRemoteUrl('https://bitbucket.org/team/repo')!, branch: 'topic' };
		expect(buildPullRequestUrl('Bitbucket', bb, { remote: bb.remote, branch: 'develop' }, [])).toBe('https://bitbucket.org/team/repo/pull-requests/new?source=topic&dest=team%2Frepo%3A%3Adevelop&t=1');
	});

	it('fills custom templates and refuses unknown providers and non-http results', () => {
		const custom = [{ name: 'Gitea', templateUrl: 'https://gitea.example.com/$destinationOwner/$destinationRepo/compare/$destinationBranch...$sourceOwner:$sourceBranch' }];
		expect(buildPullRequestUrl('Gitea', source, destination, custom)).toBe('https://gitea.example.com/org/upstream/compare/main...me:feature%2Fx%20y');
		expect(buildPullRequestUrl('Unknown', source, destination, custom)).toBeNull();
		expect(buildPullRequestUrl('Bad', source, destination, [{ name: 'Bad', templateUrl: 'javascript:alert(1)' }])).toBeNull();
	});
});
