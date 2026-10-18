#!/bin/sh
# Git runs this script as gpg.program. It forwards the call to resources/gpg-wrapper.js, which runs
# the real gpg and, when gpg cannot show its own passphrase prompt, asks for the passphrase in
# Visual Studio Code and retries with a loopback pinentry.
exec "$GIT_GRAPH_GPG_NODE" "$GIT_GRAPH_GPG_MAIN" "$@"
