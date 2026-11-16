# Inline vs extract mode

|                  | Inline (default)                                      | Extract                                         |
| ---------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Where symbols go | A hidden `<svg>` in `document.body`, added at runtime | An external `.svg` sprite file emitted at build |
| Plugin needed    | No                                                    | Yes, `SvgSpritePlugin`                          |
| `icon.url`       | `#symbolId`                                           | `<publicPath><spriteFilename>#symbolId`         |
| Build cache      | Modules stay cached                                   | Modules are not cached (see below)              |

## Inline mode

No plugin is needed.

1. The loader parses each `.svg` file and wraps its content in an SVG `<symbol>` element.
2. It generates a JS module that imports a browser-side sprite manager.
3. At runtime, the sprite manager creates a hidden `<svg>` element in `document.body` and appends all symbols.
4. You reference symbols via `<use href="#symbolId" />`.

## Extract mode

Enable `extract` on the loader and add the plugin:

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

The exported `url` points to the external file:

```jsx
import icon from './icon.svg';

// icon.url -> "/assets/sprites/icons.svg#icon-icon"

<svg viewBox={icon.viewBox}>
  <use href={icon.url} />
</svg>;
```

How it works:

1. The loader wraps each SVG as a `<symbol>` and registers it with the plugin via the compilation object.
2. During the `processAssets` stage, the plugin collects all registered symbols and emits a combined `.svg` sprite file.
3. The exported JS module contains the external file URL, for example `/sprites/icons.svg#symbolId`.

:::info
In extract mode the loader opts out of the bundler's module cache, because registering the symbol is a side effect of running the loader. Every icon is read again on each rebuild (roughly 0.05 to 0.1 ms per icon). Inline mode is unaffected and stays cached.
:::

If you export an array of configs (for example client and server), create a separate `new SvgSpritePlugin()` for each config. A shared instance puts the icons of every build into each sprite.

Safari (WebKit) does not resolve `url(#id)` references inside an external sprite file, so icons that use a gradient, pattern, filter, mask or clip-path paint blank there in extract mode. See [FAQ](/faq#known-limitations).
