# React + Webpack SVG Sprite Demo

> Example React application using [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) with [Webpack 5](https://webpack.js.org/) in **extract mode**. This serves as a side-by-side comparison with the [`react-rspack`](../react-rspack/) example.

This demo uses the **original `svg-sprite-loader`** (not `rspack-plugin-svg-sprite`) to show the Webpack-based workflow that `rspack-plugin-svg-sprite` was designed to replace.

## Setup

From the repository root (recommended — uses pnpm workspaces):

```bash
pnpm install
pnpm dev:webpack
```

Or from this directory:

```bash
cd examples/react-webpack
pnpm install
pnpm dev
```

The dev server starts at **http://localhost:4000**.

## How it works

### Webpack configuration

SVG files in `src/icons/` are processed by two loaders:

- **`svgo-loader`** — optimizes the SVG (removes titles, metadata, etc.)
- **`svg-sprite-loader`** with `extract: true` — extracts each SVG into a shared `sprite.svg` file

```js
// webpack.config.js
{
  test: /\.svg$/,
  include: [path.resolve(__dirname, 'src/icons')],
  use: [
    {
      loader: 'svg-sprite-loader',
      options: {
        extract: true,
        spriteFilename: 'sprite.svg',
      },
    },
    { loader: 'svgo-loader' },
  ],
}
```

The `SpriteLoaderPlugin` collects all extracted symbols and emits the sprite file:

```js
const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');
plugins: [new SpriteLoaderPlugin()];
```

### Using icons in React

```jsx
import approvedIcon from './icons/approved.svg';

// approvedIcon.id      → "approved"
// approvedIcon.viewBox → "0 0 24 24"
// approvedIcon.url     → "sprite.svg#approved"

<svg viewBox={approvedIcon.viewBox}>
  <use xlinkHref={approvedIcon.url} />
</svg>;
```

A reusable `BaseIcon` component wraps this pattern:

```jsx
import BaseIcon from './components/BaseIcon';

<BaseIcon icon={approvedIcon} size={24} />;
```

### What the demo includes

- **Icon Gallery** — all icons in a responsive grid with hover effects
- **Sidebar Navigation** — a realistic app sidebar with icon + label nav items
- **Buttons** — icon buttons inside interactive elements
- **Notification Cards** — color-coded notification feed using different icons
- **Code Example** — the actual usage pattern displayed in-page

## Why svg-sprite-loader doesn't work with Rspack

`svg-sprite-loader` relies on several Webpack-only internal APIs that are not available in Rspack:

| Webpack API                                            | Purpose                                |
| ------------------------------------------------------ | -------------------------------------- |
| `NormalModule.getCompilationHooks(compilation).loader` | Injects plugin into loader context     |
| `compilation.hooks.additionalAssets`                   | Emits the sprite file                  |
| `compilation.hooks.afterOptimizeChunks`                | Replaces placeholders in module source |

These hooks don't exist in Rspack, which is why [`rspack-plugin-svg-sprite`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) was created as a compatible replacement. The migration is straightforward — see the [migration guide](../../README.md#migrating-from-svg-sprite-loader).

## Project structure

```
react-webpack/
├── webpack.config.js     # Webpack 5 config with extract-mode SVG sprite
├── src/
│   ├── index.html        # HTML template
│   ├── index.jsx         # React entry point
│   ├── App.jsx           # Main React component
│   ├── styles.css        # Dark-themed modern styling
│   ├── components/       # BaseIcon, IconGallery, Sidebar, etc.
│   └── icons/            # Sample SVG icons
└── dist/                 # Build output (generated)
```

## See also

- [rspack-plugin-svg-sprite](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) — the Rspack-compatible replacement
- [react-rspack example](../react-rspack/) — same UI built with Rspack + `rspack-plugin-svg-sprite`
- [Migration guide](../../README.md#migrating-from-svg-sprite-loader) — step-by-step instructions to switch from `svg-sprite-loader`
