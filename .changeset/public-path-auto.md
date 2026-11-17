---
'rspack-plugin-svg-sprite': minor
---

Extract mode now works with `output.publicPath: 'auto'` (the Rspack and webpack 5 default for web targets) and with a function `output.publicPath`. The sprite URL is resolved in the browser from the bundler's public path, so `icon.url` points at the sprite next to your bundle without setting the loader's `publicPath`. A string `output.publicPath` or the loader's `publicPath` option behaves as before, and the generated module for those is unchanged.

Behaviour change for builds that leave `output.publicPath` unset on a web target: `icon.url` used to be `sprite.svg#id`, resolved against the page URL (so it broke on nested routes such as `/settings/profile`). It is now resolved from the bundle's location, like every other asset. To keep a fixed URL, set the loader's `publicPath` option.
