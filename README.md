# rspack-plugin-svg-sprite

[![CI](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml/badge.svg)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite/graph/badge.svg)](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite)
[![npm](https://img.shields.io/npm/v/rspack-plugin-svg-sprite)](https://www.npmjs.com/package/rspack-plugin-svg-sprite)

Rspack loader and plugin for creating SVG sprites. A compatible replacement for [svg-sprite-loader](https://github.com/JetBrains/svg-sprite-loader) that works natively with [Rspack](https://rspack.dev/).

## Why?

The original `svg-sprite-loader` relies on webpack-specific internal APIs (`NormalModule.getCompilationHooks`, `compilation.hooks.additionalAssets`, `compilation.hooks.afterOptimizeChunks`, etc.) that are not available in Rspack. This package reimplements the same functionality using Rspack-compatible APIs.

## Installation

```bash
pnpm add rspack-plugin-svg-sprite -D
# or
npm install rspack-plugin-svg-sprite -D
# or
yarn add rspack-plugin-svg-sprite -D
```

## Usage

### Inline Mode (Default)

SVG symbols are injected into the page DOM at runtime. This is the simplest setup and requires no plugin.

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

Then import SVGs and use them:

```jsx
import logo from './logo.svg';

// logo.id       -> 'logo'
// logo.viewBox  -> '0 0 24 24'
// logo.url      -> '#logo'

// In JSX:
<svg viewBox={logo.viewBox}>
  <use xlinkHref={logo.url} />
</svg>;

// In plain HTML template string:
const html = `
  <svg viewBox="${logo.viewBox}">
    <use xlink:href="${logo.url}" />
  </svg>
`;
```

### Extract Mode

Generates an external `.svg` sprite file. Requires both the loader and the plugin.

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
      spriteAttrs: {
        id: 'svg-sprite',
      },
    }),
  ],
};
```

In extract mode, the exported symbol includes the full URL:

```jsx
import icon from './icon.svg';

// icon.url -> '/assets/sprites/icons.svg#icon-icon'

<svg viewBox={icon.viewBox}>
  <use xlinkHref={icon.url} />
</svg>;
```

## Loader Options

| Option           | Type                 | Default        | Description                                                                                                                   |
| ---------------- | -------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `symbolId`       | `string \| function` | `'[name]'`     | Pattern for generating symbol IDs. Supports `[name]`, `[folder]`, `[ext]` placeholders. Can be a function `(filePath) => id`. |
| `esModule`       | `boolean`            | `true`         | Use ES module export (`export default`) vs CommonJS (`module.exports`).                                                       |
| `extract`        | `boolean`            | `false`        | Enable extract mode to generate an external sprite file.                                                                      |
| `spriteFilename` | `string`             | `'sprite.svg'` | Filename for the extracted sprite (extract mode only).                                                                        |
| `publicPath`     | `string`             | `''`           | Public path prefix for sprite URL (extract mode only).                                                                        |

## Plugin Options (Extract Mode Only)

| Option        | Type      | Default | Description                                                 |
| ------------- | --------- | ------- | ----------------------------------------------------------- |
| `plainSprite` | `boolean` | `false` | Generate a plain sprite without styles and usages.          |
| `spriteAttrs` | `object`  | `{}`    | Additional attributes to add to the `<svg>` sprite element. |

## Migration from svg-sprite-loader

Replace the loader and plugin references:

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

The exported symbol object has the same shape (`id`, `viewBox`, `url`, `content`), so your component code should work without changes.

## How It Works

### Inline Mode

1. The loader reads each SVG file and wraps its content into an SVG `<symbol>` element.
2. It generates JavaScript that imports a browser-side sprite manager.
3. At runtime, the sprite manager creates a hidden `<svg>` element in `document.body` and appends all symbols to it.
4. You reference symbols via `<use xlink:href="#symbolId" />`.

### Extract Mode

1. The loader reads each SVG and wraps it as a `<symbol>`, then registers it with the plugin.
2. During the `processAssets` compilation stage, the plugin collects all registered symbols and emits a combined `.svg` sprite file.
3. The exported module points to the external file URL (`/path/sprite.svg#symbolId`).

## Compatibility

- Rspack >= 0.5.0
- Also works with webpack 5 (uses `compiler.rspack` detection with webpack-sources fallback)

## Examples

The `examples/` directory contains two demo apps you can run locally:

- **`examples/react-rspack`** — React app bundled with Rspack, using `rspack-plugin-svg-sprite` in extract mode (port 3000)
- **`examples/react-webpack`** — React app bundled with Webpack 5, using the original `svg-sprite-loader` for comparison (port 4000)

```bash
# React + Rspack example
cd examples/react-rspack
pnpm install
pnpm dev

# React + Webpack example
cd examples/react-webpack
pnpm install
pnpm dev
```

## License

MIT
