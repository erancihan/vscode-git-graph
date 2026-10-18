import * as crypto from 'crypto';

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
	if (remoteUrl === null) return { type: 'gravatar' };
	const url = remoteUrl.trim();
	let host: string, path: string;
	const scp = /^(?:[A-Za-z0-9._-]+@)?([A-Za-z0-9.-]+):(?!\/\/)(.+)$/.exec(url); // git@github.com:owner/repo.git
	const full = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@\/]+@)?([A-Za-z0-9.-]+)(?::\d+)?\/(.*)$/.exec(url); // https://github.com/owner/repo.git, ssh://git@github.com/owner/repo
	if (full !== null) {
		host = full[1]; path = full[2];
	} else if (scp !== null) {
		host = scp[1]; path = scp[2];
	} else {
		return { type: 'gravatar' };
	}
	host = host.toLowerCase();
	const parts = path.replace(/\/+$/, '').split('/').filter((part) => part !== '');
	if (host === 'github.com' || host === 'www.github.com') {
		if (parts.length >= 2) return { type: 'github', owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
		return { type: 'gravatar' };
	}
	if (host === 'gitlab.com' || host === 'www.gitlab.com') return { type: 'gitlab' };
	return { type: 'gravatar' };
}

/** Gravatar hashes the trimmed, lower-cased address; the hash is also the file name of the cached image. */
export function gravatarHash(email: string) {
	return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

/** Pixel size requested from the avatar services: twice the displayed 54px for high DPI displays. */
export const AVATAR_PIXEL_SIZE = 108;
