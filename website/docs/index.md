---
title: 'SVG sprites for Rspack, Rsbuild and webpack 5'
description: 'rspack-plugin-svg-sprite turns the SVG files you import into one SVG sprite, for Rspack, Rsbuild and webpack 5. A drop-in replacement for svg-sprite-loader.'
---

# Introduction

`rspack-plugin-svg-sprite` turns the `.svg` files you import into one SVG sprite. Each file becomes a `<symbol>`, and you draw it anywhere with `<use>`. It works with Rspack, Rsbuild and webpack 5, and is a drop-in replacement for [svg-sprite-loader](https://github.com/JetBrains/svg-sprite-loader), which does not run on Rspack.

```jsx
import home from './icons/home.svg';
// home -> { id: 'home', viewBox: '0 0 24 24', url: '#home', content: '<symbol …>' }

<svg viewBox={home.viewBox} aria-hidden="true">
  <use href={home.url} />
</svg>;
```

## How it works

1. **Import.** The loader reads each SVG, wraps its content in a `<symbol id="…">` and gives your code `{ id, viewBox, url, content }`.
2. **Build.** In **inline mode** (the default) the symbols are added to a hidden `<svg>` in the page at runtime. In **extract mode** the plugin writes them all into one file, such as `sprite.svg`.
3. **Use.** `<use href={icon.url}>` draws the symbol. Every icon comes from the same sprite, so the markup is not repeated and, in extract mode, all icons arrive in one request.

The [live demo](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/) builds 265 flag files into one `sprite.svg`; you can [look inside that file](https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/sprite.html).

## When to use it

- You have many icons and want them in one sprite, styled with CSS (`fill: currentColor`).
- You are moving a webpack project with `svg-sprite-loader` to Rspack or Rsbuild.
- You want icons cached as one file (extract mode) or with no extra request at all (inline mode).

If you want each SVG as a React component with props instead, use SVGR. See [Alternatives](/migrating#alternatives).

## Next steps

- [Installation](/getting-started): install and add the rule for Rspack, webpack 5 or Rsbuild.
- [Inline vs extract](/modes): choose where the symbols go.
- [Migrating](/migrating): switch from `svg-sprite-loader` in two lines.
- [Options](/options): every option with its default.
