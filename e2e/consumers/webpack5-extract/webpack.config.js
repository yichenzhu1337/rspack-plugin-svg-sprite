const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

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
  plugins: [new HtmlWebpackPlugin({ template: './src/index.html' }), new SvgSpritePlugin()],
};
