# Frameworks

## React

Works with any React setup on Rspack, Rsbuild or webpack 5. Use the rule from [Getting started](/getting-started) and render icons with `<use>`:

```jsx
import icon from './icon.svg';

export function Icon() {
  return (
    <svg viewBox={icon.viewBox} aria-hidden="true" focusable="false">
      <use href={icon.url} />
    </svg>
  );
}
```

The repository has a React + Rspack demo ([`examples/react-rspack`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/examples/react-rspack)) and a React + webpack 5 demo ([`examples/react-webpack`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/examples/react-webpack)).

## Vue + Rspack

```js
// rspack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { symbolId: '[name]' },
      },
    ],
  },
};
```

```vue
<template>
  <svg :viewBox="icon.viewBox">
    <use :href="icon.url" />
  </svg>
</template>

<script setup>
import icon from './icon.svg';
</script>
```

A Vue 3 + extract mode demo is in [`examples/vue-rspack-extract`](https://github.com/yichenzhu1337/rspack-plugin-svg-sprite/tree/main/examples/vue-rspack-extract).

## Next.js (with next-rspack)

```js
// next.config.js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  webpack(config) {
    // Remove Next.js default SVG handling
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.('.svg'));
    if (fileLoaderRule) fileLoaderRule.exclude = /\.svg$/;

    config.module.rules.push({
      test: /\.svg$/,
      type: 'javascript/auto',
      loader: 'rspack-plugin-svg-sprite/loader',
      options: { symbolId: 'icon-[name]', extract: true },
    });

    config.plugins.push(new SvgSpritePlugin({ plainSprite: true }));
    return config;
  },
};
```

## Rsbuild

See [Getting started](/getting-started#rsbuild). The Rsbuild plugin replaces Rsbuild's built-in SVG rule, see the [FAQ](/faq#known-limitations).
