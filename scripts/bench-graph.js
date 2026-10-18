// Benchmark Graph.loadCommits with a synthetic history. Usage: node bench-graph.js <path to media/graph.js> <commits> <branches>
const fs = require('fs');
const vm = require('vm');
const file = process.argv[2], N = parseInt(process.argv[3] || '20000'), B = parseInt(process.argv[4] || '200');
const el = () => ({ attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); }, removeChild() { } });
const sandbox = { document: { createElementNS: () => el(), getElementById: () => el() }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.Graph = Graph;', sandbox);
// Synthetic history: B interleaved branches; each commit's parent is the previous commit on the same branch; every 7th commit is a merge from another branch.
const commits = [], lookup = {};
const lastOnBranch = new Array(B).fill(null);
for (let i = 0; i < N; i++) {
	const b = i % B, hash = 'h' + i;
	const parents = [];
	if (lastOnBranch[b] !== null) parents.push(lastOnBranch[b]);
	if (i % 7 === 0) { const o = (b + 1) % B; if (lastOnBranch[o] !== null && lastOnBranch[o] !== parents[0]) parents.push(lastOnBranch[o]); }
	lastOnBranch[b] = hash;
	commits.push({ hash, parentHashes: parents, refs: [] });
}
// git log lists children before parents, so reverse.
commits.reverse();
commits.forEach((c, i) => lookup[c.hash] = i);
const config = { graphColours: ['#000'], graphStyle: 'rounded', grid: { x: 16, y: 24, offsetX: 8, offsetY: 12, expandY: 250 } };
const g = new sandbox.Graph('x', config);
let t = Date.now();
g.loadCommits(commits, commits[0].hash, lookup);
const load = Date.now() - t;
t = Date.now();
g.render(null);
const render = Date.now() - t;
console.log(`commits=${N} branches=${B} loadCommits=${load}ms render=${render}ms width=${g.getWidth()}`);
