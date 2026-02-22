const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      // svg-sprite-loader in extract mode
      {
        test: /\.svg$/,
        include: [path.resolve(__dirname, 'src/images/icons')],
        use: [
          {
            loader: 'svg-sprite-loader',
            options: {
              extract: true,
              spriteFilename: (svgPath) => `sprite${svgPath.substr(-4)}`,
            },
          },
          {
            loader: 'svgo-loader',
            options: {
              plugins: [{ name: 'removeTitle' }],
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      title: 'SVG Sprite Demo (Old Pattern)',
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.[contenthash:8].css',
    }),
    // SpriteLoaderPlugin collects all extracted symbols and emits sprite.svg
    new SpriteLoaderPlugin(),
  ],
  devServer: {
    port: 4001,
    hot: true,
    open: true,
  },
};
