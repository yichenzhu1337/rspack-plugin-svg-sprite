'use strict';

var NAMESPACE = 'rspack-plugin-svg-sprite';

var defaultConfig = {
  plainSprite: false,
  spriteAttrs: {},
};

function merge(target, source) {
  var result = {};
  Object.keys(target).forEach(function (key) { result[key] = target[key]; });
  Object.keys(source).forEach(function (key) {
    if (source[key] !== undefined) result[key] = source[key];
  });
  return result;
}

class SvgSpritePlugin {
  constructor(cfg) {
    this.config = merge(defaultConfig, cfg || {});
    this.symbols = [];
  }

  get NAMESPACE() {
    return NAMESPACE;
  }

  addSymbol(symbolData) {
    var existing = this.symbols.findIndex(function (s) { return s.id === symbolData.id; });
    if (existing >= 0) {
      this.symbols[existing] = symbolData;
    } else {
      this.symbols.push(symbolData);
    }
  }

  generateSprite(symbols) {
    var config = this.config;
    var attrs = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

    if (config.spriteAttrs) {
      Object.keys(config.spriteAttrs).forEach(function (key) {
        attrs += ' ' + key + '="' + config.spriteAttrs[key] + '"';
      });
    }

    var styles = '<style>\n' +
      '    .sprite-symbol-usage {display: none;}\n' +
      '    .sprite-symbol-usage:target {display: inline;}\n' +
      '  </style>';

    var symbolsContent = symbols.map(function (s) { return s.content; }).join('\n');

    var usages = symbols.map(function (s) {
      return '<use id="' + s.id + '-usage" xlink:href="#' + s.id +
        '" width="100%" height="100%" class="sprite-symbol-usage" />';
    }).join('\n');

    return '<svg ' + attrs + '>\n<defs>\n' + styles + '\n' + symbolsContent + '\n</defs>\n' + usages + '\n</svg>';
  }

  apply(compiler) {
    var plugin = this;

    compiler.hooks.thisCompilation.tap(NAMESPACE, function (compilation) {
      compilation[NAMESPACE] = plugin;

      compilation.hooks.processAssets.tap(
        {
          name: NAMESPACE,
          stage: compiler.rspack
            ? compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
            : 0,
        },
        function () {
          if (plugin.symbols.length === 0) return;

          var symbolsByFile = {};
          plugin.symbols.forEach(function (sym) {
            var filename = sym.spriteFilename || 'sprite.svg';
            if (!symbolsByFile[filename]) symbolsByFile[filename] = [];
            symbolsByFile[filename].push(sym);
          });

          Object.keys(symbolsByFile).forEach(function (filename) {
            var content = plugin.generateSprite(symbolsByFile[filename]);

            var RawSource;
            if (compiler.rspack && compiler.rspack.sources) {
              RawSource = compiler.rspack.sources.RawSource;
            } else {
              try {
                RawSource = require('webpack-sources').RawSource;
              } catch (e) {
                RawSource = function (str) {
                  this._value = str;
                  this.source = function () { return str; };
                  this.size = function () { return str.length; };
                  this.buffer = function () { return Buffer.from(str); };
                  this.map = function () { return null; };
                  this.sourceAndMap = function () { return { source: str, map: null }; };
                };
              }
            }

            compilation.emitAsset(filename, new RawSource(content));
          });
        }
      );
    });

    compiler.hooks.afterCompile.tap(NAMESPACE, function () {
      plugin.symbols = [];
    });
  }
}

module.exports = SvgSpritePlugin;
