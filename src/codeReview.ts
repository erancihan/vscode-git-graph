import { CodeReview, CodeReviewSet } from './types';

/** Reviews that were not touched for this long are dropped when the extension starts. */
export const CODE_REVIEW_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000;

/** Identifier of a review: the commit hash, or "<from>-<to>" for a comparison. */
export function codeReviewId(fromHash: string | null, toHash: string): string {
	return fromHash !== null && fromHash !== toHash + '^' ? fromHash + '-' + toHash : toHash;
}

/** Removes expired reviews and repositories without reviews. Returns a new set. */
export function pruneCodeReviews(reviews: CodeReviewSet, now: number): CodeReviewSet {
	const result: CodeReviewSet = {};
	for (const repo of Object.keys(reviews)) {
		const kept: { [id: string]: CodeReview } = {};
		for (const id of Object.keys(reviews[repo])) {
			const review = reviews[repo][id];
			if (review && typeof review.lastActive === 'number' && now - review.lastActive < CODE_REVIEW_EXPIRY_MS) kept[id] = review;
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
