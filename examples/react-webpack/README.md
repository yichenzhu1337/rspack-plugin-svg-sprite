# React + Webpack SVG Sprite Demo

A React application bundled with [Webpack 5](https://webpack.js.org/) that demonstrates the original [`svg-sprite-loader`](https://github.com/JetBrains/svg-sprite-loader) in **extract mode**. This serves as a comparison reference alongside the `react-rspack` example.

## Setup

```bash
cd examples/react-webpack
pnpm install
```

## Scripts

```bash
# Start the dev server at http://localhost:4001
pnpm dev

# Production build to dist/
pnpm build
```

## How it works

### Webpack configuration

SVG files in `src/icons/` are processed by two loaders:

- **`svgo-loader`** — optimizes the SVG (removes titles, metadata, etc.)
- **`svg-sprite-loader`** with `extract: true` — extracts each SVG into a shared `sprite.svg` file

```js
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
plugins: [new SpriteLoaderPlugin()]
```

### Importing and using icons

```jsx
import approvedIcon from './icons/approved.svg';

// approvedIcon.id      -> "approved"
// approvedIcon.viewBox -> "0 0 24 24"
// approvedIcon.url     -> "sprite.svg#approved"

<svg viewBox={approvedIcon.viewBox}>
  <use xlinkHref={approvedIcon.url} />
</svg>
```

The `BaseIcon` component wraps this pattern for reuse:

```jsx
import BaseIcon from './components/BaseIcon';
<BaseIcon icon={approvedIcon} size={24} />
```

### What the demo shows

- **Icon Gallery** — All icons in a responsive grid with hover effects
- **Sidebar Navigation** — A realistic app sidebar with icon + label nav items
- **Buttons** — Icon buttons inside interactive elements
- **Notification Cards** — Color-coded notification feed using different icons
- **Code Example** — The actual usage pattern displayed in-page

## Why this doesn't work with Rspack

`svg-sprite-loader` relies on several webpack-only internal APIs:

| API | Purpose |
|-----|---------|
| `NormalModule.getCompilationHooks(compilation).loader` | Injects plugin into loader context |
| `compilation.hooks.additionalAssets` | Emits the sprite file |
| `compilation.hooks.afterOptimizeChunks` | Replaces placeholders in module source |

These hooks don't exist in Rspack, which is why `rspack-plugin-svg-sprite` was created as a compatible replacement.

## Project structure

```
react-webpack/
├── package.json          # Deps: react, webpack, babel, svg-sprite-loader
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
