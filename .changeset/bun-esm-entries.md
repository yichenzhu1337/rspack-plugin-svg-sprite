---
'rspack-plugin-svg-sprite': patch
---

Fix ESM imports of `rspack-plugin-svg-sprite/loader`, `/runtime/symbol` and `/runtime/browser-sprite` on the Bun runtime. In 1.6.0 these imports threw `TypeError: Object.assign requires that input parameter not be null or undefined` when the code ran under Bun (for example `bun --bun rspack build` or a Bun script that imports the loader). Node and bundled app output are unchanged: the ESM entry points now give the same default export and named exports on Node, on Bun and inside Rspack and webpack bundles, and still share the single CommonJS implementation.

This release also contains the fixes listed under 1.6.1 (escaped symbol ids, linear-time parsing of malformed files, the DOCTYPE entity warning), because 1.6.1 was never published to npm.
