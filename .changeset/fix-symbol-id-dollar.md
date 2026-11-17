---
'rspack-plugin-svg-sprite': patch
---

File and folder names containing `$` sequences such as `$$`, `$&`, `` $` `` or `$'` were altered when inserted into the symbol id through `[name]`, `[folder]` and `[ext]` (for example `price$$.svg` gave `icon-price$`). The names are now inserted exactly as written.
