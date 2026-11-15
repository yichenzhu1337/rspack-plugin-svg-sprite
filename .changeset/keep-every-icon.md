---
'rspack-plugin-svg-sprite': patch
---

Fix icons disappearing from the extracted sprite, and parse the root `<svg>` tag correctly.

- **Extract mode no longer loses icons in watch mode or after a cached restart.** Before, editing one icon removed every other icon from `sprite.svg`, editing a JS file emitted no sprite at all, and a second build with a persistent cache (webpack `cache.type: 'filesystem'`, Rspack `experiments.cache` or `cache.type: 'persistent'`) emitted no sprite. Extract-mode modules now always re-run so every icon reaches the sprite. Inline mode is unchanged. Large icon sets rebuild slightly slower in development (about 0.1 ms per icon).
- **The root `<svg>` tag is read as XML.** Attributes that 1.5.2 mangled now come through intact: `preserveAspectRatio` keeps its case (browsers ignored the lowercased name, so icons with it may now scale as the attribute says; remove the attribute to get the old look), values containing `'`, `"` or `>` are kept whole, `viewBox = "…"` with spaces is recognised, and an `<svg` inside a leading comment is skipped. Tags the new parser cannot read fall back to the previous behavior.
- **A warning when an asset rule captures your SVG.** If another rule turns the file into an `asset` module, the build now warns with the file name and the fix (`type: 'javascript/auto'`). The build result is unchanged.
- **Stable sprite order.** Symbols in each extracted sprite are sorted by id, so identical builds produce identical files.

Output for every icon that 1.5.2 already handled correctly is byte-for-byte unchanged.
