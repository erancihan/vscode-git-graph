// Collect the user-facing strings wrapped in t('...') (webview) and vscode.l10n.t('...') (extension host)
// into l10n/bundle.l10n.json, the English template translators copy to bundle.l10n.<locale>.json.
// Usage: node scripts/l10n-extract.js
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

/** The sorted list of English strings used in the sources. */
function collectStrings() {
	const files = [];
	for (const dir of ['src', 'web']) {
		for (const name of fs.readdirSync(path.join(root, dir))) if (name.endsWith('.ts') && !name.endsWith('.d.ts')) files.push(path.join(root, dir, name));
	}
	const keys = new Set();
	const pattern = /(?:^|[^A-Za-z0-9_.$])(?:vscode\.l10n\.)?t\('((?:[^'\\]|\\.)*)'/g;
	for (const file of files) {
		const text = fs.readFileSync(file, 'utf8');
		let match;
		while ((match = pattern.exec(text)) !== null) {
			keys.add(match[1].replace(/\\(['\\nr])/g, (m, c) => c === 'n' ? '\n' : c === 'r' ? '\r' : c));
		}
	}
	return [...keys].sort((a, b) => a.localeCompare(b));
}
module.exports = { collectStrings };
if (require.main !== module) return;

const sorted = collectStrings(), keys = new Set(sorted);
const bundle = {};
for (const key of sorted) bundle[key] = key;
const target = path.join(root, 'l10n', 'bundle.l10n.json');
fs.writeFileSync(target, JSON.stringify(bundle, null, '\t') + '\n');
// Report keys that a translation no longer needs or still lacks
for (const name of fs.readdirSync(path.join(root, 'l10n'))) {
	const match = /^bundle\.l10n\.(.+)\.json$/.exec(name);
	if (match === null) continue;
	const translated = JSON.parse(fs.readFileSync(path.join(root, 'l10n', name), 'utf8'));
	const stale = Object.keys(translated).filter((key) => !keys.has(key));
	const missing = sorted.filter((key) => !(key in translated));
	console.log(match[1] + ': ' + Object.keys(translated).length + ' translated, ' + missing.length + ' missing' + (stale.length > 0 ? ', ' + stale.length + ' stale: ' + stale.map((k) => JSON.stringify(k)).join(', ') : ''));
}
console.log(sorted.length + ' strings written to l10n/bundle.l10n.json');
