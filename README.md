# rspack-plugin-svg-sprite

> SVG sprite loader and plugin for Rspack — a drop-in replacement for [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) that works natively with [Rspack](https://rspack.dev/).

[![CI](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml/badge.svg)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite/graph/badge.svg)](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite)
[![npm version](https://img.shields.io/npm/v/rspack-plugin-svg-sprite)](https://www.npmjs.com/package/rspack-plugin-svg-sprite)
[![npm downloads](https://img.shields.io/npm/dm/rspack-plugin-svg-sprite)](https://www.npmjs.com/package/rspack-plugin-svg-sprite)
[![license](https://img.shields.io/github/license/yichenzhu1337/rspack-plugin-svg-sprite)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/rspack-plugin-svg-sprite)](https://bundlephobia.com/package/rspack-plugin-svg-sprite)

**[Live Demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** | **[npm](https://www.npmjs.com/package/rspack-plugin-svg-sprite)** | **[npm trends](https://npmtrends.com/rspack-plugin-svg-sprite-vs-svg-sprite-loader)**

```bash
npm install rspack-plugin-svg-sprite -D
```

---

## Why SVG sprites?

Individual SVG files mean one HTTP request per icon — 50 icons = 50 requests. Inlining SVGs directly into JSX bloats your bundle with duplicated markup. SVG sprites solve both problems: all icons are combined into a single file (or a single hidden DOM element), and each icon is referenced by `<use href="#id" />` — one request, zero duplication, full CSS styling support, and resolution-independent rendering at any size.

## What is this?

`rspack-plugin-svg-sprite` lets you import `.svg` files in your Rspack (or Webpack 5) project and automatically combine them into an SVG sprite sheet — either inlined in the DOM or extracted as an external `.svg` file.

It was created because the popular [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) depends on internal Webpack APIs (`NormalModule.getCompilationHooks`, `compilation.hooks.additionalAssets`, etc.) that do not exist in Rspack ([rspack#11609](https://github.com/web-infra-dev/rspack/issues/11609)). This package reimplements the same functionality using Rspack-compatible APIs while keeping the exact same exported symbol shape (`id`, `viewBox`, `url`, `content`), so your existing component code works without changes.

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
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          symbolId: '[name]',
        },
      },
    ],
  },
};
```

> **Important:** The `type: 'javascript/auto'` is required to prevent rspack/webpack's built-in asset module handling from intercepting `.svg` files before the loader runs. Without it, the loader may silently fail to process your SVGs.

### Use in your components

```jsx
import logo from './logo.svg';

// logo.id      → "logo"
// logo.viewBox → "0 0 24 24"
// logo.url     → "#logo"

<svg viewBox={logo.viewBox}>
  <use href={logo.url} />
</svg>;
```

That's it. Every imported SVG is automatically registered as a `<symbol>` in a hidden sprite and referenced by `#id`.

### TypeScript

This package ships with a client type declaration. Add it to your `tsconfig.json` so `import icon from './icon.svg'` is fully typed:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["rspack-plugin-svg-sprite/client"],
  },
}
```

This gives you autocompletion for `id`, `viewBox`, `url`, and `content` on every SVG import.

<details>
<summary>Alternative: manual declaration file</summary>

If you prefer, create a `svg.d.ts` file instead:

```ts
declare module '*.svg' {
  const symbol: {
    id: string;
    viewBox: string;
    url: string;
    content: string;
  };
  export default symbol;
}
```

Make sure this file is included by your `tsconfig.json` (e.g., in the `include` array or alongside your source files).

</details>

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
        type: 'javascript/auto',
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
  <use href={icon.url} />
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
| `publicPath`     | `string`             | `''`           | Public URL prefix for the sprite file (extract mode only). Auto-detected from `output.publicPath` if not set.             |
| `include`        | `string[]`           | —              | Glob patterns or directories to include (only process matching SVGs).                                                     |
| `exclude`        | `string[]`           | —              | Glob patterns or directories to exclude from processing.                                                                  |

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

## Rsbuild Integration

If you're using [Rsbuild](https://rsbuild.dev/), use the built-in Rsbuild plugin for one-line setup:

```js
// rsbuild.config.js
const { pluginSvgSprite } = require('rspack-plugin-svg-sprite/rsbuild');

module.exports = {
  plugins: [
    pluginSvgSprite({
      symbolId: 'icon-[name]',
      extract: true,
      spriteFilename: 'sprites/icons.svg',
    }),
  ],
};
```

The Rsbuild plugin handles the loader rule, `type: 'javascript/auto'`, and the `SvgSpritePlugin` automatically.

## Framework Recipes

### Next.js (with next-rspack)

```js
// next.config.js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  webpack(config) {
    // Remove Next.js default SVG handling
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.('.svg'));
    if (fileLoaderRule) fileLoaderRule.exclude = /\.svg$/;

    config.module.rules.push({
      test: /\.svg$/,
      type: 'javascript/auto',
      loader: 'rspack-plugin-svg-sprite/loader',
      options: { symbolId: 'icon-[name]', extract: true },
    });

    config.plugins.push(new SvgSpritePlugin({ plainSprite: true }));
    return config;
  },
};
```

### Vue + Rspack

```js
// rspack.config.js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { symbolId: '[name]' },
      },
    ],
  },
};
```

```vue
<template>
  <svg :viewBox="icon.viewBox">
    <use :href="icon.url" />
  </svg>
