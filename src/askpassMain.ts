/**
 * Entry point of the askpass helper. Git runs resources/askpass.sh, which runs this file with Node
 * and the prompt as the argument. The answer is printed on stdout; any failure exits with 1 so git
 * reports that no credential was supplied.
 */
import { requestCredential } from './askpassClient';

const pipePath = process.env['GIT_GRAPH_ASKPASS_PIPE'], nonce = process.env['GIT_GRAPH_ASKPASS_NONCE'];
const prompt = process.argv.slice(2).join(' ');

if (!pipePath || !nonce) {
	process.exit(1);
} else {
	requestCredential(pipePath, nonce, prompt).then((value) => {
		process.stdout.write(value + '\n', () => process.exit(0));
	}, () => {
		process.exit(1);
	});
}
