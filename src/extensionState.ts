import * as fs from 'fs';
import { ExtensionContext, Memento } from 'vscode';
import { Avatar, AvatarCache, GitRepoSet } from './types';
import { getPathFromStr } from './utils';

const AVATAR_STORAGE_FOLDER = '/avatars';
const AVATAR_CACHE = 'avatarCache';
const LAST_ACTIVE_REPO = 'lastActiveRepo';
const REPO_STATES = 'repoStates';
const IGNORED_REPOS = 'ignoredRepos';
const MANUALLY_ADDED_REPOS = 'manuallyAddedRepos';

export class ExtensionState {
	private globalState: Memento;
	private workspaceState: Memento;
	private globalStoragePath: string;
	private avatarStorageAvailable: boolean = false;

	constructor(context: ExtensionContext) {
		this.globalState = context.globalState;
		this.workspaceState = context.workspaceState;

		this.globalStoragePath = getPathFromStr(context.globalStoragePath);
		fs.stat(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err) => {
			if (!err) {
				this.avatarStorageAvailable = true;
			} else {
				fs.mkdir(this.globalStoragePath, () => {
					fs.mkdir(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err) => {
						if (!err) this.avatarStorageAvailable = true;
					});
				});
			}
		});
	}

	/* Discovered Repos */
	public getRepos() {
		return this.workspaceState.get<GitRepoSet>(REPO_STATES, {});
	}
	public saveRepos(gitRepoSet: GitRepoSet) {
		this.workspaceState.update(REPO_STATES, gitRepoSet);
	}

	/* Repos removed by the user: discovery must not add them again */
	public getIgnoredRepos() {
		return this.workspaceState.get<string[]>(IGNORED_REPOS, []);
	}
	public setIgnoredRepos(repos: string[]) {
		this.workspaceState.update(IGNORED_REPOS, repos);
	}

	/* Repos added by the user: kept even when they are outside the workspace folders */
	public getManuallyAddedRepos() {
		return this.workspaceState.get<string[]>(MANUALLY_ADDED_REPOS, []);
	}
	public setManuallyAddedRepos(repos: string[]) {
		this.workspaceState.update(MANUALLY_ADDED_REPOS, repos);
	}

	/* Last Active Repo */
	public getLastActiveRepo() {
		return this.workspaceState.get<string | null>(LAST_ACTIVE_REPO, null);
	}
	public setLastActiveRepo(repo: string | null) {
		this.workspaceState.update(LAST_ACTIVE_REPO, repo);
	}

	/* Avatars */
	public isAvatarStorageAvailable() {
		return this.avatarStorageAvailable;
	}
	public getAvatarStoragePath() {
		return this.globalStoragePath + AVATAR_STORAGE_FOLDER;
	}
	public getAvatarCache() {
		return this.globalState.get<AvatarCache>(AVATAR_CACHE, {});
	}
	public saveAvatar(email: string, avatar: Avatar) {
		const avatars = this.getAvatarCache();
		avatars[email] = avatar;
		this.globalState.update(AVATAR_CACHE, avatars);
	}
	public removeAvatarFromCache(email: string) {
		const avatars = this.getAvatarCache();
		delete avatars[email];
		this.globalState.update(AVATAR_CACHE, avatars);
	}
	public clearAvatarCache() {
		this.globalState.update(AVATAR_CACHE, {});
		fs.readdir(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err, files) => {
			if (err) return;
			for (let i = 0; i < files.length; i++) {
				fs.unlink(this.globalStoragePath + AVATAR_STORAGE_FOLDER + '/' + files[i], () => { });
			}
		});
	}
}