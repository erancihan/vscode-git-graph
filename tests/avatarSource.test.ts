import { gravatarHash, parseRemoteSource } from '../src/avatarSource';

describe('parseRemoteSource', () => {
	it('recognises GitHub over https, ssh and git', () => {
		expect(parseRemoteSource('https://github.com/erancihan/vscode-git-graph.git')).toEqual({ type: 'github', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteSource('https://user@github.com/erancihan/vscode-git-graph')).toEqual({ type: 'github', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteSource('git@github.com:erancihan/vscode-git-graph.git')).toEqual({ type: 'github', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteSource('ssh://git@github.com:22/erancihan/vscode-git-graph.git')).toEqual({ type: 'github', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteSource('git://github.com/erancihan/vscode-git-graph/')).toEqual({ type: 'github', owner: 'erancihan', repo: 'vscode-git-graph' });
		expect(parseRemoteSource('https://GitHub.com/Owner/Repo')).toEqual({ type: 'github', owner: 'Owner', repo: 'Repo' });
	});

	it('recognises GitLab and falls back to Gravatar', () => {
		expect(parseRemoteSource('git@gitlab.com:group/sub/project.git')).toEqual({ type: 'gitlab' });
		expect(parseRemoteSource('https://gitlab.com/group/project')).toEqual({ type: 'gitlab' });
		expect(parseRemoteSource('https://example.com/owner/repo.git')).toEqual({ type: 'gravatar' });
		expect(parseRemoteSource('git@bitbucket.org:owner/repo.git')).toEqual({ type: 'gravatar' });
		expect(parseRemoteSource('/local/path/repo.git')).toEqual({ type: 'gravatar' });
		expect(parseRemoteSource('https://github.com/only-owner')).toEqual({ type: 'gravatar' });
		expect(parseRemoteSource(null)).toEqual({ type: 'gravatar' });
	});
});

describe('gravatarHash', () => {
	it('normalises the address before hashing', () => {
		expect(gravatarHash(' Someone@Example.COM ')).toBe(gravatarHash('someone@example.com'));
		expect(gravatarHash('someone@example.com')).toMatch(/^[0-9a-f]{32}$/);
	});
});