</template>

<script setup>
import icon from './icon.svg';
</script>
```

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
+       type: 'javascript/auto',
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

## Migrating from `asset/resource`

If you're currently using rspack/webpack's built-in `asset/resource` type to handle SVGs (common in webpack 5+ / rspack projects), you can replace it with this plugin to get proper SVG sprite support:

```diff
// rspack.config.js
+const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
-       type: 'asset/resource',
-       generator: {
-         filename: 'images/icons/[name].[contenthash][ext]',
-       },
+       type: 'javascript/auto',
+       loader: 'rspack-plugin-svg-sprite/loader',
+       options: {
+         extract: true,
+         symbolId: '[name]',
+         spriteFilename: 'sprite.svg',
+       },
      },
    ],
  },
+ plugins: [
+   new SvgSpritePlugin({ plainSprite: true }),
+ ],
};
```

**Key points:**

- `type: 'javascript/auto'` is **required** — it overrides the previous `asset/resource` handling and lets the loader process SVGs as JavaScript modules.
- The sprite file is emitted to your output directory (e.g., `dist/sprite.svg`).
- If you were using a separate CLI tool (like `svg-sprite`) to generate sprites as a post-build step, you can remove that — the plugin handles everything inside the rspack build pipeline.

## How It Works

### Inline Mode

1. The loader parses each `.svg` file and wraps its content in an SVG `<symbol>` element.
2. It generates a JS module that imports a browser-side sprite manager.
3. At runtime, the sprite manager creates a hidden `<svg>` element in `document.body` and appends all symbols.
4. You reference symbols via `<use href="#symbolId" />`.

### Extract Mode

1. The loader wraps each SVG as a `<symbol>` and registers it with the plugin via the compilation object.
2. During Rspack's `processAssets` stage, the plugin collects all registered symbols and emits a combined `.svg` sprite file.
3. The exported JS module contains the external file URL (e.g., `/sprites/icons.svg#symbolId`).

## Alternatives & Comparison

Looking for the right SVG solution for Rspack? Here's how the options compare:

