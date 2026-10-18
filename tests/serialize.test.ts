import { serializeForScript } from '../src/gitGraphView';

describe('serializeForScript', () => {
	it('escapes characters that could close a script element or break the parser', () => {
		const json = serializeForScript({ path: '</script><img src=x onerror=alert(1)>', text: 'a\u2028b\u2029c' });
		expect(json).not.toContain('<');
		expect(json).not.toContain('>');
		expect(json).not.toContain('\u2028');
		expect(json).not.toContain('\u2029');
		expect(JSON.parse(json)).toEqual({ path: '</script><img src=x onerror=alert(1)>', text: 'a\u2028b\u2029c' });
	});
});
