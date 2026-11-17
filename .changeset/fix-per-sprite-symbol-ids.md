---
'rspack-plugin-svg-sprite': patch
---

Two icons with the same symbol id in different sprite files (for example `a/home.svg` going to `a.svg` and `b/home.svg` going to `b.svg`) were treated as duplicates: a warning was printed, one sprite got the wrong drawing and the other was never emitted. Ids now only need to be unique within one sprite file.
