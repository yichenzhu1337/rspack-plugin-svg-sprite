# Migrating

## From svg-sprite-loader

Swap the loader path and the plugin import. Your component code stays the same.

```diff
// rspack.config.js
-const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');
+const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
+       type: 'javascript/auto',
-       loader: 'svg-sprite-loader',
+       loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          symbolId: 'icon-[name]',
+         // Add extract: true if you were using extract mode
        },
      },
    ],
  },
  plugins: [
-   new SpriteLoaderPlugin(),
+   new SvgSpritePlugin(), // Only needed for extract mode
  ],
};
```

:::tip
The exported symbol object has the identical shape (`id`, `viewBox`, `url`, `content`), so no component changes are needed.
:::

Three differences to check when you migrate:

- **Extract mode `url` target.** `svg-sprite-loader` exports `id: "arrow-usage"` and `url: "sprite.svg#arrow-usage"`, which point at a preview `<use>` element inside the sprite, so `<img src={icon.url}>` and CSS `background: url(...)` render the icon. This package exports `id: "arrow"` and `url: "sprite.svg#arrow"`, which point at the `<symbol>`. That works with `<svg><use href={icon.url} /></svg>` (the recommended usage in both libraries), but browsers do not render a bare symbol as an image. If you used `icon.url` in an `<img>` or in CSS, switch to `<svg><use href={icon.url} /></svg>`.
- **`class` on the root `<svg>` is not copied to the `<symbol>`.** The loader skips `xmlns`, `version`, `class` and `style` on the root element. `svg-sprite-loader` copies `class`. Put the class on the `<svg>` element where you use the icon.
- **Preview `<use>` elements in the sprite file use `href`, not `xlink:href`.** `href` in `<use>` needs Safari 12.1 or newer. This only matters when you open the sprite file directly.

`svg-sprite-loader` depends on internal webpack APIs (`NormalModule.getCompilationHooks`, `compilation.hooks.additionalAssets`) that do not exist in Rspack ([rspack#11609](https://github.com/web-infra-dev/rspack/issues/11609)). This package reimplements the same functionality with Rspack-compatible APIs.

## From asset/resource

If you handle SVGs with the built-in `asset/resource` type, replace it to get sprite support:

```diff
// rspack.config.js
+const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
-       type: 'asset/resource',
-       generator: {
-         filename: 'images/icons/[name].[contenthash][ext]',
-       },
+       type: 'javascript/auto',
+       loader: 'rspack-plugin-svg-sprite/loader',
+       options: {
+         extract: true,
+         symbolId: '[name]',
+         spriteFilename: 'sprite.svg',
+       },
      },
    ],
  },
+ plugins: [
+   new SvgSpritePlugin({ plainSprite: true }),
+ ],
};
```

- `type: 'javascript/auto'` is required. It overrides the previous `asset/resource` handling and lets the loader process SVGs as JavaScript modules.
- The sprite file is emitted to your output directory (for example `dist/sprite.svg`).
- If you generated sprites with a separate CLI tool (like `svg-sprite`) as a post-build step, you can remove it. The plugin does the work inside the build.

## Alternatives

| Feature               | rspack-plugin-svg-sprite | svg-sprite-loader           | @svgr/webpack    | @rsbuild/plugin-svgr | vite-plugin-svg-icons |
| --------------------- | ------------------------ | --------------------------- | ---------------- | -------------------- | --------------------- |
| **Rspack support**    | Native                   | No (uses webpack internals) | Via config       | Rsbuild only         | No (Vite only)        |
| **Approach**          | SVG sprites (`<use>`)    | SVG sprites (`<use>`)       | React components | React components     | SVG sprites           |
| **Inline mode**       | Yes                      | Yes                         | N/A              | N/A                  | Yes                   |
| **Extract mode**      | Yes                      | Yes                         | N/A              | N/A                  | No                    |
| **Webpack 5 support** | Yes                      | Yes                         | Yes              | No                   | No                    |
| **Runtime deps**      | Zero                     | 1                           | Several          | Several              | Several               |
| **Maintained**        | Yes                      | No (archived)               | Yes              | Yes                  | Yes                   |
| **Drop-in migration** | n/a                      | Yes (same API)              | Different API    | Different API        | Different API         |

Use SVG sprites when you want icons combined into one file with `<use href="#id">` references: good for large icon sets, full CSS control and caching. Use SVGR when you want each SVG as a React component with props for color and size.
