# SVG Sprite Consumer Demo — Old Webpack Pattern

This demo shows how a typical app uses SVG icons via **webpack + `svg-sprite-loader`** in **extract mode**. It serves as a reference for understanding the old pattern before migrating to `rspack-plugin-svg-sprite`.

## The Old Pattern

### 1. Webpack config (`webpack.config.js`)

SVG files in `images/icons/` are processed by two loaders:

- **`svgo-loader`** — optimizes the SVG (removes titles, metadata, etc.)
- **`svg-sprite-loader`** with `extract: true` — extracts each SVG into a shared `sprite.svg` file emitted to `dist/`

```js
{
  test: /\.svg$/,
  include: [path.resolve(__dirname, 'src/images/icons')],
  use: [
    {
      loader: 'svg-sprite-loader',
      options: {
        extract: true,
        spriteFilename: (svgPath) => `sprite${svgPath.substr(-4)}`,
      },
    },
    { loader: 'svgo-loader' },
  ],
}
```

### 2. Plugin

`SpriteLoaderPlugin` is required to collect the extracted symbols and emit the sprite file:

```js
const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');

plugins: [new SpriteLoaderPlugin()]
```

### 3. BaseIcon component

A typical `BaseIcon` component receives an icon name as a prop. On mount, it dynamically imports the SVG file using webpack's eager mode:

```js
mounted() {
  import(/* webpackMode: "eager" */ `~/images/icons/${this.icon}.svg`);
}
```

This triggers webpack to process the file through `svg-sprite-loader`, which adds it to the extracted sprite sheet. The component then renders:

```html
<svg>
  <use :xlink:href="`/dist/sprite.svg#${this.icon}`" />
</svg>
```

### 4. Output

Webpack emits `dist/sprite.svg` containing all the `<symbol>` elements. Each icon is referenced at runtime via `<use xlink:href="sprite.svg#icon-id">`.

## Why this doesn't work with Rspack

`svg-sprite-loader` relies on several webpack-only internal APIs:

| API | Purpose |
|-----|---------|
| `NormalModule.getCompilationHooks(compilation).loader` | Injects plugin into loader context |
| `compilation.hooks.additionalAssets` | Emits the sprite file |
| `compilation.hooks.afterOptimizeChunks` | Replaces placeholders in module source |

These hooks don't exist in Rspack, which is why `rspack-plugin-svg-sprite` was created as a compatible replacement.

## Setup

```bash
cd consumer-old
npm install
```

## Scripts

```bash
# Start webpack dev server at http://localhost:3001
npm run dev

# Production build to dist/
npm run build
```

## Project structure

```
consumer-old/
├── package.json
├── webpack.config.js          # webpack 5 + svg-sprite-loader extract mode
├── src/
│   ├── index.html
│   ├── index.js               # Imports icons, renders BaseIcon-style component
│   ├── styles.css
│   └── images/
│       └── icons/             # Sample SVG icons
│           ├── approved.svg
│           ├── close.svg
│           ├── comment.svg
│           ├── delete.svg
│           ├── filter.svg
│           ├── help.svg
│           ├── save.svg
│           └── user.svg
└── dist/                      # Build output (generated)
    ├── bundle.*.js
    ├── styles.*.css
    ├── sprite.svg             # <-- The extracted SVG sprite sheet
    └── index.html
```
