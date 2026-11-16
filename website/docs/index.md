---
pageType: home
hero:
  name: rspack-plugin-svg-sprite
  text: SVG sprites for Rspack, Rsbuild and webpack 5
  tagline: A drop-in replacement for svg-sprite-loader. Inline or extracted sprites, the same export shape, zero runtime dependencies.
  actions:
    - theme: brand
      text: Getting started
      link: /getting-started
    - theme: alt
      text: Live demo
      link: https://yichenzhu1337.github.io/rspack-plugin-svg-sprite/
    - theme: alt
      text: Open in StackBlitz
      link: https://stackblitz.com/github/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/starters/stackblitz
features:
  - title: Inline mode
    details: Symbols are injected into a hidden svg element at runtime. No plugin needed.
    link: /modes
  - title: Extract mode
    details: Symbols are emitted as one external .svg sprite file at build time.
    link: /modes
  - title: Drop-in replacement
    details: Same options, same exported symbol shape (id, viewBox, url, content).
    link: /migrating
  - title: Rspack, Rsbuild, webpack 5
    details: One loader and plugin, with a one-line Rsbuild plugin.
    link: /getting-started
---
