# rspack-plugin-svg-sprite

> SVG sprite loader and plugin for Rspack — a drop-in replacement for [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) that works natively with [Rspack](https://rspack.dev/).

[![CI](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml/badge.svg)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite/graph/badge.svg)](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite)
[![npm version](https://img.shields.io/npm/v/rspack-plugin-svg-sprite)](https://www.npmjs.com/package/rspack-plugin-svg-sprite)
[![npm downloads](https://img.shields.io/npm/dm/rspack-plugin-svg-sprite)](https://www.npmjs.com/package/rspack-plugin-svg-sprite)
[![license](https://img.shields.io/npm/l/rspack-plugin-svg-sprite)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/blob/main/LICENSE)

---

## What is this?

`rspack-plugin-svg-sprite` lets you import `.svg` files in your Rspack (or Webpack 5) project and automatically combine them into an SVG sprite sheet — either inlined in the DOM or extracted as an external `.svg` file.

It was created because the popular [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) depends on internal Webpack APIs (`NormalModule.getCompilationHooks`, `compilation.hooks.additionalAssets`, etc.) that do not exist in Rspack. This package reimplements the same functionality using Rspack-compatible APIs while keeping the exact same exported symbol shape (`id`, `viewBox`, `url`, `content`), so your existing component code works without changes.

## Features

- **Inline mode** (default) — SVG symbols are injected into the DOM at runtime via a hidden `<svg>` element. No plugin needed.
- **Extract mode** — SVG symbols are emitted as an external `.svg` sprite file at build time. Great for caching and performance.
- **Drop-in replacement** for `svg-sprite-loader` — same config options, same export shape.
- **Works with both Rspack and Webpack 5** — auto-detects the bundler at runtime.
- **TypeScript** — fully typed, ships with `.d.ts` declarations.
- **Lightweight** — zero runtime dependencies.
- **Customizable symbol IDs** — use `[name]`, `[folder]`, or a custom function.

## Quick Start

### Install

```bash
npm install rspack-plugin-svg-sprite -D
# or
pnpm add rspack-plugin-svg-sprite -D
# or
yarn add rspack-plugin-svg-sprite -D
```

### Configure (inline mode)

```js
// rspack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          symbolId: '[name]',
        },
      },
    ],
  },
};
```

### Use in your components

```jsx
import logo from './logo.svg';

// logo.id      → "logo"
// logo.viewBox → "0 0 24 24"
// logo.url     → "#logo"

<svg viewBox={logo.viewBox}>
  <use xlinkHref={logo.url} />
</svg>;
```

That's it. Every imported SVG is automatically registered as a `<symbol>` in a hidden sprite and referenced by `#id`.

## Extract Mode

To emit SVGs as an external `.svg` sprite file instead of inlining them, enable extract mode and add the plugin:

```js
// rspack.config.js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          extract: true,
          symbolId: 'icon-[name]',
          spriteFilename: 'sprites/icons.svg',
          publicPath: '/assets/',
        },
      },
    ],
  },
  plugins: [
    new SvgSpritePlugin({
      plainSprite: true,
      spriteAttrs: { id: 'svg-sprite' },
    }),
  ],
};
```

In extract mode, the exported `url` points to the external file:

```jsx
import icon from './icon.svg';

// icon.url → "/assets/sprites/icons.svg#icon-icon"

<svg viewBox={icon.viewBox}>
  <use xlinkHref={icon.url} />
</svg>;
```

## API Reference

### Loader Options

| Option           | Type                 | Default        | Description                                                                                                               |
| ---------------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `symbolId`       | `string \| function` | `'[name]'`     | Pattern for generating symbol IDs. Supports `[name]`, `[folder]`, `[ext]` placeholders, or a function `(filePath) => id`. |
| `esModule`       | `boolean`            | `true`         | Use ES module export (`export default`) vs CommonJS (`module.exports`).                                                   |
| `extract`        | `boolean`            | `false`        | Enable extract mode to emit an external sprite file instead of inlining.                                                  |
| `spriteFilename` | `string`             | `'sprite.svg'` | Output filename for the extracted sprite (extract mode only).                                                             |
| `publicPath`     | `string`             | `''`           | Public URL prefix for the sprite file (extract mode only).                                                                |

### Plugin Options (Extract Mode)

| Option        | Type      | Default | Description                                                             |
| ------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `plainSprite` | `boolean` | `false` | Generate a plain sprite without preview styles and `<use>` elements.    |
| `spriteAttrs` | `object`  | `{}`    | Additional attributes to add to the root `<svg>` element of the sprite. |

### Exported Symbol Shape

Every `import icon from './icon.svg'` returns an object with:

| Property  | Type     | Example                                            | Description                                        |
| --------- | -------- | -------------------------------------------------- | -------------------------------------------------- |
| `id`      | `string` | `"icon-home"`                                      | The symbol ID inside the sprite.                   |
| `viewBox` | `string` | `"0 0 24 24"`                                      | The original SVG `viewBox` attribute.              |
| `url`     | `string` | `"#icon-home"` or `"/sprites/icons.svg#icon-home"` | Fragment reference (inline) or full URL (extract). |
| `content` | `string` | `"<symbol id=\"icon-home\" ...>...</symbol>"`      | Raw `<symbol>` markup.                             |

This matches `svg-sprite-loader`'s export shape exactly, so migrating requires no component changes.

## Migrating from svg-sprite-loader

```diff
// rspack.config.js
-const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');
+const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
-       loader: 'svg-sprite-loader',
+       loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          symbolId: 'icon-[name]',
+         // Add extract: true if you were using extract mode
        },
      },
    ],
  },
  plugins: [
-   new SpriteLoaderPlugin(),
+   new SvgSpritePlugin(), // Only needed for extract mode
  ],
};
```

Your component code stays the same — the exported symbol object has the identical shape (`id`, `viewBox`, `url`, `content`).

## How It Works

### Inline Mode

1. The loader parses each `.svg` file and wraps its content in an SVG `<symbol>` element.
2. It generates a JS module that imports a browser-side sprite manager.
3. At runtime, the sprite manager creates a hidden `<svg>` element in `document.body` and appends all symbols.
4. You reference symbols via `<use xlink:href="#symbolId" />`.

### Extract Mode

1. The loader wraps each SVG as a `<symbol>` and registers it with the plugin via the compilation object.
2. During Rspack's `processAssets` stage, the plugin collects all registered symbols and emits a combined `.svg` sprite file.
3. The exported JS module contains the external file URL (e.g., `/sprites/icons.svg#symbolId`).

## Compatibility

| Bundler                            | Version  | Status                                   |
| ---------------------------------- | -------- | ---------------------------------------- |
| [Rspack](https://rspack.dev/)      | >= 0.5.0 | Fully supported (primary target)         |
| [Webpack](https://webpack.js.org/) | 5.x      | Supported via `webpack-sources` fallback |

## Examples

The repository includes two runnable demo apps:

| Example                                    | Bundler   | Plugin                     | Port | Description                                          |
| ------------------------------------------ | --------- | -------------------------- | ---- | ---------------------------------------------------- |
| [`react-rspack`](examples/react-rspack/)   | Rspack    | `rspack-plugin-svg-sprite` | 3000 | Extract mode with icon gallery, sidebar, and buttons |
| [`react-webpack`](examples/react-webpack/) | Webpack 5 | `svg-sprite-loader`        | 4000 | Same UI using the original loader (for comparison)   |

**[Live demo (Rspack)](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** — see the plugin in action.

Run locally from the project root:

```bash
pnpm install
pnpm dev:rspack   # http://localhost:3000
pnpm dev:webpack  # http://localhost:4000
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and guidelines.

## License

[MIT](LICENSE)
