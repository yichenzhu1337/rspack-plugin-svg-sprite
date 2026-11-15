# rspack-plugin-svg-sprite

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
