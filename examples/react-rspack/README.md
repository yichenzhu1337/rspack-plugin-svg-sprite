# React + Rspack SVG Sprite Demo

> Example React application using [`rspack-plugin-svg-sprite`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) with [Rspack](https://rspack.dev/) in **extract mode**.

**[Live demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** — see this example running on GitHub Pages.

This demo shows how to import SVG icons, combine them into a single sprite sheet, and reference them with `<use>` — all powered by `rspack-plugin-svg-sprite`.

## Setup

From the repository root (recommended — uses pnpm workspaces):

```bash
pnpm install
pnpm dev:rspack
```

Or from this directory:

```bash
cd examples/react-rspack
pnpm install
pnpm dev
```

The dev server starts at **http://localhost:3000**.

## How it works

### Rspack configuration

SVG files are processed by `rspack-plugin-svg-sprite/loader` in extract mode. The `SvgSpritePlugin` collects all symbols and emits a single `sprite.svg` at build time.

```js
// rspack.config.js
{
  test: /\.svg$/,
  loader: 'rspack-plugin-svg-sprite/loader',
  options: {
    extract: true,
    symbolId: 'icon-[name]',
    spriteFilename: 'sprite.svg',
    esModule: false,
  },
}
```

### Using icons in React

```jsx
import homeIcon from './icons/home.svg';

// homeIcon.id      → "icon-home"
// homeIcon.viewBox → "0 0 24 24"
// homeIcon.url     → "sprite.svg#icon-home"

<svg viewBox={homeIcon.viewBox}>
  <use xlinkHref={homeIcon.url} />
</svg>;
```

A reusable `BaseIcon` component wraps this pattern:

```jsx
import BaseIcon from './components/BaseIcon';

<BaseIcon icon={homeIcon} size={24} />;
```

### What the demo includes

- **Icon Gallery** — all icons in a responsive grid with hover effects
- **Sidebar Navigation** — a realistic app sidebar with icon + label nav items
- **Buttons** — icon buttons inside interactive elements
- **Notification Cards** — color-coded notification feed using different icons
- **Code Example** — the actual usage pattern displayed in-page

## Icons

All icons are [Feather](https://feathericons.com/)-style, stroke-based SVGs located in `src/icons/`.

## Project structure

```
react-rspack/
├── rspack.config.js      # Rspack config with extract-mode SVG sprite
├── src/
│   ├── index.html        # HTML template
│   ├── index.jsx         # React entry point
│   ├── App.jsx           # Main React component
│   ├── styles.css        # Dark-themed modern styling
│   ├── components/       # BaseIcon, IconGallery, Sidebar, etc.
│   └── icons/            # SVG icon files
└── dist/                 # Build output (generated)
```

## See also

- [rspack-plugin-svg-sprite](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) — the plugin powering this demo
- [react-webpack example](../react-webpack/) — same UI built with Webpack 5 + `svg-sprite-loader` for comparison
