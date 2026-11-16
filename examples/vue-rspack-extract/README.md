# 🧩 Vue + Rspack SVG Sprite Demo

> [!NOTE]
> Example Vue 3 application using [`rspack-plugin-svg-sprite`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) with [Rspack](https://rspack.dev/) in **extract mode** with `plainSprite: true` and external `<use href>` references.

This demo shows the pattern many production apps use: icons are looked up by name at runtime, and the sprite is emitted as a separate `sprite.svg` file.

## 🛠️ Setup

From the repository root, install once, then start the dev server from this directory:

```bash
bun install
cd examples/vue-rspack-extract
bun run dev
```

> [!TIP]
> The dev server starts at **http://localhost:3002**. Use `bun run build` for a production build.

## 🔍 How it works

### ⚙️ Rspack configuration

SVG files in `src/icons/` are processed by `rspack-plugin-svg-sprite/loader` in extract mode. `SvgSpritePlugin` with `plainSprite: true` emits a single `sprite.svg` without preview styles.

```js
// rspack.config.js
{
  test: /\.svg$/,
  include: [path.resolve(__dirname, 'src/icons')],
  type: 'javascript/auto',
  loader: 'rspack-plugin-svg-sprite/loader',
  options: {
    extract: true,
    symbolId: '[name]',
    spriteFilename: 'sprite.svg',
  },
}
```

```js
plugins: [new SvgSpritePlugin({ plainSprite: true })];
```

### 🧩 Using icons in Vue

`BaseIcon` references the sprite by name with an external `<use href>`:

```vue
<svg class="icon">
  <use :href="`/sprite.svg#${icon}`" />
</svg>
```

Because the icon name is dynamic, nothing imports the SVG files directly. `BaseIcon` therefore loads each one on mount so Rspack discovers it and includes it in the sprite:

```js
import(/* webpackMode: "eager" */ `~/icons/${this.icon}.svg`);
```

> [!IMPORTANT]
> The `~` alias points to `src/` (see `resolve.alias` in `rspack.config.js`). The `/sprite.svg` URL assumes `output.publicPath: '/'`, which this config sets.

### ✨ What the demo includes

<details>
<summary>📄 3 demo sections</summary>

- **Icon grid** — all five icons (`home`, `search`, `settings`, `close`, `check`) at the large size
- **Interactive icons** — `BaseIcon` with `clickable` enabled and a click log
- **Sizes** — the `small`, default and `large` sizes side by side

</details>

## 📂 Project structure

<details>
<summary>📄 Files</summary>

```
vue-rspack-extract/
├── rspack.config.js      # Rspack config with extract-mode SVG sprite and vue-loader
├── src/
│   ├── index.html        # HTML template
│   ├── main.js           # Vue entry point
│   ├── App.vue           # Main component
│   ├── components/       # BaseIcon
│   └── icons/            # SVG icon files
└── dist/                 # Build output (generated)
```

</details>

## 🔗 See also

- [rspack-plugin-svg-sprite](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite) — the plugin powering this demo
- [react-rspack example](../react-rspack/) — React + Rspack extract mode
- [react-webpack example](../react-webpack/) — same UI built with Webpack 5 + `svg-sprite-loader` for comparison
