import { CODE_REVIEW_EXPIRY_MS, codeReviewId, isSafeObjectKey, isValidCodeReview, isValidCodeReviewId, markFileReviewed, markFileUnreviewed, pruneCodeReviews } from '../src/codeReview';

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
		const fresh = { id: 'aaaa1111', lastActive: now - 1000, lastViewedFile: null, remainingFiles: ['x'] };
		const old = { id: 'bbbb2222', lastActive: now - CODE_REVIEW_EXPIRY_MS - 1, lastViewedFile: null, remainingFiles: [] };
		expect(pruneCodeReviews({ '/r1': { aaaa1111: fresh, bbbb2222: old }, '/r2': { bbbb2222: old } }, now)).toEqual({ '/r1': { aaaa1111: fresh } });
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

describe('validation', () => {
	it('accepts review ids of commits and comparisons only', () => {
		expect(isValidCodeReviewId('a1b2c3d4')).toBe(true);
		expect(isValidCodeReviewId('a1b2c3d4-ffffffff')).toBe(true);
		expect(isValidCodeReviewId('a1b2c3d4-*')).toBe(true);
		expect(isValidCodeReviewId('__proto__')).toBe(false);
		expect(isValidCodeReviewId('abc')).toBe(false);
		expect(isValidCodeReviewId(42)).toBe(false);
	});

	it('rejects unsafe object keys', () => {
		expect(isSafeObjectKey('/path/to/repo')).toBe(true);
		expect(isSafeObjectKey('__proto__')).toBe(false);
		expect(isSafeObjectKey('constructor')).toBe(false);
		expect(isSafeObjectKey('')).toBe(false);
	});

	it('checks the shape of a review', () => {
		expect(isValidCodeReview({ id: 'a1b2c3d4', lastActive: 1, lastViewedFile: null, remainingFiles: ['a'] })).toBe(true);
		expect(isValidCodeReview({ id: 'a1b2c3d4', lastActive: 1, lastViewedFile: 'a', remainingFiles: [] })).toBe(true);
		expect(isValidCodeReview({ id: 'a1b2c3d4', lastActive: 'now', lastViewedFile: null, remainingFiles: [] })).toBe(false);
		expect(isValidCodeReview({ id: 'a1b2c3d4', lastActive: 1, lastViewedFile: null, remainingFiles: [1] })).toBe(false);
		expect(isValidCodeReview(null)).toBe(false);
	});

	it('prunes entries with unsafe keys or invalid shapes', () => {
		const now = 1_000_000_000_000, fresh = { id: 'a1b2c3d4', lastActive: now, lastViewedFile: null, remainingFiles: [] };
		const polluted = JSON.parse('{"__proto__": {"a1b2c3d4": {"id": "a1b2c3d4", "lastActive": ' + now + ', "lastViewedFile": null, "remainingFiles": []}}, "/repo": {"a1b2c3d4": {"id": "a1b2c3d4", "lastActive": ' + now + ', "lastViewedFile": null, "remainingFiles": []}, "bad": {"id": "a1b2c3d4"}}}');
		expect(pruneCodeReviews(polluted, now)).toEqual({ '/repo': { a1b2c3d4: fresh } });
	});
});
