---
'rspack-plugin-svg-sprite': minor
---

Add ESM entry points and fix how the subpath exports resolve for TypeScript and ESM consumers. Nothing you use today changes: `require()` returns the same values, and the CommonJS files stay at the same `dist/` paths.

- **ESM default imports now give the real value.** In an ESM config (`rspack.config.mjs`, `webpack.config.mjs`) or app code, `import SvgSpritePlugin from 'rspack-plugin-svg-sprite/plugin'`, `import loader from 'rspack-plugin-svg-sprite/loader'` and the `runtime/*` default imports used to give the CommonJS exports object, so `new SvgSpritePlugin()` threw. They now give the class, function or object itself. If you worked around this with `.default` (for example `new SvgSpritePlugin.default()`), that keeps working, and so do named imports.
- **Subpath types under `moduleResolution: "node10"`.** `rspack-plugin-svg-sprite/plugin`, `/loader`, `/rsbuild`, `/runtime/*` and `/client` now resolve their types with the older `node`/`node10` setting too.
- **`rspack-plugin-svg-sprite/package.json` is exported**, for tools that read the package version.
- **Source maps include their sources**, so stack traces and debuggers show the original TypeScript.

The ESM entry points re-export the CommonJS build, so a page still gets exactly one sprite and one `SpriteSymbol` class even when app code imports the runtime directly. No action is needed; if you added `.default` to work around ESM imports, you can remove it.
