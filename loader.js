'use strict';

var path = require('path');

var NAMESPACE = 'rspack-plugin-svg-sprite';

function parseViewBox(svgContent) {
  var match = svgContent.match(/viewBox=["']([^"']+)["']/);
  return match ? match[1] : '0 0 24 24';
}

function extractSvgInner(svgContent) {
  var innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return innerMatch ? innerMatch[1].trim() : svgContent;
}

function extractSvgAttrs(svgContent) {
  var attrs = {};
  var svgTagMatch = svgContent.match(/<svg([^>]*)>/i);
  if (!svgTagMatch) return attrs;

  var attrString = svgTagMatch[1];
  var attrRegex = /(\w[\w-]*)=["']([^"']*?)["']/g;
  var match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    var name = match[1].toLowerCase();
    if (name !== 'xmlns' && name !== 'version' && name !== 'class' && name !== 'style') {
      attrs[name] = match[2];
    }
  }
  return attrs;
}

function generateSymbolId(resourcePath, options) {
  if (typeof options.symbolId === 'function') {
    return options.symbolId(resourcePath);
  }

  var pattern = options.symbolId || '[name]';
  var basename = path.basename(resourcePath, path.extname(resourcePath));
  var dirname = path.dirname(resourcePath);
  var dirParts = dirname.split(path.sep);
  var dirBasename = dirParts[dirParts.length - 1] || '';

  return pattern
    .replace(/\[name\]/g, basename)
    .replace(/\[folder\]/g, dirBasename)
    .replace(/\[ext\]/g, path.extname(resourcePath).slice(1));
}

module.exports = function svgSpriteLoader(content) {
  if (this.cacheable) {
    this.cacheable();
  }

  if (!content.includes('<svg')) {
    throw new Error(
      'rspack-plugin-svg-sprite: Invalid SVG content in ' + this.resourcePath
    );
  }

  var options = this.getOptions ? this.getOptions() : {};
  var resourcePath = this.resourcePath;
  var symbolId = generateSymbolId(resourcePath, options);
  var viewBox = parseViewBox(content);
  var innerContent = extractSvgInner(content);
  var svgAttrs = extractSvgAttrs(content);
  var extract = options.extract || false;
  var esModule = options.esModule !== undefined ? options.esModule : true;

  var attrString = 'id="' + symbolId + '"';
  if (viewBox) {
    attrString += ' viewBox="' + viewBox + '"';
  }
  Object.keys(svgAttrs).forEach(function (key) {
    if (key !== 'viewbox' && key !== 'id' && key !== 'width' && key !== 'height') {
      attrString += ' ' + key + '="' + svgAttrs[key] + '"';
    }
  });

  var symbolContent = '<symbol ' + attrString + '>' + innerContent + '</symbol>';

  if (extract) {
    var spriteFilename = options.spriteFilename || 'sprite.svg';
    var publicPath = options.publicPath || '';

    var symbolData = {
      id: symbolId,
      viewBox: viewBox,
      content: symbolContent,
      resourcePath: resourcePath,
      spriteFilename: spriteFilename,
    };

    if (this._compilation && this._compilation[NAMESPACE]) {
      this._compilation[NAMESPACE].addSymbol(symbolData);
    }

    var url = publicPath + spriteFilename + '#' + symbolId;

    var runtime = 'var SpriteSymbol = require("' + require.resolve('./runtime/symbol').replace(/\\/g, '\\\\') + '");\n';
    runtime += 'var symbol = new SpriteSymbol(' + JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) + ');\n';
    runtime += 'symbol.url = ' + JSON.stringify(url) + ';\n';
    runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

    return runtime;
  }

  var runtime = '';
  runtime += 'var SpriteSymbol = require("' + require.resolve('./runtime/symbol').replace(/\\/g, '\\\\') + '");\n';
  runtime += 'var sprite = require("' + require.resolve('./runtime/browser-sprite').replace(/\\/g, '\\\\') + '");\n';
  runtime += 'var symbol = new SpriteSymbol(' + JSON.stringify({ id: symbolId, viewBox: viewBox, content: symbolContent }) + ');\n';
  runtime += 'sprite.add(symbol);\n';
  runtime += (esModule ? 'export default' : 'module.exports =') + ' symbol;\n';

  return runtime;
};

module.exports.NAMESPACE = NAMESPACE;
