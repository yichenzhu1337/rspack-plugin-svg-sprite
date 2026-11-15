---
'rspack-plugin-svg-sprite': patch
---

Faster extract-mode builds with many icons. Registering an icon with the plugin used to scan every icon registered so far, which took over half the plugin's time at 3,000 icons. It is now a constant-time lookup. Output is unchanged.
