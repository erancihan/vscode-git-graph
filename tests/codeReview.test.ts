import { CODE_REVIEW_EXPIRY_MS, codeReviewId, markFileReviewed, markFileUnreviewed, pruneCodeReviews } from '../src/codeReview';

describe('codeReviewId', () => {
	it('uses the hash for a commit and from-to for a comparison', () => {
		expect(codeReviewId(null, 'abc')).toBe('abc');
		expect(codeReviewId('abc^', 'abc')).toBe('abc');
		expect(codeReviewId('def', 'abc')).toBe('def-abc');
		expect(codeReviewId('def', '*')).toBe('def-*');
	});
});

describe('pruneCodeReviews', () => {
	it('drops expired reviews and empty repositories', () => {
		const now = 1_000_000_000_000;
		const fresh = { id: 'a', lastActive: now - 1000, lastViewedFile: null, remainingFiles: ['x'] };
		const old = { id: 'b', lastActive: now - CODE_REVIEW_EXPIRY_MS - 1, lastViewedFile: null, remainingFiles: [] };
		expect(pruneCodeReviews({ '/r1': { a: fresh, b: old }, '/r2': { b: old } }, now)).toEqual({ '/r1': { a: fresh } });
		expect(pruneCodeReviews({}, now)).toEqual({});
	});
});

describe('markFileReviewed / markFileUnreviewed', () => {
	it('moves files between the remaining list and the reviewed state', () => {
		const review = { id: 'a', lastActive: 1, lastViewedFile: null, remainingFiles: ['a.txt', 'b.txt'] };
		const after = markFileReviewed(review, 'a.txt', 5);
		expect(after).toEqual({ id: 'a', lastActive: 5, lastViewedFile: 'a.txt', remainingFiles: ['b.txt'] });
		expect(markFileUnreviewed(after, 'a.txt', 6).remainingFiles.sort()).toEqual(['a.txt', 'b.txt']);
		expect(markFileUnreviewed(after, 'b.txt', 6).remainingFiles).toEqual(['b.txt']);
		expect(review.remainingFiles).toEqual(['a.txt', 'b.txt']); // inputs are not changed
	});
});
