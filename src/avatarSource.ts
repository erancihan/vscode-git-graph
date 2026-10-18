import * as crypto from 'crypto';
import { parseRemoteUrl } from './remoteUrl';

export interface GitHubRemoteSource {
	type: 'github';
	owner: string;
	repo: string;
}
export interface GitLabRemoteSource {
	type: 'gitlab';
}
export interface GravatarRemoteSource {
	type: 'gravatar';
}
export type RemoteSource = GitHubRemoteSource | GitLabRemoteSource | GravatarRemoteSource;

/**
 * Where to look for avatars, from the URL of the "origin" remote. Understands the HTTPS, SSH
 * (`git@host:owner/repo.git`, `ssh://git@host/owner/repo`) and `git://` forms of github.com and
 * gitlab.com URLs; everything else uses Gravatar.
 */
export function parseRemoteSource(remoteUrl: string | null): RemoteSource {
	const parsed = parseRemoteUrl(remoteUrl);
	if (parsed === null) return { type: 'gravatar' };
	if (parsed.host === 'github.com' || parsed.host === 'www.github.com') {
		// GitHub repositories have exactly one owner segment
		return parsed.owner.indexOf('/') === -1 ? { type: 'github', owner: parsed.owner, repo: parsed.repo } : { type: 'gravatar' };
	}
	if (parsed.host === 'gitlab.com' || parsed.host === 'www.gitlab.com') return { type: 'gitlab' };
	return { type: 'gravatar' };
}

/** Gravatar hashes the trimmed, lower-cased address; the hash is also the file name of the cached image. */
export function gravatarHash(email: string) {
	return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

/** Pixel size requested from the avatar services: twice the displayed 54px for high DPI displays. */
export const AVATAR_PIXEL_SIZE = 108;
