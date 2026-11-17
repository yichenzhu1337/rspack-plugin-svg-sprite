---
description: 'The public guarantees of the package, each mapped to the test that enforces it.'
---

# Guarantees

Every public guarantee of the package is mapped to the test that enforces it. The full table is [`.github/GUARANTEES.md`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/blob/main/.github/GUARANTEES.md); a test fails when a file or test name in it no longer exists.

In short:

- **Export shape.** `import icon from './icon.svg'` gives `{ id, viewBox, url, content }`, with `url` being `#id` inline and `/path/sprite.svg#id` in extract mode.
- **Option defaults.** `symbolId` is `[name]`, `esModule` is `true`, `extract` is `false`, `spriteFilename` is `sprite.svg`, `publicPath` is `''`, `plainSprite` is `false`, `spriteAttrs` is `{}`.
- **Stable loader output.** The generated module is byte-identical to the published 1.5.1 loader for every icon in the repository.
- **Deterministic sprites.** Symbols and usages are sorted by id, whatever order the loaders finished in.
- **Caching.** Inline mode stays cacheable. Extract mode opts out so every icon is registered on each build, and the sprite stays complete in watch mode and after a persistent cache restart.
- **Helpful failures.** Build warnings for an asset rule that captures SVGs, for the plugin with no symbols, for extract mode without the plugin and for duplicate ids within one sprite file. An empty or non-SVG file fails the build with a message that names the file.
- **Robust input.** CRLF, a BOM, a DOCTYPE, comments, odd file names, nested `<svg>`, `<defs>`, `<style>` and CDATA give a valid symbol, and pathological input is handled in linear time.
- **Accessibility.** The hidden inline sprite is `aria-hidden`, and the documented icon patterns pass axe in every consumer app.
- **Real builds and browsers.** Tested with real Rspack 1 and 2, webpack 5 and Rsbuild 1 and 2 builds, and with consumer apps in real browsers installed from a registry with npm, pnpm and Bun.
