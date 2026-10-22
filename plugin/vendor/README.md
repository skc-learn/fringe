Vendored runtime for the Fringe Claude Code plugin (version 0.7.2).

The plugin's two hooks run `node pluginHook.js` from this folder: no package is downloaded at run time. `cli/pluginHook.js` is the unminified build of packages/cli/src/pluginHook.ts; `node_modules/` holds the production dependencies at the exact versions in packages/cli/npm-shrinkwrap.json. Regenerate with `node scripts/vendor-plugin.mjs`.
