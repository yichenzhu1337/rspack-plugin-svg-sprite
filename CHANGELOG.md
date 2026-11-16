# rspack-plugin-svg-sprite

## 1.6.1

### Patch Changes

- [#28](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/28) [`5036c0c`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/5036c0ca63bbcae0e42a925fead36c786941df82) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Fixes three problems with unusual input. Icons that do not hit them produce byte-identical output.

  - An icon file whose name contains `&`, `<` or `"` (for example `Q&A.svg`) wrote its name into the symbol markup without escaping it. In extract mode the sprite stopped being valid XML, so the browser refused the whole sprite and every icon in it vanished. The name is now escaped in the `<symbol>` and in the sprite's `<use>` elements. `icon.id` is still the plain file name, `icon.url` still works in an `href`, and `icon.content` holds the escaped markup. A `%` followed by two hex digits in an id is written as `%25` in the URL fragment. Values from the `spriteAttrs` plugin option are escaped too.
  - A malformed SVG file made of many unterminated `<svg` or `<!--` openers (about 100 KB) could freeze the build for seconds or minutes, because the parser rescanned the file from each opener. Parsing is now linear. Well-formed files are not affected.
  - An SVG whose DOCTYPE declares an entity that the icon uses (`<!ENTITY fill "red">` and `&fill;`) now produces a build warning that names the file and the entity. The entity is still not expanded, so the sprite keeps an undeclared reference. Replace it with its literal value or run SVGO.

  Only projects with those characters in icon file names, or with malformed or DOCTYPE-entity files, are affected.

## 1.6.0

### Minor Changes

- [#18](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/18) [`0776abf`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/0776abff89a2383f69365cc38f02c7a04b76a32a) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Add ESM entry points and fix how the subpath exports resolve for TypeScript and ESM consumers. Nothing you use today changes: `require()` returns the same values, and the CommonJS files stay at the same `dist/` paths.

  - **ESM default imports now give the real value.** In an ESM config (`rspack.config.mjs`, `webpack.config.mjs`) or app code, `import SvgSpritePlugin from 'rspack-plugin-svg-sprite/plugin'`, `import loader from 'rspack-plugin-svg-sprite/loader'` and the `runtime/*` default imports used to give the CommonJS exports object, so `new SvgSpritePlugin()` threw. They now give the class, function or object itself. If you worked around this with `.default` (for example `new SvgSpritePlugin.default()`), that keeps working, and so do named imports.
  - **Subpath types under `moduleResolution: "node10"`.** `rspack-plugin-svg-sprite/plugin`, `/loader`, `/rsbuild`, `/runtime/*` and `/client` now resolve their types with the older `node`/`node10` setting too.
  - **`rspack-plugin-svg-sprite/package.json` is exported**, for tools that read the package version.
  - **Source maps include their sources**, so stack traces and debuggers show the original TypeScript.

  The ESM entry points re-export the CommonJS build, so a page still gets exactly one sprite and one `SpriteSymbol` class even when app code imports the runtime directly. No action is needed; if you added `.default` to work around ESM imports, you can remove it.

### Patch Changes

- [#20](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/20) [`59edd24`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/59edd24c0c436ad338a90bd646060053d909b77a) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Faster extract-mode builds with many icons. Registering an icon with the plugin used to scan every icon registered so far, which took over half the plugin's time at 3,000 icons. It is now a constant-time lookup. Output is unchanged.

## 1.5.3

### Patch Changes

- [#6](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/6) [`ef734ce`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/ef734ce1bed584b1fa82a56a895511fc8240a2b0) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Fix icons disappearing from the extracted sprite, and parse the root `<svg>` tag correctly.
  - **Extract mode no longer loses icons in watch mode or after a cached restart.** Before, editing one icon removed every other icon from `sprite.svg`, editing a JS file emitted no sprite at all, and a second build with a persistent cache (webpack `cache.type: 'filesystem'`, Rspack `experiments.cache` or `cache.type: 'persistent'`) emitted no sprite. Extract-mode modules now always re-run so every icon reaches the sprite. Inline mode is unchanged. Large icon sets rebuild slightly slower in development (about 0.1 ms per icon).
  - **The root `<svg>` tag is read as XML.** Attributes that 1.5.2 mangled now come through intact: `preserveAspectRatio` keeps its case (browsers ignored the lowercased name, so icons with it may now scale as the attribute says; remove the attribute to get the old look), values containing `'`, `"` or `>` are kept whole, `viewBox = "…"` with spaces is recognised, and an `<svg` inside a leading comment is skipped. Tags the new parser cannot read fall back to the previous behavior.
  - **A warning when an asset rule captures your SVG.** If another rule turns the file into an `asset` module, the build now warns with the file name and the fix (`type: 'javascript/auto'`). The build result is unchanged.
  - **Stable sprite order.** Symbols in each extracted sprite are sorted by id, so identical builds produce identical files.

  Output for every icon that 1.5.2 already handled correctly is byte-for-byte unchanged.

## 1.5.2

### Patch Changes

- abdc666: Support named ESM import of SvgSpritePlugin ([#1](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/1))

## 1.5.1

### Patch Changes

- 331d1da: Restore xmlns:xlink namespace and defs wrapper in generated sprites

## 1.5.0

### Minor Changes

- e4fada7: Auto-read publicPath from compiler output config in extract mode

### Patch Changes

- 70c7262: Derive viewBox from width/height when viewBox attribute is missing
- 88abb4e: Harden SVG parsing, Rsbuild rule filtering, and publicPath normalization
- 479ed71: Implement plainSprite option that was accepted but never used
- d98b90e: Prevent memory leak in SSR by skipping symbol registration without document
- 1ea05c4: Fix querySelector crash on special chars, watch mode ghost symbols, and FallbackRawSource byte count
- d440f3d: Rsbuild plugin removes conflicting SVG rules, adds include/exclude support
- b71a8cf: Warn when duplicate symbol IDs come from different files

## 1.4.0

### Minor Changes

- bf0738a: Add Rsbuild plugin, ship TS declarations, SEO and discoverability overhaul

## 1.3.0

### Minor Changes

- 87f7009: Warn on silent misconfiguration, document type: javascript/auto

Versions before 1.3.0 (1.1.1, 1.2.0) were published without release notes; see [npm](https://www.npmjs.com/package/rspack-plugin-svg-sprite?activeTab=versions).
