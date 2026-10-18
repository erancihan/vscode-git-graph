import * as fs from 'fs';
import { ExtensionContext, Memento } from 'vscode';
import { isSafeObjectKey, isValidCodeReview, pruneCodeReviews } from './codeReview';
import { Avatar, AvatarCache, CodeReview, CodeReviewSet, GitRepoSet } from './types';
import { getPathFromStr } from './utils';

const AVATAR_STORAGE_FOLDER = '/avatars';
const AVATAR_CACHE = 'avatarCache';
const LAST_ACTIVE_REPO = 'lastActiveRepo';
const REPO_STATES = 'repoStates';
const IGNORED_REPOS = 'ignoredRepos';
const MANUALLY_ADDED_REPOS = 'manuallyAddedRepos';
const CODE_REVIEWS = 'codeReviews';

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

	/* Code Reviews */
	public getCodeReviews(): CodeReviewSet {
		const reviews = this.workspaceState.get<CodeReviewSet>(CODE_REVIEWS, {});
		return reviews && typeof reviews === 'object' ? reviews : {};
	}
	public getCodeReviewsOfRepo(repo: string) {
		const reviews = this.getCodeReviews();
		return isSafeObjectKey(repo) && Object.prototype.hasOwnProperty.call(reviews, repo) && typeof reviews[repo] === 'object' ? reviews[repo] : {};
	}
	/** Store a review. Ignores keys that could reach Object.prototype and reviews of an unexpected shape. */
	public saveCodeReview(repo: string, review: CodeReview) {
		if (!isSafeObjectKey(repo) || !isValidCodeReview(review)) return this.getCodeReviewsOfRepo(repo);
		const reviews = this.getCodeReviews();
		if (!Object.prototype.hasOwnProperty.call(reviews, repo) || typeof reviews[repo] !== 'object') reviews[repo] = {};
		reviews[repo][review.id] = review;
		this.workspaceState.update(CODE_REVIEWS, reviews);
		return reviews[repo];
	}
	public removeCodeReview(repo: string, id: string) {
		if (!isSafeObjectKey(repo) || !isSafeObjectKey(id)) return this.getCodeReviewsOfRepo(repo);
		const reviews = this.getCodeReviews();
		if (Object.prototype.hasOwnProperty.call(reviews, repo) && typeof reviews[repo] === 'object') {
			delete reviews[repo][id];
			if (Object.keys(reviews[repo]).length === 0) delete reviews[repo];
		}
		this.workspaceState.update(CODE_REVIEWS, reviews);
		return Object.prototype.hasOwnProperty.call(reviews, repo) && typeof reviews[repo] === 'object' ? reviews[repo] : {};
	}
	public endAllCodeReviews() {
		const count = Object.keys(this.getCodeReviews()).reduce((sum, repo) => sum + Object.keys(this.getCodeReviews()[repo]).length, 0);
		this.workspaceState.update(CODE_REVIEWS, {});
		return count;
	}
	/** Drop reviews that were not touched for 90 days. Called once at start-up. */
	public pruneCodeReviews() {
		this.workspaceState.update(CODE_REVIEWS, pruneCodeReviews(this.getCodeReviews(), Date.now()));
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