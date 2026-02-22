# React + Rspack SVG Sprite Demo

A React application bundled with [Rspack](https://rspack.dev/) that demonstrates real-world usage of [`rspack-plugin-svg-sprite`](../../) in **extract mode**.

## Setup

```bash
cd examples/react-rspack
pnpm install
```

This installs Rspack, React, and links the local `rspack-plugin-svg-sprite` package via `workspace:*`.

## Scripts

```bash
# Start the dev server at http://localhost:3000
pnpm dev

# Production build to dist/
pnpm build
```

## How it works

### Rspack configuration

The SVG sprite loader is configured in `rspack.config.js` with extract mode enabled:

```js
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

The `SvgSpritePlugin` collects all symbols and emits a single `sprite.svg` file at build time.

### Importing and using icons

```jsx
import homeIcon from './icons/home.svg';

// homeIcon.id      -> "icon-home"
// homeIcon.viewBox -> "0 0 24 24"
// homeIcon.url     -> "sprite.svg#icon-home"

<svg viewBox={homeIcon.viewBox}>
  <use xlinkHref={homeIcon.url} />
</svg>;
```

The `BaseIcon` component wraps this pattern for reuse:

```jsx
import BaseIcon from './components/BaseIcon';
<BaseIcon icon={homeIcon} size={24} />;
```

### What the demo shows

- **Icon Gallery** — All icons in a responsive grid with hover effects
- **Sidebar Navigation** — A realistic app sidebar with icon + label nav items
- **Buttons** — Icon buttons inside interactive elements
- **Notification Cards** — Color-coded notification feed using different icons
- **Code Example** — The actual usage pattern displayed in-page

## Icons included

All icons are [Feather](https://feathericons.com/)-style, stroke-based SVGs in `src/icons/`.

## Project structure

```
react-rspack/
├── package.json          # Deps: react, react-dom, rspack, rspack-plugin-svg-sprite
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
