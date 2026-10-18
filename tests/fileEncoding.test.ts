import { decodeFileContent } from '../src/dataSource';
import { getConfig } from '../src/config';
import { configurationValues, ViewColumn } from './mocks/vscode';

describe('file encoding and editor group', () => {
	afterEach(() => { delete configurationValues['git-graph']; });

	it('decodes bytes with the configured encoding and falls back to UTF-8', () => {
		const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "café" in ISO-8859-1
		expect(decodeFileContent(latin1, 'latin1')).toBe('café');
		expect(decodeFileContent(latin1, 'windows-1252')).toBe('café');
		expect(decodeFileContent(Buffer.from('café', 'utf8'), 'utf8')).toBe('café');
		expect(decodeFileContent(Buffer.from('café', 'utf8'), 'no-such-encoding')).toBe('café');
		expect(decodeFileContent(Buffer.from([0xef, 0xbb, 0xbf, 0x61]), 'utf8')).toBe('a'); // BOM removed
	});

	it('reads git-graph.fileEncoding with a safe fallback', () => {
		expect(getConfig().fileEncoding()).toBe('utf8');
		configurationValues['git-graph'] = { fileEncoding: 'shift_jis' };
		expect(getConfig().fileEncoding()).toBe('shift_jis');
		configurationValues['git-graph'] = { fileEncoding: 'bad value with spaces' };
		expect(getConfig().fileEncoding()).toBe('utf8');
	});

	it('maps git-graph.openNewTabEditorGroup to a view column', () => {
		expect(getConfig().openNewTabEditorGroup()).toBe(ViewColumn.Active);
		configurationValues['git-graph'] = { openNewTabEditorGroup: 'Beside' };
		expect(getConfig().openNewTabEditorGroup()).toBe(ViewColumn.Beside);
		configurationValues['git-graph'] = { openNewTabEditorGroup: 'Three' };
		expect(getConfig().openNewTabEditorGroup()).toBe(ViewColumn.Three);
		configurationValues['git-graph'] = { openDiffTabLocation: 'Two' };
		expect(getConfig().openNewTabEditorGroup()).toBe(ViewColumn.Two);
		configurationValues['git-graph'] = { openNewTabEditorGroup: 'Nowhere' };
		expect(getConfig().openNewTabEditorGroup()).toBe(ViewColumn.Active);
	});
});
