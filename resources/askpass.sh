#!/bin/sh
# Git calls this script (GIT_ASKPASS) with the prompt as its argument. It forwards the prompt to the
# Git Graph extension, which asks the user and prints the answer.
"$GIT_GRAPH_ASKPASS_NODE" "$GIT_GRAPH_ASKPASS_MAIN" "$@"
