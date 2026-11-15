import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HtmlRspackPlugin } from '@rspack/core';
import { SvgSpritePlugin } from 'rspack-plugin-svg-sprite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  entry: './src/app.js',
  output: {
    path: path.resolve(dirname, 'dist'),
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { extract: true, symbolId: '[name]', spriteFilename: 'sprite.svg' },
      },
    ],
  },
  plugins: [new HtmlRspackPlugin({ template: './src/index.html' }), new SvgSpritePlugin()],
};
