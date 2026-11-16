---
'rspack-plugin-svg-sprite': patch
---

Fix the ESM type declarations (`*.d.mts`) failing to parse on TypeScript 5.0 to 5.2 (`moduleResolution` node16, nodenext or bundler), a regression in 1.6.0.
