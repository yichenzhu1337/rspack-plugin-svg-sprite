# rspack-plugin-svg-sprite

## 1.7.0

### Minor Changes

- [#82](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/82) [`7e8f859`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/7e8f85953a956e8b4dc7a1f34feb700e4a6e4445) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Extract mode now works with `output.publicPath: 'auto'` (the Rspack and webpack 5 default for web targets) and with a function `output.publicPath`. The sprite URL is resolved in the browser from the bundler's public path, so `icon.url` points at the sprite next to your bundle without setting the loader's `publicPath`. A string `output.publicPath` or the loader's `publicPath` option behaves as before, and the generated module for those is unchanged.

  Behaviour change for builds that leave `output.publicPath` unset on a web target: `icon.url` used to be `sprite.svg#id`, resolved against the page URL (so it broke on nested routes such as `/settings/profile`). It is now resolved from the bundle's location, like every other asset. To keep a fixed URL, set the loader's `publicPath` option.

### Patch Changes

- [#83](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/83) [`692f4ed`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/692f4ed5cef4c98f94e786899834c454229843f5) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - An icon whose root `<svg>` has no `viewBox` and no numeric `width` and `height` silently got `viewBox="0 0 24 24"`, which crops or mis-scales icons of any other size. The build now prints a warning that names the file and the fallback it used, and says to add a `viewBox` (or `width` and `height`) to the root `<svg>`. The generated output is unchanged.

## 1.6.4

### Patch Changes

- [#60](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/60) [`91ff725`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/91ff725050b66b56c4d44f662befa26c6b1b7648) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Two icons with the same symbol id in different sprite files (for example `a/home.svg` going to `a.svg` and `b/home.svg` going to `b.svg`) were treated as duplicates: a warning was printed, one sprite got the wrong drawing and the other was never emitted. Ids now only need to be unique within one sprite file.

- [#61](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/61) [`9764199`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/97641993229eb8ab7333018d2b2e49648d5c4baf) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - File and folder names containing `$` sequences such as `$$`, `$&`, `` $` `` or `$'` were altered when inserted into the symbol id through `[name]`, `[folder]` and `[ext]` (for example `price$$.svg` gave `icon-price$`). The names are now inserted exactly as written.

- [#58](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/58) [`ec68414`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/ec68414b0d010423712daf1dd6d607e96289424e) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Icons exported from Inkscape, Sketch and similar tools use prefixes such as `inkscape:` and `sodipodi:` that their root `<svg>` declares. The extracted sprite lost those declarations, so browsers rejected the whole sprite and every icon in it rendered blank. The loader now copies the namespace declarations an icon actually uses onto its `<symbol>`.

- [#57](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/57) [`bdbdada`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/bdbdada155b45a52075396af28a18e19ce921394) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Fix webpack 5 builds that failed with "A Source-like object with a 'map' method must also provide an 'updateHash' method" when the output filename has a content hash or the persistent cache is on and `webpack-sources` cannot be resolved from this package (pnpm, Yarn PnP, Bun). The sprite now uses webpack's own `RawSource`.

## 1.6.3

### Patch Changes

- [#50](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/50) [`d3d2158`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/d3d2158e514514f6fa0ee576cfcd3d39ad45b15d) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Fix the ESM type declarations (`*.d.mts`) failing to parse on TypeScript 5.0 to 5.2 (`moduleResolution` node16, nodenext or bundler), a regression in 1.6.0.

## 1.6.2

### Patch Changes

- [#31](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/pull/31) [`90262dd`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/commit/90262dd75f19c4eab079d6072083377b0a5a6598) Thanks [@yichenzhu1337](https://github.com/yichenzhu1337)! - Fix ESM imports of `rspack-plugin-svg-sprite/loader`, `/runtime/symbol` and `/runtime/browser-sprite` on the Bun runtime. In 1.6.0 these imports threw `TypeError: Object.assign requires that input parameter not be null or undefined` when the code ran under Bun (for example `bun --bun rspack build` or a Bun script that imports the loader). Node and bundled app output are unchanged: the ESM entry points now give the same default export and named exports on Node, on Bun and inside Rspack and webpack bundles, and still share the single CommonJS implementation.

  This release also contains the fixes listed under 1.6.1 (escaped symbol ids, linear-time parsing of malformed files, the DOCTYPE entity warning), because 1.6.1 was never published to npm.

## 1.6.1

_Not published to npm. These changes ship in 1.6.2._

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
