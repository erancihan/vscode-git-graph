import * as https from 'https';
import * as vscode from 'vscode';
import { DataSource } from './dataSource';
import type { GitGraphView } from './gitGraphView';
import { Logger } from './logger';
import { parseRemoteUrl } from './remoteUrl';
import { CiCheck, CiCheckState, CiHostMap, CiProviderType, CommitCiStatus } from './types';

/** Where to ask for the CI status of a repository's commits. */
export interface CiEndpoint {
	type: CiProviderType;
	apiBase: string; // without a trailing slash
	owner: string;
	repo: string;
	host: string;
}

/** The REST endpoint for a remote URL: github.com and gitlab.com are known, other hosts come from the `hosts` setting. */
export function resolveCiEndpoint(remoteUrl: string | null, hosts: CiHostMap): CiEndpoint | null {
	const parsed = parseRemoteUrl(remoteUrl);
	if (parsed === null) return null;
	const host = parsed.host.replace(/^www\./, '');
	let type: CiProviderType | null = null;
	if (Object.prototype.hasOwnProperty.call(hosts, host) && (hosts[host] === 'GitHub' || hosts[host] === 'GitLab')) type = hosts[host];
	else if (host === 'github.com') type = 'GitHub';
	else if (host === 'gitlab.com') type = 'GitLab';
	if (type === null || !/^[a-z0-9.-]+$/.test(host)) return null;
	const apiBase = type === 'GitHub' ? (host === 'github.com' ? 'https://api.github.com' : 'https://' + host + '/api/v3') : 'https://' + host + '/api/v4';
	return { type: type, apiBase: apiBase, owner: parsed.owner, repo: parsed.repo, host: host };
}

/** One state for a list of checks: a failure wins, then a pending check, then success. */
export function summariseChecks(checks: ReadonlyArray<CiCheck>): CiCheckState {
	if (checks.some((check) => check.state === 'failure')) return 'failure';
	if (checks.some((check) => check.state === 'pending')) return 'pending';
	if (checks.some((check) => check.state === 'success')) return 'success';
	return 'none';
}

