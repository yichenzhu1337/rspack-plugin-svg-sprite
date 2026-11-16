---
'rspack-plugin-svg-sprite': patch
---

Fixes three problems with unusual input. Icons that do not hit them produce byte-identical output.

- An icon file whose name contains `&`, `<` or `"` (for example `Q&A.svg`) wrote its name into the symbol markup without escaping it. In extract mode the sprite stopped being valid XML, so the browser refused the whole sprite and every icon in it vanished. The name is now escaped in the `<symbol>` and in the sprite's `<use>` elements. `icon.id` is still the plain file name, `icon.url` still works in an `href`, and `icon.content` holds the escaped markup. A `%` followed by two hex digits in an id is written as `%25` in the URL fragment. Values from the `spriteAttrs` plugin option are escaped too.
- A malformed SVG file made of many unterminated `<svg` or `<!--` openers (about 100 KB) could freeze the build for seconds or minutes, because the parser rescanned the file from each opener. Parsing is now linear. Well-formed files are not affected.
- An SVG whose DOCTYPE declares an entity that the icon uses (`<!ENTITY fill "red">` and `&fill;`) now produces a build warning that names the file and the entity. The entity is still not expanded, so the sprite keeps an undeclared reference. Replace it with its literal value or run SVGO.

Only projects with those characters in icon file names, or with malformed or DOCTYPE-entity files, are affected.
