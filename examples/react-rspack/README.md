# 🧩 React + Rspack SVG Sprite Demo

> [!NOTE]
> Example React application using [`rspack-plugin-svg-sprite`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) with [Rspack](https://rspack.dev/) in **extract mode**.

**[Live demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/)** — see this example running on GitHub Pages.

This demo combines every flag in the world (265 SVG files) into a single sprite sheet and references them with `<use>` — all powered by `rspack-plugin-svg-sprite`.

## 🛠️ Setup

From the repository root (recommended — uses Bun workspaces):

```bash
bun install
bun run dev:rspack
```

Or from this directory:

```bash
cd examples/react-rspack
bun install
bun run dev
```

> [!TIP]
> The dev server starts at **http://localhost:3000**.

## 🔍 How it works

### ⚙️ Rspack configuration

SVG files are processed by `rspack-plugin-svg-sprite/loader` in extract mode. The `SvgSpritePlugin` collects all symbols and emits a single `sprite.svg` at build time.

```js
// rspack.config.js
{
  test: /\.svg$/,
  include: flagsDir, // country-flag-icons/3x2
  type: 'javascript/auto',
  loader: 'rspack-plugin-svg-sprite/loader',
  options: {
    extract: true,
    symbolId: 'flag-[name]',
    spriteFilename: 'sprite.svg',
    esModule: false,
  },
}
```

### 🧩 Using a flag in React

```jsx
import flag from '@flags/JP.svg';

// flag.id      → "flag-JP"
// flag.viewBox → "0 0 513 342"
// flag.url     → "sprite.svg#flag-JP"

<svg viewBox={flag.viewBox}>
  <use href={flag.url} />
</svg>;
```

`@flags` is an alias to `country-flag-icons/3x2` (see `rspack.config.js`). Two rules write to the same `sprite.svg`: one for the flags (`flag-[name]`), one for the UI icons (`icon-[name]`).

### ✨ What the demo includes

- **Static page** — everything except the flag wall is plain HTML in `src/index.html`, so crawlers, `curl` and AI agents can read it. `public/llms.txt` is copied to the site root.
- **Flag wall** — all 265 flags of `country-flag-icons` from one `sprite.svg`, with search (name or code), a "Show all" button and an inspector that prints the live `{ id, viewBox, url }` of the selected flag, with a copy button. The default flag comes from the visitor's region.
- **Light and dark theme** — follows the OS, with a toggle that stores the choice.
- **Real transfer size** — the size of `sprite.svg` next to the stats comes from the Resource Timing API.

## 🎨 Credits

- Flags: [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) (MIT), version-pinned in `package.json`.
- UI icons (`src/icons/`): [Feather](https://feathericons.com/) (MIT), stroke-based SVGs.

## 📂 Project structure

<details>
<summary>📄 Files</summary>

```
react-rspack/
├── rspack.config.js      # Extract-mode sprite config, @flags alias
├── public/
│   └── llms.txt          # Copied to the site root
├── src/
│   ├── index.html        # Static page (all text and code)
│   ├── index.jsx         # Entry: mounts the flag wall
│   ├── App.jsx           # Renders <FlagWall />
│   ├── FlagWall.jsx      # Search, grid, inspector
│   ├── flags.js          # Loads and names the 265 flags
│   ├── flag-order.js     # Most populous first
│   ├── icons.js          # Adds the UI icons to the sprite
│   ├── icons/            # Feather UI icons
│   ├── theme.js          # Theme toggle, copy button
│   ├── stats.js          # Sprite transfer size
│   └── styles.css        # Light and dark tokens, layout
└── dist/                 # Build output (generated)
```

</details>

## 🔗 See also

- [rspack-plugin-svg-sprite](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) — the plugin powering this demo
- [react-webpack example](../react-webpack/) — same UI built with Webpack 5 + `svg-sprite-loader` for comparison
