const path = require('path');
const { HtmlRspackPlugin } = require('@rspack/core');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  mode: 'production',
  entry: './src/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
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
