const path = require('path');
const { HtmlRspackPlugin, DefinePlugin } = require('@rspack/core');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');
const { VueLoaderPlugin } = require('vue-loader');

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  mode: 'production',
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: { experimentalInlineMatchResource: true },
      },
      {
        test: /\.svg$/,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { extract: true, symbolId: '[name]', spriteFilename: 'sprite.svg' },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlRspackPlugin({ template: './src/index.html' }),
    new SvgSpritePlugin({ plainSprite: true }),
    new DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
  ],
  resolve: { extensions: ['.js', '.vue'] },
};
