# rspack-plugin-svg-sprite

> SVG sprite loader and plugin for [Rspack](https://rspack.dev/) and [Rsbuild](https://rsbuild.dev/) — a drop-in replacement for [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader), which doesn't work with Rspack.

[![version](https://npmx.dev/api/registry/badge/version/rspack-plugin-svg-sprite)](https://npmx.dev/package/rspack-plugin-svg-sprite)
[![downloads](https://npmx.dev/api/registry/badge/downloads/rspack-plugin-svg-sprite)](https://npmx.dev/package/rspack-plugin-svg-sprite)
[![CI](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml/badge.svg)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/actions/workflows/ci.yml)
[![coverage](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite/branch/main/graph/badge.svg)](https://codecov.io/gh/yichenzhu1337/rspack-plugin-svg-sprite)
[![dependencies](https://npmx.dev/api/registry/badge/dependencies/rspack-plugin-svg-sprite)](https://npmx.dev/package/rspack-plugin-svg-sprite)
[![types](https://npmx.dev/api/registry/badge/types/rspack-plugin-svg-sprite)](https://npmx.dev/package/rspack-plugin-svg-sprite)
[![license](https://npmx.dev/api/registry/badge/license/rspack-plugin-svg-sprite)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/blob/main/LICENSE)
[![renovate](https://img.shields.io/badge/maintained%20with-renovate-1A1F6C?logo=renovate&logoColor=white)](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/blob/main/.github/renovate.json)

**[Documentation](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/docs/)** ([llms.txt](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/docs/llms.txt) for AI agents) | **[Live Demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** | **[Open in StackBlitz](https://stackblitz.com/github/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/starters/stackblitz)** | **[npm](https://www.npmjs.com/package/rspack-plugin-svg-sprite)** | **[npmcharts](https://npmcharts.com/compare/rspack-plugin-svg-sprite?minimal=true)**

```bash
npm install rspack-plugin-svg-sprite -D
```

**Coming from `svg-sprite-loader`?** Swap the loader path and the plugin import; your component code stays the same. [See the diff ↓](#-migrating-from-svg-sprite-loader)

## 🧭 Contents

| Start here                                       | Reference                                                                 | Help                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------- |
| [🚀 Quick Start](#-quick-start)                  | [⚙️ API Reference](#️-api-reference)                                      | [🐛 Troubleshooting](#-troubleshooting) |
| [📦 Extract Mode](#-extract-mode)                | [🔍 How It Works](#-how-it-works)                                         | [🧩 Compatibility](#-compatibility)     |
| [🏗️ Rsbuild Integration](#️-rsbuild-integration) | [📊 Alternatives & Comparison](#-alternatives--comparison)                | [📚 Examples](#-examples)               |
| [🛠️ Framework Recipes](#️-framework-recipes)     | [🔄 Migrating from svg-sprite-loader](#-migrating-from-svg-sprite-loader) | [🙌 Contributing](#-contributing)       |

---

## 🤔 Why SVG sprites?

Individual SVG files mean one HTTP request per icon — 50 icons = 50 requests. Inlining SVGs directly into JSX bloats your bundle with duplicated markup. SVG sprites solve both problems: all icons are combined into a single file (or a single hidden DOM element), and each icon is referenced by `<use href="#id" />` — one request, zero duplication, full CSS styling support, and resolution-independent rendering at any size.

## 💡 What is this?

`rspack-plugin-svg-sprite` lets you import `.svg` files in your Rspack (or Webpack 5) project and automatically combine them into an SVG sprite sheet — either inlined in the DOM or extracted as an external `.svg` file.

It was created because the popular [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) depends on internal Webpack APIs (`NormalModule.getCompilationHooks`, `compilation.hooks.additionalAssets`, etc.) that do not exist in Rspack ([rspack#11609](https://github.com/web-infra-dev/rspack/issues/11609)). This package reimplements the same functionality using Rspack-compatible APIs while keeping the exact same exported symbol shape (`id`, `viewBox`, `url`, `content`), so your existing component code works without changes.

## ✨ Features

- **Inline mode** (default) — SVG symbols are injected into the DOM at runtime via a hidden `<svg>` element. No plugin needed.
- **Extract mode** — SVG symbols are emitted as an external `.svg` sprite file at build time. Great for caching and performance.
- **Drop-in replacement** for `svg-sprite-loader` — same config options, same export shape.
- **Works with both Rspack and Webpack 5** — auto-detects the bundler at runtime.
- **TypeScript** — fully typed, ships with `.d.ts` declarations.
- **Lightweight** — zero runtime dependencies.
- **Customizable symbol IDs** — use `[name]`, `[folder]`, or a custom function.

## 🚀 Quick Start

### Install

```bash
npm install rspack-plugin-svg-sprite -D
# or
pnpm add rspack-plugin-svg-sprite -D
# or
yarn add rspack-plugin-svg-sprite -D
# or
bun add rspack-plugin-svg-sprite -d
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

> ⚠️ **Heads up:** The `type: 'javascript/auto'` is required to prevent rspack/webpack's built-in asset module handling from intercepting `.svg` files before the loader runs. Without it, the loader may silently fail to process your SVGs.

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

### Accessibility

An icon next to visible text is decorative. Hide it from assistive technology:

```jsx
<svg viewBox={icon.viewBox} aria-hidden="true" focusable="false">
  <use href={icon.url} />
</svg>
```

An icon that stands alone, such as an icon-only button, needs a label:

```jsx
<svg viewBox={icon.viewBox} role="img" aria-label="Search">
  <use href={icon.url} />
</svg>
```

The hidden inline sprite itself is already marked `aria-hidden`. The end-to-end tests run axe on every consumer app to keep these patterns working.

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

## 📦 Extract Mode

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

## ⚙️ API Reference

### Loader Options

| Option           | Type                 | Default        | Description                                                                                                               |
| ---------------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `symbolId`       | `string \| function` | `'[name]'`     | Pattern for generating symbol IDs. Supports `[name]`, `[folder]`, `[ext]` placeholders, or a function `(filePath) => id`. |
| `esModule`       | `boolean`            | `true`         | Use ES module export (`export default`) vs CommonJS (`module.exports`).                                                   |
| `extract`        | `boolean`            | `false`        | Enable extract mode to emit an external sprite file instead of inlining.                                                  |
| `spriteFilename` | `string`             | `'sprite.svg'` | Output filename for the extracted sprite (extract mode only). Symbol ids must be unique within one sprite file.           |
| `publicPath`     | `string`             | `''`           | Public URL prefix for the sprite file (extract mode only). Auto-detected from `output.publicPath` if not set.             |

`include` and `exclude` are not loader options. To limit which SVGs become sprite symbols, use the `include` / `exclude` conditions of the bundler rule itself, or the options of the same name on the Rsbuild plugin (`pluginSvgSprite({ include: /icons/ })`).

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

> ✅ This matches `svg-sprite-loader`'s export shape exactly, so migrating requires no component changes.

## 🏗️ Rsbuild Integration

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

> 💡 **Tip:** The Rsbuild plugin handles the loader rule, `type: 'javascript/auto'`, and the `SvgSpritePlugin` automatically.

## 🛠️ Framework Recipes

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

## 🔄 Migrating from svg-sprite-loader

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

> ✅ **No component changes:** your component code stays the same — the exported symbol object has the identical shape (`id`, `viewBox`, `url`, `content`).

## 🔄 Migrating from `asset/resource`

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

> 💡 **Key points:**

- `type: 'javascript/auto'` is **required** — it overrides the previous `asset/resource` handling and lets the loader process SVGs as JavaScript modules.
- The sprite file is emitted to your output directory (e.g., `dist/sprite.svg`).
- If you were using a separate CLI tool (like `svg-sprite`) to generate sprites as a post-build step, you can remove that — the plugin handles everything inside the rspack build pipeline.

## 🔍 How It Works

### Inline Mode

1. The loader parses each `.svg` file and wraps its content in an SVG `<symbol>` element.
2. It generates a JS module that imports a browser-side sprite manager.
3. At runtime, the sprite manager creates a hidden `<svg>` element in `document.body` and appends all symbols.
4. You reference symbols via `<use href="#symbolId" />`.

### Extract Mode

1. The loader wraps each SVG as a `<symbol>` and registers it with the plugin via the compilation object.
2. During Rspack's `processAssets` stage, the plugin collects all registered symbols and emits a combined `.svg` sprite file.
3. The exported JS module contains the external file URL (e.g., `/sprites/icons.svg#symbolId`).

## 📊 Alternatives & Comparison

Looking for the right SVG solution for Rspack? Here's how the options compare:

<details>
<summary>📊 Full comparison table</summary>

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

</details>

**When to use SVG sprites** (this plugin): You want icons combined into a single file with `<use href="#id">` references — optimal for large icon sets, full CSS styling control, and caching. Best when migrating from `svg-sprite-loader`.

**When to use SVGR**: You want each SVG as a React component with props for color, size, etc. Better for SVGs that need dynamic manipulation via React props rather than CSS.

## 🧩 Compatibility

| Bundler                            | Tested versions | What the test suite covers                                       |
| ---------------------------------- | --------------- | ---------------------------------------------------------------- |
| [Rspack](https://rspack.dev/)      | 1.7 and 2.3     | Inline and extract builds, watch mode, persistent cache restarts |
| [Rsbuild](https://rsbuild.dev/)    | 1.7 and 2.3     | The `pluginSvgSprite` wrapper                                    |
| [Webpack](https://webpack.js.org/) | 5.105           | Inline and extract builds, watch mode, filesystem cache restarts |

The peer range still accepts `@rspack/core` 0.5 and newer, so existing installs keep working, but versions older than 1.7 are not exercised by the tests.

### Module formats and TypeScript

- **CommonJS and ESM.** Every entry (`.`, `/plugin`, `/loader`, `/rsbuild`, `/runtime/*`) works with `require()` and with `import`. From 1.6.0, ESM default imports of the subpaths give the real value, so an ESM config can write `import SvgSpritePlugin from 'rspack-plugin-svg-sprite/plugin'`.
- **One implementation.** The ESM entry points re-export the CommonJS build, so a page always has exactly one sprite, even when app code imports the runtime directly.
- **TypeScript.** Types resolve under `moduleResolution` `node16`, `nodenext` and `bundler`, and from 1.6.0 also under the older `node10` setting for every subpath.
- **TypeScript versions.** The declarations compile on TypeScript 5.0 and newer. CI checks them on 5.0, 5.2, 5.3, 5.9 and 7.

## 📚 Examples

The repository includes three runnable demo apps:

| Example                                              | Bundler   | Plugin                     | Port | Description                                                       |
| ---------------------------------------------------- | --------- | -------------------------- | ---- | ----------------------------------------------------------------- |
| [`react-rspack`](examples/react-rspack/)             | Rspack    | `rspack-plugin-svg-sprite` | 3000 | Extract mode with icon gallery, sidebar, and buttons              |
| [`react-webpack`](examples/react-webpack/)           | Webpack 5 | `svg-sprite-loader`        | 4000 | Same UI using the original loader (for comparison)                |
| [`vue-rspack-extract`](examples/vue-rspack-extract/) | Rspack    | `rspack-plugin-svg-sprite` | 3002 | Vue 3 + extract mode with `plainSprite` and external `<use href>` |

**[Live demo (Rspack)](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** — see the plugin in action.

**[Open the starter in StackBlitz](https://stackblitz.com/github/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/starters/stackblitz)** — a minimal Rspack project that installs the published package ([`starters/stackblitz`](starters/stackblitz/)).

Run locally from the project root:

```bash
bun install
bun run dev:rspack   # http://localhost:3000
bun run dev:webpack  # http://localhost:4000
```

## 🐛 Troubleshooting

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

### Icon is a broken image, or DevTools shows `data:image/svg+xml;base64`

**Symptom:** The build succeeds, but the icon does not render and its source is a `data:` URI or a hashed `.svg` file that contains JavaScript.

**Cause:** Another rule (your own image rule, or a framework default) assigns an asset module type to `.svg` files. The sprite loader still runs, but its JavaScript output is emitted as the image instead of being executed.

**Fix:** The loader prints a build warning that names the file and the module type, for example `... is handled as module type "asset/inline"`. Add `type: 'javascript/auto'` to the rule that uses `rspack-plugin-svg-sprite/loader`, or exclude your icon folder from the other rule.

### Icons vanish from the extracted sprite during development, or after a cached rebuild

**Symptom:** In extract mode, icons disappear from `sprite.svg` after you edit a file while the dev server is running. Or, with a persistent build cache (`cache.type: 'persistent'` in Rspack 2, `experiments.cache` in Rspack 1, `cache.type: 'filesystem'` in webpack), the second build emits no sprite at all.

**Cause:** Versions up to 1.5.2 let the bundler cache SVG modules in extract mode. A cached module skips the loader, so its symbol was never registered with the plugin.

**Fix:** Upgrade to 1.5.3 or newer. In extract mode the loader now opts out of caching, so every icon is read again on each rebuild (roughly 0.05 to 0.1 ms per icon). Inline mode is unaffected and stays cached.

### Two icons show the same gradient, clip path, or class styling

**Cause:** All symbols live in one SVG document. Icons minified by SVGO often reuse ids such as `id="a"`, and Illustrator exports reuse class names such as `.cls-1`. The first definition in the document wins.

**Fix:** Let SVGO prefix ids and class names per file before the sprite loader runs:

```bash
npm install svgo svgo-loader -D
```

```js
{
  test: /\.svg$/,
  type: 'javascript/auto',
  use: [
    { loader: 'rspack-plugin-svg-sprite/loader', options: { symbolId: 'icon-[name]' } },
    { loader: 'svgo-loader', options: { plugins: [{ name: 'prefixIds' }] } },
  ],
}
```

Loaders run from the last entry to the first, so SVGO processes the raw SVG and the sprite loader receives the result. This recipe is covered by the test suite with svgo-loader 5 and svgo 4.

### An icon is scaled differently after upgrading from 1.5.2 or older

**Cause:** Older versions lowercased attribute names on the root `<svg>`, which turned `preserveAspectRatio` into an attribute browsers ignore. The attribute is now kept exactly as written, so the icon scales the way the SVG file asks.

**Fix:** If you preferred the old rendering, remove `preserveAspectRatio` from the source SVG.

### One plugin instance shared by several configs

If you export an array of configs (a multi-compiler build, for example client and server), create a separate `new SvgSpritePlugin()` for each config. A shared instance puts the icons of every build into each sprite.

### Known limitations

- An SVG with no `viewBox` and no numeric `width` and `height` gets `viewBox="0 0 24 24"`. Add a `viewBox` to the source file if that is not its real size.
- `spriteFilename` is used literally. Placeholders such as `[hash]` or `[chunkname]` are not interpolated.
- The sprite URL is fixed at build time from the loader's `publicPath` option, or from `output.publicPath` when that is a plain string. `output.publicPath: 'auto'` and function values are not read, so set the loader's `publicPath` in those setups.
- The Rsbuild plugin replaces Rsbuild's built-in SVG rule. `./icon.svg?url`, `?inline` and `?raw` therefore also return a sprite symbol, and SVGs outside the plugin's `include` / `exclude` scope are left without Rsbuild's default handling.
- In extract mode, Safari (WebKit) does not resolve `url(#id)` references inside an external sprite file. An icon that uses a gradient, pattern, filter, mask or clip-path paints blank there. Chrome and Firefox are not affected. Use inline mode for those icons, or flatten the effect to solid fills. The end-to-end tests cover this case.
- An entity declared in an SVG's DOCTYPE (`<!ENTITY fill "red">`, used as `&fill;`) is not expanded. The DOCTYPE is not copied into the sprite, so the reference is undeclared there, and an external sprite that contains one is not well-formed XML. The build prints a warning that names the file and the entity. Replace the entity with its literal value in the file, or run SVGO, which expands entities.
- The icon id is the file name. `icon.id` is that name as written. In the markup (`icon.content` and the extracted sprite) the characters `&`, `<` and `"` are escaped, so `Q&A.svg` is written as `<symbol id="Q&amp;A">` and an XML or HTML parser reads it back as `Q&A`. In `icon.url` the id is used raw, except that a `%` followed by two hex digits is written as `%25`. Control characters other than tab, newline and carriage return cannot be written in XML at all, so avoid them in file names.

## 🙌 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and guidelines.

## 📄 License

[MIT](LICENSE)
