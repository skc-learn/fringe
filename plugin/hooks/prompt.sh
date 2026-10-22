#!/bin/sh
# Playbook hook: runs the one dependency-free file in this plugin. Needs node; silent (exit 0) without it.
command -v node >/dev/null 2>&1 || exit 0
exec node "${CLAUDE_PLUGIN_ROOT}/vendor/cli/pluginHook.js" hook-prompt
