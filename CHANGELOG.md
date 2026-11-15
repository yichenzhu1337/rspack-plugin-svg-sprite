# rspack-plugin-svg-sprite

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
