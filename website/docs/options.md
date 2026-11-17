---
description: 'Every loader, plugin and Rsbuild plugin option, with types and defaults.'
---

# Options reference

## Loader options

Set on the rule that uses `rspack-plugin-svg-sprite/loader`.

| Option           | Type                 | Default        | Description                                                                                                               |
| ---------------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `symbolId`       | `string \| function` | `'[name]'`     | Pattern for generating symbol IDs. Supports `[name]`, `[folder]`, `[ext]` placeholders, or a function `(filePath) => id`. |
| `esModule`       | `boolean`            | `true`         | Use ES module export (`export default`) vs CommonJS (`module.exports`).                                                   |
| `extract`        | `boolean`            | `false`        | Enable extract mode to emit an external sprite file instead of inlining.                                                  |
| `spriteFilename` | `string`             | `'sprite.svg'` | Output filename for the extracted sprite (extract mode only). Symbol ids must be unique within one sprite file.           |
| `publicPath`     | `string`             | `''`           | Public URL prefix for the sprite file (extract mode only). Auto-detected from `output.publicPath` if not set.             |

`include` and `exclude` are not loader options. To limit which SVGs become sprite symbols, use the `include` / `exclude` conditions of the bundler rule itself, or the options of the same name on the Rsbuild plugin (`pluginSvgSprite({ include: /icons/ })`).

## Plugin options

Passed to `new SvgSpritePlugin({ ... })`. The plugin is only needed in extract mode.

| Option        | Type      | Default | Description                                                             |
| ------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `plainSprite` | `boolean` | `false` | Generate a plain sprite without preview styles and `<use>` elements.    |
| `spriteAttrs` | `object`  | `{}`    | Additional attributes to add to the root `<svg>` element of the sprite. |

## Rsbuild plugin options

`pluginSvgSprite(options)` from `rspack-plugin-svg-sprite/rsbuild` accepts `symbolId`, `extract`, `esModule`, `spriteFilename`, `publicPath`, `plainSprite`, `spriteAttrs`, `include` and `exclude` (a `RegExp` or a string). The defaults are the ones above.

## Exported symbol shape

Every `import icon from './icon.svg'` returns `{ id, viewBox, url, content }`. See [Getting started](/getting-started#use-in-your-components) for the table. This matches `svg-sprite-loader`'s export shape, so migrating needs no component changes.
