#!/bin/sh
# Git calls this script (GIT_SEQUENCE_EDITOR) with the path of the rebase todo file. It replaces
# that file with the todo list the Git Graph rebase editor prepared.
exec "$GIT_GRAPH_SEQUENCE_NODE" "$GIT_GRAPH_SEQUENCE_MAIN" "$@"
