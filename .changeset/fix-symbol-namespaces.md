---
'rspack-plugin-svg-sprite': patch
---

Icons exported from Inkscape, Sketch and similar tools use prefixes such as `inkscape:` and `sodipodi:` that their root `<svg>` declares. The extracted sprite lost those declarations, so browsers rejected the whole sprite and every icon in it rendered blank. The loader now copies the namespace declarations an icon actually uses onto its `<symbol>`.
