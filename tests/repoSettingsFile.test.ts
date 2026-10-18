import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { defaultRepoState } from '../src/repoManager';
import { applyRepoSettings, describeRepoSettings, exportRepoSettings, hashRepoSettings, parseRepoSettings, repoSettingsFilePath, repoSettingsMatch, serializeRepoSettings, writeRepoSettingsFile } from '../src/repoSettingsFile';

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

	it('describes the incoming values for the confirmation prompt', () => {
		const parsed = parseRepoSettings(serializeRepoSettings(state))!;
		const text = describeRepoSettings(parsed);
		expect(text).toContain('issue linking: #(\\d+) -> https://example.com/$1');
		expect(text).toContain('hidden remotes: upstream');
		expect(text).toContain('branches on load: checked-out branch + develop');
		expect(describeRepoSettings({ showTags: null })).toBe('show tags: default');
	});

	it('refuses symbolic links in the file path and writes atomically otherwise', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-graph-settings-'));
		try {
			const repo = path.join(root, 'repo'), outside = path.join(root, 'outside');
			fs.mkdirSync(repo);
			fs.mkdirSync(outside);
			const file = repoSettingsFilePath(repo)!;
			expect(file).toBe(path.join(fs.realpathSync(repo), '.vscode', 'git-graph.json'));
			writeRepoSettingsFile(file, '{}\n');
			expect(fs.readFileSync(file, 'utf8')).toBe('{}\n');
			expect(fs.readdirSync(path.dirname(file))).toEqual(['git-graph.json']);
			// A symbolic link as the file
			fs.unlinkSync(file);
			fs.symlinkSync(path.join(outside, 'target.json'), file);
			expect(repoSettingsFilePath(repo)).toBeNull();
			fs.unlinkSync(file);
			// A symbolic link as the .vscode folder
			fs.rmdirSync(path.dirname(file));
			fs.symlinkSync(outside, path.dirname(file));
			expect(repoSettingsFilePath(repo)).toBeNull();
			expect(repoSettingsFilePath(path.join(root, 'missing'))).toBeNull();
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
