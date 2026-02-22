const path = require('path');
const { HtmlRspackPlugin } = require('@rspack/core');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'ecmascript', jsx: true },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
      },
      {
        test: /\.svg$/,
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          extract: true,
          symbolId: 'icon-[name]',
          spriteFilename: 'sprite.svg',
          esModule: false,
        },
      },
      {
        test: /\.css$/,
        type: 'css',
      },
    ],
  },
  plugins: [
    new HtmlRspackPlugin({
      template: './src/index.html',
      title: 'SVG Sprite Demo — React',
    }),
    new SvgSpritePlugin(),
    isDev && new ReactRefreshPlugin(),
  ].filter(Boolean),
  experiments: {
    css: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devServer: {
    port: 3000,
    hot: true,
    open: true,
  },
};
