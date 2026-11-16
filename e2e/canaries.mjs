// Real open-source projects that build their icons with `svg-sprite-loader`. The canary script
// (scripts/canary.mjs) builds each one as-is, swaps in this checkout's packed tarball with the
// small patch listed here, rebuilds, and compares the sprite symbols of the two builds.
//
// Every project is pinned to a commit SHA, so a canary only changes when we change it here.
//
//   name          short id (used by the workflow matrix and `--project`)
//   repo          GitHub `owner/name`
//   sha           the pinned commit
//   license       SPDX id of the project's license
//   note          what the project exercises
//   install       command that installs the project's own dependencies
//   swapInstall   install command after the swap (default: `npm install`)
//   build         command that builds it (output goes to `outDir`)
//   outDir        build output directory, relative to the project root
//   patches       the whole swap: exact `from` -> `to` replacements in the project's own files.
//                 Each `from` must occur exactly once, so a changed upstream fails loudly instead
//                 of being half patched. The `svg-sprite-loader` dependency itself is swapped in
//                 package.json by the script and is not listed here.
//   expectedDiff  a reason string when a real difference is known and accepted. The canary still
//                 builds and reports the differences, but does not fail on them.
export const canaries = [
  {
    name: 'hotaru-theme',
    repo: 'cokemine/hotaru_theme',
    sha: 'a4f46a4cd4159abf2c05ec166a1e6622469352d8',
    license: 'MIT',
    note: 'Vue 3 on Vue CLI 5 (webpack 5), inline mode, rule added through chainWebpack',
    install: ['npm', 'ci', '--no-audit', '--no-fund'],
    build: ['npm', 'run', 'build'],
    outDir: 'dist',
    patches: [
      {
        file: 'vue.config.js',
        from: ".loader('svg-sprite-loader')",
        to: ".loader('rspack-plugin-svg-sprite/loader')",
      },
    ],
  },
  {
    name: 'static-html-boilerplate',
    repo: 'PrototypeInteractive/static-html-boilerplate',
    sha: '72f0e9d686e28e95fdebca02f77082b32d77c91b',
    license: 'MIT',
    note: 'webpack 5 with an ESM config, extract mode, svgo-loader in front of the loader',
    install: ['npm', 'ci', '--no-audit', '--no-fund'],
    build: ['npm', 'run', 'build'],
    outDir: 'public',
    patches: [
      {
        file: 'webpack.config.js',
        from: "from 'svg-sprite-loader/plugin.js'",
        to: "from 'rspack-plugin-svg-sprite/plugin'",
      },
      {
        file: 'webpack.config.js',
        from: "loader: 'svg-sprite-loader'",
        to: "loader: 'rspack-plugin-svg-sprite/loader'",
      },
    ],
  },
  {
    name: 'rgaa-checker',
    repo: 'arneoio/rgaa-checker',
    sha: '09bb7d6283969d3b8c370843e53d76f109f5882d',
    license: 'Apache-2.0',
    note: 'webpack 5, extract mode, a symbolId function and svgo-loader',
    install: [
      'npx',
      '--yes',
      'yarn@1.22.22',
      'install',
      '--frozen-lockfile',
      '--ignore-engines',
      '--ignore-scripts',
    ],
    build: ['npx', 'webpack', '--mode=production', '--env', 'app=chrome'],
    outDir: 'dist',
    // The lockfile no longer matches package.json after the swap.
    swapInstall: [
      'npx',
      '--yes',
      'yarn@1.22.22',
      'install',
      '--ignore-engines',
      '--ignore-scripts',
    ],
    patches: [
      {
        file: 'webpack.config.js',
        // The documented migration: the CommonJS `/plugin` entry is not the class itself.
        from: "const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');",
        to: "const { SvgSpritePlugin: SpriteLoaderPlugin } = require('rspack-plugin-svg-sprite');",
      },
      {
        file: 'webpack.config.js',
        from: "loader: 'svg-sprite-loader'",
        to: "loader: 'rspack-plugin-svg-sprite/loader'",
      },
    ],
  },
];
