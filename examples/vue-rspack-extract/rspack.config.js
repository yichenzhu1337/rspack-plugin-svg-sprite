const path = require('path');
const { HtmlRspackPlugin, DefinePlugin } = require('@rspack/core');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');
const { VueLoaderPlugin } = require('vue-loader');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash:8].js',
    publicPath: '/',
    clean: true,
  },
  experiments: {
    css: true,
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          experimentalInlineMatchResource: true,
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'ecmascript' },
            },
          },
        },
      },
      {
        test: /\.svg$/,
        include: [path.resolve(__dirname, 'src/icons')],
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          extract: true,
          symbolId: '[name]',
          spriteFilename: 'sprite.svg',
        },
      },
      {
        test: /\.css$/,
        type: 'css',
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlRspackPlugin({
      template: './src/index.html',
      title: 'SVG Sprite Demo — Vue Extract Mode',
    }),
    new SvgSpritePlugin({ plainSprite: true }),
    new DefinePlugin({
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    }),
  ],
  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  devServer: {
    port: 3002,
    hot: true,
  },
};
