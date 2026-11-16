# FAQ and troubleshooting

## Sprite file not emitted / icons not rendering

**Symptom:** The build succeeds with no errors, but `sprite.svg` is not in the output directory and SVG icons do not render.

**Cause:** The built-in asset module handling is intercepting `.svg` files before the loader runs.

**Fix:** Add `type: 'javascript/auto'` to your SVG rule:

```js
{
  test: /\.svg$/,
  type: 'javascript/auto', // add this
  loader: 'rspack-plugin-svg-sprite/loader',
  options: { extract: true, symbolId: '[name]' },
}
```

## Warning: "SvgSpritePlugin is registered but no SVG symbols were collected"

The plugin is in your `plugins` array but no SVGs went through the loader. Common causes:

1. Missing `type: 'javascript/auto'` on the loader rule.
2. `include` / `exclude` filters on the rule do not match your SVG file paths.
3. No SVG imports in your code. At least one `.svg` file must be imported.

## Warning: "Extract mode is enabled but SvgSpritePlugin was not found"

The loader runs in extract mode (`extract: true`) but `SvgSpritePlugin` is not in the `plugins` array:

```js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  plugins: [new SvgSpritePlugin()],
};
```

## Icon is a broken image, or DevTools shows `data:image/svg+xml;base64`

**Cause:** Another rule (your own image rule, or a framework default) assigns an asset module type to `.svg` files. The sprite loader still runs, but its JavaScript output is emitted as the image instead of being executed.

**Fix:** The loader prints a build warning that names the file and the module type, for example `... is handled as module type "asset/inline"`. Add `type: 'javascript/auto'` to the rule that uses `rspack-plugin-svg-sprite/loader`, or exclude your icon folder from the other rule.

## Icons vanish from the extracted sprite during development, or after a cached rebuild

**Cause:** Versions up to 1.5.2 let the bundler cache SVG modules in extract mode. A cached module skips the loader, so its symbol was never registered with the plugin.

**Fix:** Upgrade to 1.5.3 or newer. In extract mode the loader now opts out of caching.

## Two icons show the same gradient, clip path, or class styling

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

Loaders run from the last entry to the first, so SVGO processes the raw SVG and the sprite loader receives the result.

## An icon is scaled differently after upgrading from 1.5.2 or older

Older versions lowercased attribute names on the root `<svg>`, which turned `preserveAspectRatio` into an attribute browsers ignore. The attribute is now kept as written. If you preferred the old rendering, remove `preserveAspectRatio` from the source SVG.

## Known limitations

- An SVG with no `viewBox` and no numeric `width` and `height` gets `viewBox="0 0 24 24"`. Add a `viewBox` to the source file if that is not its real size.
- `spriteFilename` is used literally. Placeholders such as `[hash]` or `[chunkname]` are not interpolated.
- The sprite URL is fixed at build time from the loader's `publicPath` option, or from `output.publicPath` when that is a plain string. `output.publicPath: 'auto'` and function values are not read, so set the loader's `publicPath` in those setups.
- The Rsbuild plugin replaces Rsbuild's built-in SVG rule. `./icon.svg?url`, `?inline` and `?raw` therefore also return a sprite symbol, and SVGs outside the plugin's `include` / `exclude` scope are left without Rsbuild's default handling.
- In extract mode, Safari (WebKit) does not resolve `url(#id)` references inside an external sprite file. An icon that uses a gradient, pattern, filter, mask or clip-path paints blank there. Chrome and Firefox are not affected. Use inline mode for those icons, or flatten the effect to solid fills.
- An entity declared in an SVG's DOCTYPE (`<!ENTITY fill "red">`, used as `&fill;`) is not expanded. The build prints a warning that names the file and the entity. Replace the entity with its literal value in the file, or run SVGO, which expands entities.
- The icon id is the file name. `icon.id` is that name as written. In the markup (`icon.content` and the extracted sprite) the characters `&`, `<` and `"` are escaped, so `Q&A.svg` is written as `<symbol id="Q&amp;A">`. In `icon.url` the id is used raw, except that a `%` followed by two hex digits is written as `%25`. Control characters other than tab, newline and carriage return cannot be written in XML, so avoid them in file names.

## Still stuck?

Search or ask in [Discussions](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/discussions), or [report a bug](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/issues/new?template=bug_report.yml). A minimal reproduction helps: [fork the StackBlitz starter](https://stackblitz.com/github/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/starters/stackblitz).
