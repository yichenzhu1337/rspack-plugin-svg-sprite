require('./styles.css');

// ============================================================
// Step 1: Import each SVG icon.
//
// A typical BaseIcon component does this dynamically on mount:
//   import(/* webpackMode: "eager" */ `~/images/icons/${this.icon}.svg`);
//
// That triggers svg-sprite-loader to add the SVG to the extracted
// sprite sheet (sprite.svg). Here we do it statically.
// ============================================================
var approvedIcon = require('./images/icons/approved.svg');
var closeIcon    = require('./images/icons/close.svg');
var commentIcon  = require('./images/icons/comment.svg');
var deleteIcon   = require('./images/icons/delete.svg');
var filterIcon   = require('./images/icons/filter.svg');
var helpIcon     = require('./images/icons/help.svg');
var saveIcon     = require('./images/icons/save.svg');
var userIcon     = require('./images/icons/user.svg');

// ============================================================
// Step 2: BaseIcon — a simple icon component pattern
//
// A typical BaseIcon component renders:
//   <use :xlink:href="`/dist/sprite.svg#${this.icon}`" />
//
// With svg-sprite-loader in extract mode, each require() returns
// a SpriteSymbol with .url pointing to "sprite.svg#icon-id".
// ============================================================
function BaseIcon(iconSymbol, opts) {
  opts = opts || {};
  var size = opts.size || 16;
  var cls = opts.className || '';
  var sym = iconSymbol.default || iconSymbol;
  var viewBox = sym.viewBox || '0 0 16 16';

  return '<svg class="icon ' + cls + '" width="' + size + '" height="' + size + '"' +
    ' viewBox="' + viewBox + '">' +
    '<use xlink:href="' + sym.url + '" />' +
    '</svg>';
}

var allIcons = [
  { symbol: approvedIcon, name: 'approved' },
  { symbol: closeIcon,    name: 'close' },
  { symbol: commentIcon,  name: 'comment' },
  { symbol: deleteIcon,   name: 'delete' },
  { symbol: filterIcon,   name: 'filter' },
  { symbol: helpIcon,     name: 'help' },
  { symbol: saveIcon,     name: 'save' },
  { symbol: userIcon,     name: 'user' },
];

var app = document.getElementById('app');
app.className = 'app';

app.innerHTML = [

  // Header
  '<header>',
  '  <h1>svg-sprite-loader <span class="badge badge-old">old webpack pattern</span></h1>',
  '  <p>Demonstrating the old webpack + svg-sprite-loader extract mode pattern</p>',
  '</header>',

  // Icon Gallery
  '<div class="section">',
  '  <h2>Icon Gallery</h2>',
  '  <div class="icon-grid">',
  allIcons.map(function (item) {
    return '<div class="icon-card">' +
      BaseIcon(item.symbol, { size: 32 }) +
      '<span>' + item.name + '</span>' +
      '</div>';
  }).join(''),
  '  </div>',
  '</div>',

  // BaseIcon Pattern Demo
  '<div class="section">',
  '  <h2>BaseIcon Component Pattern</h2>',
  '  <div class="base-icon-demo">',
  '    <h3>How a typical BaseIcon component uses these icons:</h3>',
  '    <div class="icon-row">',
  allIcons.map(function (item) {
    return '<div class="icon-example">' +
      BaseIcon(item.symbol) +
      '<span>' + item.name + '</span>' +
      '</div>';
  }).join(''),
  '    </div>',
  '    <div class="info-box">',
  '      <strong>BaseIcon.vue</strong> receives an icon name as a prop (e.g. <code>"approved"</code>). ',
  '      On mount, it eagerly imports the SVG file:<br><br>',
  '      <code>import(/* webpackMode: "eager" */ `~/images/icons/${this.icon}.svg`)</code><br><br>',
  '      This triggers <strong>svg-sprite-loader</strong> to add it to the sprite sheet. ',
  '      Then it renders <code>&lt;use xlink:href="/Scripts/dist/sprite.svg#approved" /&gt;</code> ',
  '      to reference the symbol from the extracted <code>sprite.svg</code> file.',
  '    </div>',
  '  </div>',
  '</div>',

  // How It Works
  '<div class="section">',
  '  <h2>How the Old Pattern Works</h2>',
  '  <div class="flow-diagram">',
  '    <div class="flow-step">',
  '      <div class="step-label">Source</div>',
  '      <div class="step-title">SVG Files</div>',
  '      <div class="step-detail">images/icons/*.svg</div>',
  '    </div>',
  '    <div class="flow-arrow">&rarr;</div>',
  '    <div class="flow-step">',
  '      <div class="step-label">Webpack</div>',
  '      <div class="step-title">svg-sprite-loader</div>',
  '      <div class="step-detail">extract: true + SpriteLoaderPlugin</div>',
  '    </div>',
  '    <div class="flow-arrow">&rarr;</div>',
  '    <div class="flow-step">',
  '      <div class="step-label">Output</div>',
  '      <div class="step-title">dist/sprite.svg</div>',
  '      <div class="step-detail">&lt;use xlink:href="sprite.svg#id" /&gt;</div>',
  '    </div>',
  '  </div>',
  '</div>',

  // Webpack Config
  '<div class="section">',
  '  <h2>webpack.config.js (key parts)</h2>',
  '  <div class="code-block">',
  '    <span class="cmt">// svg-sprite-loader in extract mode</span><br>',
  '    {<br>',
  '    &nbsp;&nbsp;<span class="fn">test</span>: <span class="str">/\\.svg$/</span>,<br>',
  '    &nbsp;&nbsp;<span class="fn">include</span>: [path.<span class="fn">resolve</span>(__dirname, <span class="str">\'src/images/icons\'</span>)],<br>',
  '    &nbsp;&nbsp;<span class="fn">use</span>: [<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;{<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">loader</span>: <span class="str">\'svg-sprite-loader\'</span>,<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">options</span>: {<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">extract</span>: <span class="kw">true</span>,<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">spriteFilename</span>: (svgPath) =&gt; `sprite${svgPath.<span class="fn">substr</span>(-4)}`<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;}<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;},<br>',
  '    &nbsp;&nbsp;&nbsp;&nbsp;{ <span class="fn">loader</span>: <span class="str">\'svgo-loader\'</span> }<br>',
  '    &nbsp;&nbsp;]<br>',
  '    }<br>',
  '    <br>',
  '    <span class="cmt">// In common.webpack.js:</span><br>',
  '    <span class="kw">const</span> SpriteLoaderPlugin = <span class="fn">require</span>(<span class="str">\'svg-sprite-loader/plugin\'</span>);<br>',
  '    plugins: [ <span class="kw">new</span> <span class="fn">SpriteLoaderPlugin</span>() ]',
  '  </div>',
  '</div>',

  // Symbol metadata
  '<div class="section">',
  '  <h2>Exported Symbol Data</h2>',
  '  <div class="code-block">',
  allIcons.map(function (item) {
    var s = item.symbol.default || item.symbol;
    return '<span class="cmt">// ' + item.name + '</span><br>' +
      '{ <span class="fn">id</span>: <span class="str">"' + (s.id || item.name) + '"</span>, ' +
      '<span class="fn">viewBox</span>: <span class="str">"' + (s.viewBox || '') + '"</span>, ' +
      '<span class="fn">url</span>: <span class="str">"' + s.url + '"</span> }';
  }).join('<br>'),
  '  </div>',
  '</div>',

].join('\n');

// Log all symbol data for inspection
console.log('--- svg-sprite-loader Symbols (old pattern) ---');
allIcons.forEach(function (item) {
  console.log(item.name + ':', item.symbol);
});
