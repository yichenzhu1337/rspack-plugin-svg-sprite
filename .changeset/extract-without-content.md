---
'rspack-plugin-svg-sprite': minor
---

New loader option `content` (default `true`). In extract mode, `content: false` leaves the `<symbol>` markup out of every generated module, so large icon sets are no longer shipped twice (once in the JS bundle and once in the sprite file). `icon.id`, `icon.viewBox` and `icon.url` are unchanged, `icon.content` is `''`, and the sprite file is identical. The option has no effect in inline mode, which needs the markup. Also accepted by the Rsbuild plugin. The default output is unchanged.
