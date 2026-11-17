---
'rspack-plugin-svg-sprite': minor
---

Extract mode now works with `output.publicPath: 'auto'` (the Rspack and webpack 5 default for web targets) and with a function `output.publicPath`. The sprite URL is resolved in the browser from the bundler's public path, so `icon.url` points at the sprite next to your bundle without setting the loader's `publicPath`. A string `output.publicPath` or the loader's `publicPath` option behaves as before, and the generated module for those is unchanged.