function str(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

/** Only http(s) links are kept; anything else would not be safe to open from the graph. */
export function safeCheckUrl(value: unknown): string | null {
	const url = str(value);
	return url !== null && /^https?:\/\//i.test(url) ? url : null;
}

/** A GitHub check run (`/commits/{sha}/check-runs`) as a check. */
export function mapGitHubCheckRun(run: unknown): CiCheck | null {
	if (typeof run !== 'object' || run === null) return null;
	const r = <{ name?: unknown, status?: unknown, conclusion?: unknown, html_url?: unknown }>run;
	const name = str(r.name);
	if (name === null) return null;
	let state: CiCheckState;
	if (r.status !== 'completed') {
		state = 'pending';
	} else {
		switch (r.conclusion) {
			case 'success': case 'neutral': case 'skipped': state = 'success'; break;
			case 'failure': case 'timed_out': case 'cancelled': case 'action_required': case 'startup_failure': case 'stale': state = 'failure'; break;
			default: state = 'pending';
		}
	}
	return { name: name, state: state, url: safeCheckUrl(r.html_url) };
}

/** A GitHub commit status (`/commits/{sha}/status`, field `statuses[]`) as a check. */
export function mapGitHubStatus(status: unknown): CiCheck | null {
	if (typeof status !== 'object' || status === null) return null;
	const s = <{ context?: unknown, state?: unknown, target_url?: unknown }>status;
	const name = str(s.context);
	if (name === null) return null;
	const state: CiCheckState = s.state === 'success' ? 'success' : s.state === 'failure' || s.state === 'error' ? 'failure' : 'pending';
	return { name: name, state: state, url: safeCheckUrl(s.target_url) };
}

/** A GitLab commit status (`/repository/commits/{sha}/statuses`) as a check. */
export function mapGitLabStatus(status: unknown): CiCheck | null {
	if (typeof status !== 'object' || status === null) return null;
	const s = <{ name?: unknown, status?: unknown, target_url?: unknown }>status;
	const name = str(s.name);
	if (name === null) return null;
	let state: CiCheckState;
	switch (s.status) {
		case 'success': case 'skipped': state = 'success'; break;
		case 'failed': case 'canceled': state = 'failure'; break;
		default: state = 'pending'; // created, pending, running, manual, waiting_for_resource, scheduled
	}
	return { name: name, state: state, url: safeCheckUrl(s.target_url) };
}

/**
 * When a response says the rate limit is used up, the time (ms since the epoch) until which no
 * further request should be made, otherwise null. Understands GitHub's `x-ratelimit-*` headers,
 * GitLab's `ratelimit-reset` and the generic `retry-after` (seconds).
 */
export function rateLimitPauseUntil(statusCode: number, headers: { [name: string]: string }, now: number): number | null {
	const h = (name: string) => Object.prototype.hasOwnProperty.call(headers, name) ? headers[name] : undefined;
	if (statusCode !== 429 && !(statusCode === 403 && h('x-ratelimit-remaining') === '0')) return null;
	const retryAfter = h('retry-after');
	if (retryAfter !== undefined && /^\d+$/.test(retryAfter)) return now + parseInt(retryAfter) * 1000;
	const reset = h('x-ratelimit-reset') !== undefined ? h('x-ratelimit-reset') : h('ratelimit-reset');
	if (reset !== undefined && /^\d+$/.test(reset)) {
		const at = parseInt(reset) * 1000;
		if (at > now) return at;
	}
	return now + 60000;
}

export interface JsonResponse {
	status: number;
	headers: { [name: string]: string };
	body: unknown;
}
export type FetchJson = (url: string, headers: { [name: string]: string }) => Promise<JsonResponse>;

/** GET a JSON document over HTTPS. Non-JSON bodies resolve with `body: null`. */
export function httpsFetchJson(url: string, headers: { [name: string]: string }): Promise<JsonResponse> {
	return new Promise<JsonResponse>((resolve, reject) => {
		const request = https.get(url, { headers: Object.assign({ 'User-Agent': 'vscode-git-graph', 'Accept': 'application/json' }, headers), timeout: 15000 }, (response) => {
			const chunks: Buffer[] = [];
			response.on('data', (chunk: Buffer) => { if (chunks.reduce((sum, c) => sum + c.length, 0) < 4 * 1024 * 1024) chunks.push(chunk); });
			response.on('end', () => {
				const responseHeaders: { [name: string]: string } = {};
				for (const name of Object.keys(response.headers)) {
					const value = response.headers[name];
					if (typeof value === 'string') responseHeaders[name.toLowerCase()] = value;
				}
				let body: unknown = null;
				try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch (e) { body = null; }
				resolve({ status: response.statusCode || 0, headers: responseHeaders, body: body });
			});
		});
		request.on('timeout', () => request.destroy(new Error('timeout')));
		request.on('error', (e) => reject(e));
	});
}

const FINAL_TTL = Number.POSITIVE_INFINITY, PENDING_TTL = 2 * 60 * 1000, MAX_PARALLEL = 4;
const GITLAB_TOKEN_KEY = 'git-graph.ciStatus.gitlabToken.';

interface CacheEntry { status: CommitCiStatus; fetchedAt: number; }

/**
 * Fetches the CI status of commits from GitHub or GitLab and sends it to the Git Graph View. Results
 * are cached per commit for the session (final states for good, pending ones for two minutes), at most
 * four requests run at a time, and a rate-limit answer pauses the repository until the reset time.
 */
export class CiStatusManager {
	private readonly dataSource: DataSource;
	private readonly secrets: vscode.SecretStorage;
	private readonly logger: Logger;
	private readonly fetchJson: FetchJson;
	private view: GitGraphView | null = null;
	private cache: { [key: string]: CacheEntry } = {};
	private endpoints: { [repo: string]: CiEndpoint | null } = {};
	private queue: { repo: string, hash: string }[] = [];
	private queued: { [key: string]: boolean } = {};
	private active = 0;
	private pausedUntil: { [repo: string]: number } = {};
	private notified: { [key: string]: boolean } = {};
	private githubAsked = false;
	private gitlabAsked: { [host: string]: boolean } = {};

	constructor(dataSource: DataSource, secrets: vscode.SecretStorage, logger: Logger, fetchJson: FetchJson = httpsFetchJson) {
		this.dataSource = dataSource;
		this.secrets = secrets;
		this.logger = logger;
		this.fetchJson = fetchJson;
	}

	public registerView(view: GitGraphView) {
		this.view = view;
	}
	public deregisterView() {
		this.view = null;
	}

	/** Forget the remotes of a repository (after its remotes changed) so the endpoint is detected again. */
	public forgetRepo(repo: string) {
		delete this.endpoints[repo];
		delete this.pausedUntil[repo];
	}

	/** Send cached statuses at once and fetch the others, newest first. */
	public async fetchStatuses(repo: string, hashes: string[], maxCommits: number, hosts: CiHostMap) {
		const endpoint = await this.resolveEndpoint(repo, hosts);
		if (endpoint === null) return;
		const now = Date.now(), cached: { [hash: string]: CommitCiStatus } = {};
		let any = false;
		for (const hash of hashes.slice(0, Math.max(0, maxCommits))) {
			if (!/^[0-9a-f]{40}$/.test(hash)) continue;
			const key = repo + '|' + hash, entry = this.cache[key];
			if (entry !== undefined) {
				cached[hash] = entry.status;
				any = true;
				if (now - entry.fetchedAt < (entry.status.state === 'success' || entry.status.state === 'failure' ? FINAL_TTL : PENDING_TTL)) continue;
			}
			if (!this.queued[key]) {
				this.queued[key] = true;
				this.queue.push({ repo: repo, hash: hash });
			}
		}
		if (any) this.send(repo, cached);
		this.pump();
	}

	private send(repo: string, statuses: { [hash: string]: CommitCiStatus }) {
		if (this.view !== null) this.view.sendMessage({ command: 'fetchCiStatus', repo: repo, statuses: statuses });
	}

	private async resolveEndpoint(repo: string, hosts: CiHostMap): Promise<CiEndpoint | null> {
		if (Object.prototype.hasOwnProperty.call(this.endpoints, repo)) return this.endpoints[repo];
		const remotes = await this.dataSource.getRemoteDetails(repo);
		const origin = remotes.find((remote) => remote.name === 'origin') || remotes[0];
		const endpoint = origin !== undefined ? resolveCiEndpoint(origin.url, hosts) : null;
		this.endpoints[repo] = endpoint;
		if (endpoint === null) this.logger.log('CI status: no supported provider for the remotes of ' + repo);
		return endpoint;
	}

	private pump() {
		while (this.active < MAX_PARALLEL && this.queue.length > 0) {
			const item = this.queue.shift()!;
			const now = Date.now();
			if (this.pausedUntil[item.repo] !== undefined && this.pausedUntil[item.repo] > now) {
				delete this.queued[item.repo + '|' + item.hash];
				continue;
			}
			this.active++;
			this.fetchOne(item.repo, item.hash).catch((e) => {
				this.logger.logError('CI status: ' + (e instanceof Error ? e.message : String(e)));
			}).then(() => {
				this.active--;
				delete this.queued[item.repo + '|' + item.hash];
				this.pump();
			});
		}
	}

	private async fetchOne(repo: string, hash: string) {
		const endpoint = this.endpoints[repo];
		if (endpoint === null || endpoint === undefined) return;
		const headers = await this.authHeaders(endpoint);
		if (headers === null) return;
		const project = encodeURIComponent(endpoint.owner) + (endpoint.type === 'GitHub' ? '/' : '%2F') + encodeURIComponent(endpoint.repo);
		const urls = endpoint.type === 'GitHub'
			? [endpoint.apiBase + '/repos/' + project + '/commits/' + hash + '/check-runs?per_page=100', endpoint.apiBase + '/repos/' + project + '/commits/' + hash + '/status']
			: [endpoint.apiBase + '/projects/' + project + '/repository/commits/' + hash + '/statuses?per_page=100'];
		const checks: CiCheck[] = [];
		for (const url of urls) {
			const response = await this.fetchJson(url, headers);
			const pause = rateLimitPauseUntil(response.status, response.headers, Date.now());
			if (pause !== null) {
				this.pausedUntil[repo] = pause;
				this.notify(repo + '|rate', vscode.l10n.t('Git Graph: The {0} API rate limit is used up. CI status fetching pauses until {1}.', endpoint.type, new Date(pause).toLocaleTimeString()));
				return;
			}
			if (response.status === 401 || response.status === 403) {
				this.notify(repo + '|auth', vscode.l10n.t('Git Graph: {0} refused the CI status request (HTTP {1}). Check the token or sign in again.', endpoint.type, response.status));
				return;
			}
			if (response.status === 404) continue; // no checks, or the commit is not on the remote yet
			if (response.status !== 200) {
				this.logger.logError('CI status: ' + url + ' answered HTTP ' + response.status);
				return;
			}
			const body = <{ check_runs?: unknown, statuses?: unknown }>(typeof response.body === 'object' && response.body !== null ? response.body : {});
			if (endpoint.type === 'GitHub' && Array.isArray(body.check_runs)) body.check_runs.forEach((run) => { const check = mapGitHubCheckRun(run); if (check !== null) checks.push(check); });
			else if (endpoint.type === 'GitHub' && Array.isArray(body.statuses)) body.statuses.forEach((status) => { const check = mapGitHubStatus(status); if (check !== null) checks.push(check); });
			else if (endpoint.type === 'GitLab' && Array.isArray(response.body)) response.body.forEach((status) => { const check = mapGitLabStatus(status); if (check !== null) checks.push(check); });
		}
		const status: CommitCiStatus = { state: summariseChecks(checks), checks: checks.slice(0, 50) };
		this.cache[repo + '|' + hash] = { status: status, fetchedAt: Date.now() };
		const statuses: { [hash: string]: CommitCiStatus } = {};
		statuses[hash] = status;
		this.send(repo, statuses);
	}

	/** Authorization headers for the endpoint, asking the user once per session when nothing is stored. */
	private async authHeaders(endpoint: CiEndpoint): Promise<{ [name: string]: string } | null> {
		if (endpoint.type === 'GitHub') {
			let session: vscode.AuthenticationSession | undefined;
			try {
				session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false, silent: true });
				if (session === undefined && !this.githubAsked) {
					this.githubAsked = true;
					session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
				}
			} catch (e) {
				this.logger.logError('CI status: GitHub sign-in failed: ' + (e instanceof Error ? e.message : String(e)));
			}
			// Public repositories work without a token, with a much lower rate limit
			const headers: { [name: string]: string } = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
			if (session !== undefined) headers['Authorization'] = 'Bearer ' + session.accessToken;
			return headers;
		}
		let token = await this.secrets.get(GITLAB_TOKEN_KEY + endpoint.host);
		if (token === undefined && !this.gitlabAsked[endpoint.host]) {
			this.gitlabAsked[endpoint.host] = true;
			const value = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Git Graph: Personal access token for {0} (scope read_api), used to read the CI status of commits. It is stored in the VS Code secret storage.', endpoint.host), password: true, ignoreFocusOut: true });
			if (typeof value === 'string' && value.trim() !== '') {
				token = value.trim();
				await this.secrets.store(GITLAB_TOKEN_KEY + endpoint.host, token);
			}
		}
		return token !== undefined ? { 'PRIVATE-TOKEN': token } : null;
	}

	private notify(key: string, message: string) {
		if (this.notified[key]) return;
		this.notified[key] = true;
		this.logger.logError(message);
		vscode.window.showWarningMessage(message);
	}
}
