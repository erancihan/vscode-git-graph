import * as fs from 'fs';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */
const { collectStrings } = require('../scripts/l10n-extract.js');

const root = path.join(__dirname, '..');
const placeholders = (text: string) => (text.match(/\{\d+\}/g) || []).sort().join(' ');

describe('localisation bundles', () => {
	const english: { [key: string]: string } = JSON.parse(fs.readFileSync(path.join(root, 'l10n', 'bundle.l10n.json'), 'utf8'));

	it('bundle.l10n.json matches the strings in the sources (run `npm run l10n` after changing strings)', () => {
		expect(Object.keys(english)).toEqual(collectStrings());
		for (const key of Object.keys(english)) expect(english[key]).toBe(key);
	});

	it('every translation only contains known strings and keeps the placeholders', () => {
		for (const name of fs.readdirSync(path.join(root, 'l10n'))) {
			const match = /^bundle\.l10n\.(.+)\.json$/.exec(name);
			if (match === null) continue;
			const translated: { [key: string]: string } = JSON.parse(fs.readFileSync(path.join(root, 'l10n', name), 'utf8'));
			for (const key of Object.keys(translated)) {
				expect({ locale: match[1], key: key, known: key in english }).toEqual({ locale: match[1], key: key, known: true });
				expect({ locale: match[1], key: key, placeholders: placeholders(translated[key]) }).toEqual({ locale: match[1], key: key, placeholders: placeholders(key) });
				expect(translated[key].trim()).not.toBe('');
			}
		}
	});

	it('package.nls.*.json only contain keys of package.nls.json', () => {
		const base = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8'));
		const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
		for (const key of Object.keys(base)) expect(pkg.indexOf('%' + key + '%')).not.toBe(-1);
		for (const name of fs.readdirSync(root)) {
			const match = /^package\.nls\.(.+)\.json$/.exec(name);
			if (match === null) continue;
			const translated = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
			for (const key of Object.keys(translated)) expect({ locale: match[1], key: key, known: key in base }).toEqual({ locale: match[1], key: key, known: true });
		}
	});
});
