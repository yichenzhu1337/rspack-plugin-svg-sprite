const { HtmlRspackPlugin } = require('@rspack/core');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.svg$/,
        // Required: keeps the built-in asset handling away from the .svg files.
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { symbolId: 'icon-[name]' },
      },
    ],
  },
  plugins: [new HtmlRspackPlugin({ template: './index.html' })],
};
