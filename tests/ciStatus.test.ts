import { CiStatusManager, JsonResponse, mapGitHubCheckRun, mapGitHubStatus, mapGitLabStatus, rateLimitPauseUntil, resolveCiEndpoint, safeCheckUrl, summariseChecks } from '../src/ciStatus';
import { Logger } from '../src/logger';
import { ResponseMessage } from '../src/types';
import { shownMessages } from './mocks/vscode';

describe('CI status helpers', () => {
	it('resolves endpoints for github.com, gitlab.com and configured hosts', () => {
		expect(resolveCiEndpoint('git@github.com:owner/repo.git', {})).toEqual({ type: 'GitHub', apiBase: 'https://api.github.com', owner: 'owner', repo: 'repo', host: 'github.com' });
		expect(resolveCiEndpoint('https://gitlab.com/group/sub/repo.git', {})).toEqual({ type: 'GitLab', apiBase: 'https://gitlab.com/api/v4', owner: 'group/sub', repo: 'repo', host: 'gitlab.com' });
		expect(resolveCiEndpoint('https://git.example.com/o/r', {})).toBeNull();
		expect(resolveCiEndpoint('https://git.example.com/o/r', { 'git.example.com': 'GitLab' })).toMatchObject({ type: 'GitLab', apiBase: 'https://git.example.com/api/v4' });
		expect(resolveCiEndpoint('https://ghe.example.com/o/r', { 'ghe.example.com': 'GitHub' })).toMatchObject({ type: 'GitHub', apiBase: 'https://ghe.example.com/api/v3' });
		expect(resolveCiEndpoint('/local/path', {})).toBeNull();
		expect(resolveCiEndpoint(null, {})).toBeNull();
	});

	it('maps provider payloads to checks and summarises them', () => {
		expect(mapGitHubCheckRun({ name: 'build', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/y/runs/1' })).toEqual({ name: 'build', state: 'success', url: 'https://github.com/x/y/runs/1' });
		expect(mapGitHubCheckRun({ name: 'lint', status: 'in_progress', conclusion: null })).toEqual({ name: 'lint', state: 'pending', url: null });
		expect(mapGitHubCheckRun({ name: 'test', status: 'completed', conclusion: 'timed_out', html_url: 'javascript:alert(1)' })).toEqual({ name: 'test', state: 'failure', url: null });
		expect(mapGitHubCheckRun({ status: 'completed' })).toBeNull();
		expect(mapGitHubStatus({ context: 'ci/circle', state: 'error', target_url: 'https://ci.example.com/1' })).toEqual({ name: 'ci/circle', state: 'failure', url: 'https://ci.example.com/1' });
		expect(mapGitLabStatus({ name: 'deploy', status: 'manual', target_url: null })).toEqual({ name: 'deploy', state: 'pending', url: null });
		expect(mapGitLabStatus({ name: 'unit', status: 'failed' })).toEqual({ name: 'unit', state: 'failure', url: null });
		expect(summariseChecks([])).toBe('none');
		expect(summariseChecks([{ name: 'a', state: 'success', url: null }, { name: 'b', state: 'pending', url: null }])).toBe('pending');
		expect(summariseChecks([{ name: 'a', state: 'success', url: null }, { name: 'b', state: 'failure', url: null }, { name: 'c', state: 'pending', url: null }])).toBe('failure');
		expect(safeCheckUrl('http://x')).toBe('http://x');
		expect(safeCheckUrl('file:///etc/passwd')).toBeNull();
	});

	it('detects rate limiting from the response', () => {
		const now = 1_000_000_000_000;
		expect(rateLimitPauseUntil(200, {}, now)).toBeNull();
		expect(rateLimitPauseUntil(403, {}, now)).toBeNull();
		expect(rateLimitPauseUntil(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 120) }, now)).toBe(now + 120000);
		expect(rateLimitPauseUntil(429, { 'retry-after': '30' }, now)).toBe(now + 30000);
		expect(rateLimitPauseUntil(429, { 'ratelimit-reset': String(now / 1000 + 5) }, now)).toBe(now + 5000);
		expect(rateLimitPauseUntil(429, {}, now)).toBe(now + 60000);
	});
});

describe('CiStatusManager', () => {
	const H1 = 'a'.repeat(40), H2 = 'b'.repeat(40);
	const requests: string[] = [];
	const messages: ResponseMessage[] = [];
	let responses: { [urlPart: string]: JsonResponse };
	const secrets = { store: new Map<string, string>(), get: async (key: string) => secrets.store.get(key), set: async (key: string, value: string) => { secrets.store.set(key, value); } };
	const remotes = { url: 'git@github.com:owner/repo.git' };
	const dataSource = <never>{ getRemoteDetails: async () => [{ name: 'origin', url: remotes.url, pushUrl: null }] };
	const fetchJson = async (url: string): Promise<JsonResponse> => {
		requests.push(url);
		const key = Object.keys(responses).find((part) => url.indexOf(part) !== -1);
		return key !== undefined ? responses[key] : { status: 404, headers: {}, body: null };
	};
	const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
	let manager: CiStatusManager;

	beforeEach(() => {
		requests.length = 0;
		messages.length = 0;
		shownMessages.length = 0;
		responses = {};
		manager = new CiStatusManager(dataSource, <never>{ get: secrets.get, store: secrets.set }, new Logger(), fetchJson);
		manager.registerView(<never>{ sendMessage: (msg: ResponseMessage) => messages.push(msg) });
	});

	it('fetches GitHub check runs and statuses, caches final results, and refreshes pending ones', async () => {
		responses[H1 + '/check-runs'] = { status: 200, headers: {}, body: { check_runs: [{ name: 'build', status: 'completed', conclusion: 'success', html_url: 'https://github.com/owner/repo/runs/1' }] } };
		responses[H1 + '/status'] = { status: 200, headers: {}, body: { statuses: [{ context: 'ci/x', state: 'failure', target_url: 'https://ci/x' }] } };
		responses[H2 + '/check-runs'] = { status: 200, headers: {}, body: { check_runs: [{ name: 'build', status: 'queued', conclusion: null }] } };
		await manager.fetchStatuses('/repo', [H1, H2, 'HEAD'], 30, {});
		await flush();
		expect(requests.length).toBe(4);
		expect(requests).toContain('https://api.github.com/repos/owner/repo/commits/' + H1 + '/check-runs?per_page=100');
		expect(requests).toContain('https://api.github.com/repos/owner/repo/commits/' + H1 + '/status');
		const h1 = messages.map((m) => m.command === 'fetchCiStatus' ? m.statuses[H1] : undefined).find((s) => s !== undefined)!;
		expect(h1.state).toBe('failure');
		expect(h1.checks.map((c) => c.name)).toEqual(['build', 'ci/x']);
		const h2 = messages.map((m) => m.command === 'fetchCiStatus' ? m.statuses[H2] : undefined).find((s) => s !== undefined)!;
		expect(h2.state).toBe('pending');

		requests.length = 0;
		messages.length = 0;
		await manager.fetchStatuses('/repo', [H1, H2], 30, {});
		await flush();
		expect(messages[0].command === 'fetchCiStatus' && Object.keys(messages[0].statuses).sort()).toEqual([H1, H2]); // cached, sent at once
		expect(requests.length).toBe(0); // both are younger than the pending TTL
	});

	it('respects maxCommits and ignores repositories without a supported remote', async () => {
		responses[H1 + '/check-runs'] = { status: 200, headers: {}, body: { check_runs: [] } };
		await manager.fetchStatuses('/repo', [H1, H2], 1, {});
		await flush();
		expect(requests.every((url) => url.indexOf(H2) === -1)).toBe(true);
		remotes.url = 'https://git.internal/o/r';
		const other = new CiStatusManager(dataSource, <never>{ get: secrets.get, store: secrets.set }, new Logger(), fetchJson);
		requests.length = 0;
		await other.fetchStatuses('/other', [H1], 30, {});
		await flush();
		expect(requests.length).toBe(0);
		remotes.url = 'git@github.com:owner/repo.git';
	});

	it('pauses a repository after a rate-limit answer and warns once', async () => {
		responses[H1 + '/check-runs'] = { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) }, body: { message: 'rate limit' } };
		await manager.fetchStatuses('/repo', [H1], 30, {});
		await flush();
		expect(shownMessages.length).toBe(1);
		expect(shownMessages[0]).toMatch(/rate limit/);
		requests.length = 0;
		await manager.fetchStatuses('/repo', [H2], 30, {});
		await flush();
		expect(requests.length).toBe(0);
		expect(shownMessages.length).toBe(1);
	});

	it('uses the stored GitLab token and the statuses endpoint', async () => {
		remotes.url = 'https://gitlab.com/group/project.git';
		secrets.store.set('git-graph.ciStatus.gitlabToken.gitlab.com', 'glpat-test');
		const headersSeen: { [name: string]: string }[] = [];
		const gitlab = new CiStatusManager(dataSource, <never>{ get: secrets.get, store: secrets.set }, new Logger(), async (url, headers) => { requests.push(url); headersSeen.push(headers); return { status: 200, headers: {}, body: [{ name: 'test', status: 'success', target_url: 'https://gitlab.com/group/project/-/jobs/1' }] }; });
		gitlab.registerView(<never>{ sendMessage: (msg: ResponseMessage) => messages.push(msg) });
		await gitlab.fetchStatuses('/gl', [H1], 30, {});
		await flush();
		expect(requests).toEqual(['https://gitlab.com/api/v4/projects/group%2Fproject/repository/commits/' + H1 + '/statuses?per_page=100']);
		expect(headersSeen[0]['PRIVATE-TOKEN']).toBe('glpat-test');
		expect(messages[0].command === 'fetchCiStatus' && messages[0].statuses[H1].state).toBe('success');
		remotes.url = 'git@github.com:owner/repo.git';
	});
});
