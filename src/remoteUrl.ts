import { CustomPullRequestProvider, PullRequestProvider } from './types';

export interface ParsedRemoteUrl {
	host: string; // lower case
	owner: string; // everything between the host and the last path segment ("group/subgroup" on GitLab)
	repo: string; // last path segment without ".git"
}

/**
 * Splits a remote URL into host, owner and repository. Understands `scheme://[user@]host[:port]/path`
 * and the scp-like `[user@]host:path` form. Returns null for local paths and URLs without two path
 * segments.
 */
export function parseRemoteUrl(remoteUrl: string | null): ParsedRemoteUrl | null {
	if (remoteUrl === null) return null;
	const url = remoteUrl.trim();
	let host: string, path: string;
	const full = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@\/]+@)?([A-Za-z0-9.-]+)(?::\d+)?\/(.*)$/.exec(url);
	const scp = /^(?:[A-Za-z0-9._-]+@)?([A-Za-z0-9.-]+):(?!\/\/)(.+)$/.exec(url);
	if (full !== null) {
		host = full[1]; path = full[2];
	} else if (scp !== null) {
		host = scp[1]; path = scp[2];
	} else {
		return null;
	}
	const parts = path.replace(/\/+$/, '').split('/').filter((part) => part !== '');
	if (parts.length < 2) return null;
	return { host: host.toLowerCase(), owner: parts.slice(0, -1).join('/'), repo: parts[parts.length - 1].replace(/\.git$/, '') };
}

/** The pull request provider that fits a remote, from its host name. */
export function detectPullRequestProvider(parsed: ParsedRemoteUrl | null): PullRequestProvider | null {
	if (parsed === null) return null;
	if (parsed.host === 'github.com' || parsed.host === 'www.github.com') return 'GitHub';
	if (parsed.host === 'gitlab.com' || parsed.host === 'www.gitlab.com') return 'GitLab';
	if (parsed.host === 'bitbucket.org' || parsed.host === 'www.bitbucket.org') return 'Bitbucket';
	return null;
}

export interface PullRequestEndpoint {
	remote: ParsedRemoteUrl;
	branch: string;
}

/**
 * The URL of the "new pull request" page of a provider. Custom providers use a template with the
 * variables $sourceOwner, $sourceRepo, $sourceBranch, $destinationOwner, $destinationRepo,
 * $destinationBranch (branch names URI-encoded). Returns null when the provider is unknown or the
 * resulting URL is not http(s).
 */
export function buildPullRequestUrl(provider: PullRequestProvider, source: PullRequestEndpoint, destination: PullRequestEndpoint, customProviders: CustomPullRequestProvider[]): string | null {
	const enc = encodeURIComponent;
	let url: string | null = null;
	switch (provider) {
		case 'GitHub':
			// Cross-fork compare: owner:branch on the source side
			url = 'https://' + destination.remote.host + '/' + destination.remote.owner + '/' + destination.remote.repo + '/compare/' + enc(destination.branch) + '...' + enc(source.remote.owner) + ':' + enc(source.branch) + '?expand=1';
			break;
		case 'GitLab':
			url = 'https://' + source.remote.host + '/' + source.remote.owner + '/' + source.remote.repo + '/-/merge_requests/new?merge_request%5Bsource_branch%5D=' + enc(source.branch) + '&merge_request%5Btarget_branch%5D=' + enc(destination.branch);
			break;
		case 'Bitbucket':
			url = 'https://' + source.remote.host + '/' + source.remote.owner + '/' + source.remote.repo + '/pull-requests/new?source=' + enc(source.branch) + '&dest=' + enc(destination.remote.owner + '/' + destination.remote.repo + '::' + destination.branch) + '&t=1';
			break;
		default: {
			const custom = customProviders.find((p) => p.name === provider);
			if (!custom) return null;
			url = custom.templateUrl
				.replace(/\$sourceOwner/g, source.remote.owner)
				.replace(/\$sourceRepo/g, source.remote.repo)
				.replace(/\$sourceBranch/g, enc(source.branch))
				.replace(/\$destinationOwner/g, destination.remote.owner)
				.replace(/\$destinationRepo/g, destination.remote.repo)
				.replace(/\$destinationBranch/g, enc(destination.branch));
		}
	}
	return url !== null && /^https?:\/\/\S+$/i.test(url) ? url : null;
}
