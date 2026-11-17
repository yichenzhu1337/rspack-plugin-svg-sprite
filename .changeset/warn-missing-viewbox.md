---
'rspack-plugin-svg-sprite': patch
---

An icon whose root `<svg>` has no `viewBox` and no numeric `width` and `height` silently got `viewBox="0 0 24 24"`, which crops or mis-scales icons of any other size. The build now prints a warning that names the file and the fallback it used, and says to add a `viewBox` (or `width` and `height`) to the root `<svg>`. The generated output is unchanged.
