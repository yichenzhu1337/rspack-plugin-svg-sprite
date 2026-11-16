// Type-only. The ESM wrappers (`*.mts`) read the exports through the `require` view of each
// CommonJS module (what `require()` returns). The usual way to ask for that view is
// `typeof import('./x.js', { with: { 'resolution-mode': 'require' } })`, but tsc copies that into
// the emitted `.d.mts`, and TypeScript before 5.3 cannot parse it. A default import of this
// file gives the same view: a `.cts` file is CommonJS, so `import x = require()` binds
// `module.exports`, under `node16` and `bundler` alike.
import type index = require('./index.js');
import type loader = require('./loader.js');
import type plugin = require('./plugin.js');
import type rsbuild = require('./rsbuild.js');
import type browserSprite = require('./runtime/browser-sprite.js');
import type symbol = require('./runtime/symbol.js');

export interface CjsView {
  index: typeof index;
  loader: typeof loader;
  plugin: typeof plugin;
  rsbuild: typeof rsbuild;
  browserSprite: typeof browserSprite;
  symbol: typeof symbol;
}
