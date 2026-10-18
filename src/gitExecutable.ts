import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/** Environment and platform inputs of the lookup, injectable for tests. */
export interface GitLookupEnvironment {
	platform: NodeJS.Platform;
	env: NodeJS.ProcessEnv;
}

/**
 * Find a usable git executable.
 *
 * Order: the candidates from the `git.path` setting; then `git` on PATH; then the well-known install
 * locations of Git for Windows and the Homebrew and Xcode locations on macOS. Each candidate must run
 * `git --version` successfully. When nothing qualifies the result is `git`, so the error that the
 * user sees comes from the operating system ("not found") rather than from this extension.
 */
export async function findGitExecutable(configuredPaths: string[], environment: GitLookupEnvironment = { platform: process.platform, env: process.env }): Promise<string> {
	const candidates = configuredPaths.map((p) => p.trim()).filter((p) => p !== '');
	candidates.push(...pathCandidates(environment));
	candidates.push(...wellKnownCandidates(environment));

	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (seen.has(candidate)) continue;
		seen.add(candidate);
		if (await isGitExecutable(candidate)) return candidate;
	}
	return 'git';
}

/** Every `git` (or `git.exe`) found in the directories of PATH, in PATH order. */
function pathCandidates(environment: GitLookupEnvironment) {
	const pathVar = environment.env.PATH || environment.env.Path || '';
	const names = environment.platform === 'win32' ? ['git.exe', 'git.cmd'] : ['git'];
	const result: string[] = [];
	for (const dir of pathVar.split(path.delimiter)) {
		if (dir === '') continue;
		for (const name of names) {
			result.push(path.join(dir, name));
		}
	}
	return result;
}

/** Install locations that are not always on PATH. */
function wellKnownCandidates(environment: GitLookupEnvironment) {
	const env = environment.env;
	if (environment.platform === 'win32') {
		const roots = [env['ProgramW6432'], env['ProgramFiles'], env['ProgramFiles(x86)'], env['LocalAppData'] ? path.join(env['LocalAppData'], 'Programs') : undefined];
		return roots.filter((r): r is string => typeof r === 'string' && r !== '').map((r) => path.join(r, 'Git', 'cmd', 'git.exe'));
	}
	if (environment.platform === 'darwin') {
		return ['/opt/homebrew/bin/git', '/usr/local/bin/git', '/usr/bin/git'];
	}
	return ['/usr/bin/git', '/usr/local/bin/git'];
}

/** Resolve to true when `candidate` exists and `candidate --version` exits with 0. */
function isGitExecutable(candidate: string) {
	return new Promise<boolean>((resolve) => {
		fs.stat(candidate, (err, stats) => {
			if (err || !stats.isFile()) {
				resolve(false);
				return;
			}
			let settled = false;
			const done = (ok: boolean) => {
				if (!settled) {
					settled = true;
					resolve(ok);
				}
			};
			try {
				const child = cp.spawn(candidate, ['--version'], { stdio: 'ignore' });
				child.on('error', () => done(false));
				child.on('close', (code) => done(code === 0));
			} catch {
				done(false);
			}
		});
	});
}
