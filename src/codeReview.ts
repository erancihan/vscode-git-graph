import { CodeReview, CodeReviewSet } from './types';

/** Reviews that were not touched for this long are dropped when the extension starts. */
export const CODE_REVIEW_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/** Identifier of a review: the commit hash, or "<from>-<to>" for a comparison. */
export function codeReviewId(fromHash: string | null, toHash: string): string {
	return fromHash !== null && fromHash !== toHash + '^' ? fromHash + '-' + toHash : toHash;
}

/** Keys that would reach Object.prototype when used on a plain object. */
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

export function isSafeObjectKey(key: string) {
	return typeof key === 'string' && key !== '' && UNSAFE_KEYS.indexOf(key) === -1;
}

/** Review ids are commit hashes, "<from>-<to>" pairs, or "<from>-*" for the working tree. */
export function isValidCodeReviewId(id: unknown): id is string {
	return typeof id === 'string' && /^[0-9a-fA-F]{4,64}(-([0-9a-fA-F]{4,64}|\*))?$/.test(id);
}

/** Shape check for a review that arrives from the webview or from stored state. */
export function isValidCodeReview(value: unknown): value is CodeReview {
	if (!value || typeof value !== 'object') return false;
	const review = <{ [key: string]: unknown }>value;
	return isValidCodeReviewId(review.id)
		&& typeof review.lastActive === 'number' && isFinite(review.lastActive)
		&& (review.lastViewedFile === null || typeof review.lastViewedFile === 'string')
		&& Array.isArray(review.remainingFiles) && review.remainingFiles.every((file) => typeof file === 'string');
}

/** Removes expired reviews and repositories without reviews. Returns a new set. */
export function pruneCodeReviews(reviews: CodeReviewSet, now: number): CodeReviewSet {
	const result: CodeReviewSet = {};
	if (!reviews || typeof reviews !== 'object') return result;
	for (const repo of Object.keys(reviews)) {
		if (!isSafeObjectKey(repo) || !reviews[repo] || typeof reviews[repo] !== 'object') continue;
		const kept: { [id: string]: CodeReview } = {};
		for (const id of Object.keys(reviews[repo])) {
			const review = reviews[repo][id];
			if (isValidCodeReview(review) && review.id === id && now - review.lastActive < CODE_REVIEW_EXPIRY_MS) kept[id] = review;
		}
		if (Object.keys(kept).length > 0) result[repo] = kept;
	}
	return result;
}

/** A review after a file was viewed: the file leaves the remaining list and becomes the last viewed file. */
export function markFileReviewed(review: CodeReview, filePath: string, now: number): CodeReview {
	return {
		id: review.id,
		lastActive: now,
		lastViewedFile: filePath,
		remainingFiles: review.remainingFiles.filter((file) => file !== filePath)
	};
}

/** A review after a file was marked as not reviewed again. */
export function markFileUnreviewed(review: CodeReview, filePath: string, now: number): CodeReview {
	return {
		id: review.id,
		lastActive: now,
		lastViewedFile: review.lastViewedFile,
		remainingFiles: review.remainingFiles.indexOf(filePath) > -1 ? review.remainingFiles : review.remainingFiles.concat([filePath])
	};
}

/** The commit (and the commit it is compared with) behind a review id, or null for a malformed id. */
export function parseCodeReviewId(id: string): { commitHash: string, compareWithHash: string | null } | null {
	const match = /^([0-9a-f]{40})(?:-([0-9a-f]{40}))?$/.exec(id);
	if (match === null) return null;
	// "<from>-<to>": the comparison opened on <to> with <from> as the other side
	return match[2] !== undefined ? { commitHash: match[2], compareWithHash: match[1] } : { commitHash: match[1], compareWithHash: null };
}

/** Quick pick texts for a review: repository and commits, remaining files, last activity. */
export function describeCodeReview(repo: string, review: CodeReview, now: number): { label: string, description: string, detail: string } {
	const parsed = parseCodeReviewId(review.id);
	const what = parsed === null ? review.id : parsed.compareWithHash !== null ? parsed.compareWithHash.substring(0, 8) + ' \u2194 ' + parsed.commitHash.substring(0, 8) : parsed.commitHash.substring(0, 8);
	const ageMinutes = Math.max(0, Math.round((now - review.lastActive) / 60000));
	const age = ageMinutes < 60 ? ageMinutes + ' min ago' : ageMinutes < 60 * 48 ? Math.round(ageMinutes / 60) + ' h ago' : Math.round(ageMinutes / 1440) + ' days ago';
	return {
		label: repo.substring(repo.lastIndexOf('/') + 1) + ': ' + what,
		description: review.remainingFiles.length + ' file' + (review.remainingFiles.length !== 1 ? 's' : '') + ' left',
		detail: repo + ' \u00b7 last active ' + age
	};
}
