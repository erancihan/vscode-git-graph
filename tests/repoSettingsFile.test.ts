import { defaultRepoState } from '../src/repoManager';
import { applyRepoSettings, exportRepoSettings, hashRepoSettings, parseRepoSettings, repoSettingsMatch, serializeRepoSettings } from '../src/repoSettingsFile';

describe('repository settings file', () => {
	const state = { ...defaultRepoState(), name: 'Mine', columnWidths: [1, 2, 3, 4], hideRemotes: ['upstream'], showTags: false, issueLinkingConfig: { issue: '#(\\d+)', url: 'https://example.com/$1' }, onLoad: { showCheckedOutBranch: true, showSpecificBranches: ['develop'] } };

	it('exports the shareable fields only', () => {
		const exported = exportRepoSettings(state);
		expect(Object.keys(exported).sort()).toEqual(['hideRemotes', 'includeCommitsMentionedByReflogs', 'issueLinkingConfig', 'onLoad', 'onlyFollowFirstParent', 'showStashes', 'showTags']);
		expect(exported.hideRemotes).toEqual(['upstream']);
		expect(JSON.stringify(exported)).not.toMatch(/Mine|columnWidths/);
	});

	it('round-trips through the file format', () => {
		const text = serializeRepoSettings(state);
		expect(text.endsWith('\n')).toBe(true);
		const parsed = parseRepoSettings(text)!;
		expect(applyRepoSettings(defaultRepoState(), parsed)).toEqual({ ...defaultRepoState(), hideRemotes: ['upstream'], showTags: false, issueLinkingConfig: state.issueLinkingConfig, onLoad: state.onLoad });
		expect(repoSettingsMatch(state, parsed)).toBe(true);
		expect(repoSettingsMatch(defaultRepoState(), parsed)).toBe(false);
	});

	it('reads only the fields the file mentions and drops invalid values', () => {
		const parsed = parseRepoSettings('{"showTags": true, "name": "Team", "hideRemotes": ["a", 5], "issueLinkingConfig": {"issue": "x", "url": "ftp://no"}, "onLoad": {"showCheckedOutBranch": "yes"}, "__proto__": {"polluted": true}, "showStashes": null}')!;
		expect(parsed).toEqual({ showTags: true, hideRemotes: ['a'], showStashes: null });
		const applied = applyRepoSettings(state, parsed);
		expect(applied.name).toBe('Mine');
		expect(applied.showTags).toBe(true);
		expect(applied.hideRemotes).toEqual(['a']);
		expect(applied.showStashes).toBeNull();
		expect(applied.issueLinkingConfig).toEqual(state.issueLinkingConfig);
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	});

	it('rejects text that is not a JSON object', () => {
		expect(parseRepoSettings('[]')).toBeNull();
		expect(parseRepoSettings('null')).toBeNull();
		expect(parseRepoSettings('not json')).toBeNull();
		expect(parseRepoSettings('{' + '"a":1,'.repeat(20000) + '"b":2}')).toBeNull();
		expect(parseRepoSettings('{}')).toEqual({});
	});

	it('hashes the text', () => {
		expect(hashRepoSettings('a')).toHaveLength(64);
		expect(hashRepoSettings('a')).not.toBe(hashRepoSettings('b'));
	});
});
