---
'rspack-plugin-svg-sprite': patch
---

Fix webpack 5 builds that failed with "A Source-like object with a 'map' method must also provide an 'updateHash' method" when the output filename has a content hash or the persistent cache is on and `webpack-sources` cannot be resolved from this package (pnpm, Yarn PnP, Bun). The sprite now uses webpack's own `RawSource`.
