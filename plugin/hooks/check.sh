#!/bin/sh
# Post-edit check: runs the project's own installed `fringe`. Silent (exit 0) when there is none; nothing is downloaded.
if [ -x ./node_modules/.bin/fringe ]; then exec ./node_modules/.bin/fringe check --claude-hook; fi
if command -v fringe >/dev/null 2>&1; then exec fringe check --claude-hook; fi
exit 0
