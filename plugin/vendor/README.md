Vendored runtime for the Fringe Claude Code plugin (version 0.7.3).

`cli/pluginHook.js` is the only code the plugin runs itself: the dependency-free playbook hook, built unminified from packages/cli/src/pluginHook.ts. No third-party code and no package download. The post-edit check (hooks/check.sh) runs the `fringe` you installed. Regenerate with `node scripts/vendor-plugin.mjs`.