| Feature               | rspack-plugin-svg-sprite | svg-sprite-loader           | @svgr/webpack    | @rsbuild/plugin-svgr | vite-plugin-svg-icons |
| --------------------- | ------------------------ | --------------------------- | ---------------- | -------------------- | --------------------- |
| **Rspack support**    | Native                   | No (uses Webpack internals) | Via config       | Rsbuild only         | No (Vite only)        |
| **Approach**          | SVG sprites (`<use>`)    | SVG sprites (`<use>`)       | React components | React components     | SVG sprites           |
| **Inline mode**       | Yes                      | Yes                         | N/A              | N/A                  | Yes                   |
| **Extract mode**      | Yes                      | Yes                         | N/A              | N/A                  | No                    |
| **Webpack 5 support** | Yes                      | Yes                         | Yes              | No                   | No                    |
| **Runtime deps**      | Zero                     | 1                           | Several          | Several              | Several               |
| **Maintained**        | Yes                      | No (archived)               | Yes              | Yes                  | Yes                   |
| **Drop-in migration** | —                        | Yes (same API)              | Different API    | Different API        | Different API         |

**When to use SVG sprites** (this plugin): You want icons combined into a single file with `<use href="#id">` references — optimal for large icon sets, full CSS styling control, and caching. Best when migrating from `svg-sprite-loader`.

**When to use SVGR**: You want each SVG as a React component with props for color, size, etc. Better for SVGs that need dynamic manipulation via React props rather than CSS.

## Compatibility

| Bundler                            | Version  | Status                                   |
| ---------------------------------- | -------- | ---------------------------------------- |
| [Rspack](https://rspack.dev/)      | >= 0.5.0 | Fully supported (primary target)         |
| [Webpack](https://webpack.js.org/) | 5.x      | Supported via `webpack-sources` fallback |

## Examples

The repository includes three runnable demo apps:

| Example                                              | Bundler   | Plugin                     | Port | Description                                                       |
| ---------------------------------------------------- | --------- | -------------------------- | ---- | ----------------------------------------------------------------- |
| [`react-rspack`](examples/react-rspack/)             | Rspack    | `rspack-plugin-svg-sprite` | 3000 | Extract mode with icon gallery, sidebar, and buttons              |
| [`react-webpack`](examples/react-webpack/)           | Webpack 5 | `svg-sprite-loader`        | 4000 | Same UI using the original loader (for comparison)                |
| [`vue-rspack-extract`](examples/vue-rspack-extract/) | Rspack    | `rspack-plugin-svg-sprite` | 3002 | Vue 3 + extract mode with `plainSprite` and external `<use href>` |

**[Live demo (Rspack)](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** — see the plugin in action.

Run locally from the project root:

```bash
pnpm install
pnpm dev:rspack   # http://localhost:3000
pnpm dev:webpack  # http://localhost:4000
```

## Troubleshooting

### Sprite file not emitted / icons not rendering

**Symptom:** The build succeeds with no errors, but `sprite.svg` is not in the output directory and SVG icons don't render.

**Cause:** rspack/webpack's built-in asset module handling is intercepting `.svg` files before the loader runs.

**Fix:** Add `type: 'javascript/auto'` to your SVG rule:

```js
{
  test: /\.svg$/,
  type: 'javascript/auto', // ← Add this
  loader: 'rspack-plugin-svg-sprite/loader',
  options: { extract: true, symbolId: '[name]' },
}
```

### Warning: "SvgSpritePlugin is registered but no SVG symbols were collected"

This means the plugin is in your `plugins` array but no SVGs went through the loader. Common causes:

1. **Missing `type: 'javascript/auto'`** on the loader rule (see above).
2. **`include`/`exclude` filters** on the rule don't match your SVG file paths.
3. **No SVG imports** in your code — at least one `.svg` file must be imported for the loader to process it.

### Warning: "Extract mode is enabled but SvgSpritePlugin was not found"

This means the loader is running in extract mode (`extract: true`) but `SvgSpritePlugin` isn't in the `plugins` array. Add it:

```js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  plugins: [new SvgSpritePlugin()],
};
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and guidelines.

## License

[MIT](LICENSE)
