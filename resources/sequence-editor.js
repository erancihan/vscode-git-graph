// Sequence editor used by the Git Graph interactive rebase editor. Git runs it (through
// sequence-editor.sh) with the path of its todo file; the prepared todo list replaces that file.
// Any failure exits with 1, which makes git abort the rebase before it changes anything.
'use strict';
const fs = require('fs');
const source = process.env['GIT_GRAPH_REBASE_TODO'], target = process.argv[2];
if (!source || !target) {
	process.exit(1);
}
try {
	fs.copyFileSync(source, target);
	process.exit(0);
} catch (e) {
	process.exit(1);
}
