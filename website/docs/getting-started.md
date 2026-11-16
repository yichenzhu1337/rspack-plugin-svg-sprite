# Getting started

`rspack-plugin-svg-sprite` lets you import `.svg` files in an Rspack, Rsbuild or webpack 5 project and combines them into an SVG sprite, either inlined in the DOM or extracted as an external `.svg` file. Icons are referenced with `<use href="#id" />`: one request, no duplicated markup, full CSS styling.

Try it without installing anything: [open the starter on StackBlitz](https://stackblitz.com/github/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/starters/stackblitz), or look at the [live demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/).

## Install

```bash
npm install rspack-plugin-svg-sprite -D
# or
pnpm add rspack-plugin-svg-sprite -D
# or
yarn add rspack-plugin-svg-sprite -D
# or
bun add rspack-plugin-svg-sprite -d
```

## Rspack

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

:::warning
`type: 'javascript/auto'` is required. It stops the built-in asset module handling from intercepting `.svg` files before the loader runs. Without it, the loader may silently fail to process your SVGs.
:::

## webpack 5

The loader and plugin detect the bundler at runtime, so the configuration is the same as for Rspack:

```js
// webpack.config.js
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

## Rsbuild

The Rsbuild plugin adds the loader rule, `type: 'javascript/auto'` and the `SvgSpritePlugin` for you:

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

It accepts the loader options, the [plugin options](/options#plugin-options) and `include` / `exclude`.

## Use in your components

```jsx
import logo from './logo.svg';

// logo.id      -> "logo"
// logo.viewBox -> "0 0 24 24"
// logo.url     -> "#logo"

<svg viewBox={logo.viewBox}>
  <use href={logo.url} />
</svg>;
```

Every imported SVG is registered as a `<symbol>` in a sprite and referenced by `#id`. The exported object always has this shape:

| Property  | Type     | Example                                            | Description                                        |
| --------- | -------- | -------------------------------------------------- | -------------------------------------------------- |
| `id`      | `string` | `"icon-home"`                                      | The symbol ID inside the sprite.                   |
| `viewBox` | `string` | `"0 0 24 24"`                                      | The original SVG `viewBox` attribute.              |
| `url`     | `string` | `"#icon-home"` or `"/sprites/icons.svg#icon-home"` | Fragment reference (inline) or full URL (extract). |
| `content` | `string` | `"<symbol id=\"icon-home\" ...>...</symbol>"`      | Raw `<symbol>` markup.                             |

## TypeScript

The package ships a client type declaration. Add it to your `tsconfig.json` so `import icon from './icon.svg'` is typed:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["rspack-plugin-svg-sprite/client"],
  },
}
```

If you prefer a manual declaration, create a `svg.d.ts` that the `tsconfig.json` includes:

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

## Accessibility

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

## Compatibility

| Bundler                            | Tested versions | What the test suite covers                                       |
| ---------------------------------- | --------------- | ---------------------------------------------------------------- |
| [Rspack](https://rspack.dev/)      | 1.7 and 2.3     | Inline and extract builds, watch mode, persistent cache restarts |
| [Rsbuild](https://rsbuild.dev/)    | 1.7 and 2.3     | The `pluginSvgSprite` wrapper                                    |
| [Webpack](https://webpack.js.org/) | 5.105           | Inline and extract builds, watch mode, filesystem cache restarts |

The peer range still accepts `@rspack/core` 0.5 and newer, so existing installs keep working, but versions older than 1.7 are not exercised by the tests.

- **CommonJS and ESM.** Every entry (`.`, `/plugin`, `/loader`, `/rsbuild`, `/runtime/*`) works with `require()` and with `import`. From 1.6.0, ESM default imports of the subpaths give the real value, so an ESM config can write `import SvgSpritePlugin from 'rspack-plugin-svg-sprite/plugin'`.
- **One implementation.** The ESM entry points re-export the CommonJS build, so a page always has exactly one sprite, even when app code imports the runtime directly.
- **TypeScript.** Types resolve under `moduleResolution` `node16`, `nodenext` and `bundler`, and from 1.6.0 also under the older `node10` setting for every subpath.
