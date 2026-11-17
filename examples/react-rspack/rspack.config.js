const fs = require('fs');
const path = require('path');
const { CopyRspackPlugin, HtmlRspackPlugin } = require('@rspack/core');
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

// The chapters of the intro video (video/chapters.json) become the text list under the player.
const chapters = require('./video/chapters.json');
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const videoChapters = chapters
  .map(({ t, title, caption, summary }) => {
    const time = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const text = escapeHtml(summary || caption).replace(/`([^`]+)`/g, '<code>$1</code>');
    return `<li><span class="ts" data-t="${t}">${time}</span> <strong>${escapeHtml(title)}.</strong> ${text}</li>`;
  })
  .join('\n            ');

const isDev = process.env.NODE_ENV === 'development';

// country-flag-icons does not export its SVG files, so the alias
// points at the folder. realpath: Rspack resolves symlinks (Bun
// installs packages behind them) and `include` matches that path.
const flagsDir = fs.realpathSync(
  path.join(path.dirname(require.resolve('country-flag-icons/package.json')), '3x2'),
);
const sprite = { extract: true, spriteFilename: 'sprite.svg', esModule: false };

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash:8].js',
    publicPath: process.env.PUBLIC_PATH || '/',
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
        include: flagsDir,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { ...sprite, symbolId: 'flag-[name]' },
      },
      {
        test: /\.svg$/,
        exclude: flagsDir,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: { ...sprite, symbolId: 'icon-[name]' },
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
      templateParameters: { videoChapters },
      title: 'rspack-plugin-svg-sprite: every flag, one SVG sprite',
    }),
    new SvgSpritePlugin(),
    new CopyRspackPlugin({ patterns: [{ from: 'public' }] }),
    isDev && new ReactRefreshPlugin(),
  ].filter(Boolean),
  experiments: {
    css: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: { '@flags': flagsDir },
  },
  devServer: {
    port: 3000,
    hot: true,
    open: true,
  },
};
