import { defineConfig } from '@rsbuild/core';
import { pluginSvgSprite } from 'rspack-plugin-svg-sprite/rsbuild';

export default defineConfig({
  source: { entry: { index: './src/app.js' } },
  html: { template: './src/index.html' },
  plugins: [pluginSvgSprite({ extract: true, symbolId: '[name]', spriteFilename: 'sprite.svg' })],
});
