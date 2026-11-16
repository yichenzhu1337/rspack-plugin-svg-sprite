#!/usr/bin/env node
// Consumer compatibility matrix for the published package.
//
//   node scripts/ci/compat-matrix.mjs <tarball|spec> [options]
//
// Installs the package into a fresh temporary project, together with the bundlers and
// TypeScript, and checks every public entry point the way consumers use it:
//
//   node     require(x), require(x).default, named requires, ESM default / namespace / named
//            imports, and the `.default` / property access that worked around CommonJS interop
//   types    `tsc --noEmit` consumers under moduleResolution node10, node16 (CommonJS and ESM
//            consumer files) and bundler
//   build    real Rspack 1, Rspack 2 and webpack 5 builds (inline and extract mode, CommonJS and
//            ESM config files) and Rsbuild 1 and 2 builds; the output bundle is executed against
//            a small DOM stand-in and the emitted sprite is inspected
//   bun      the node cells again under `bun --bun`, plus Rspack builds launched with Bun
//            (needs `bun` on PATH; skipped with a note otherwise)
//
// Options:
//   --baseline <file>   JSON written by an earlier run (`--json`). Every cell that passed there
//                       becomes required here, and the table shows the change per cell.
//   --strict            also require the cells marked as goals (fixed in 1.6.0)
//   --json <file>       write the results as JSON
//   --keep              keep the temporary project and print its path
//   --only <groups>     comma-separated subset of node,types,build,bun
//   --require-bun       fail instead of skipping the bun group when `bun` is not on PATH
//
// Exits 1 when a required cell fails.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const PKG = 'rspack-plugin-svg-sprite';

// Tool versions installed next to the package under test. Pinned so runs are comparable.
const TOOLS = {
  typescript: '5.9.3',
  '@types/node': '22.19.1',
  '@rspack/core': '1.7.6',
  'rspack-v2': 'npm:@rspack/core@2.3.2',
  webpack: '5.105.2',
  '@rsbuild/core': '1.7.3',
  'rsbuild-v2': 'npm:@rsbuild/core@2.3.2',
};

// ---------------------------------------------------------------------------------------------
// Arguments

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const target = argv.find(
  (a, i) => !a.startsWith('--') && !['--baseline', '--json', '--only'].includes(argv[i - 1]),
);
if (!target) {
  console.error('usage: compat-matrix.mjs <tarball|spec> [--baseline f] [--json f] [--strict]');
  process.exit(2);
}
const only = new Set((option('--only') || 'node,types,build,bun').split(','));
const baseline = option('--baseline')
  ? new Map(JSON.parse(readFileSync(option('--baseline'), 'utf8')).cells.map((c) => [c.id, c.pass]))
  : null;

// ---------------------------------------------------------------------------------------------
// Temporary consumer project

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'svg-sprite-compat-')));
const write = (rel, text) => {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  return abs;
};
write('package.json', '{ "name": "compat-consumer", "private": true }\n');
const spec = existsSync(target) ? resolve(target) : target;
console.log(`installing ${spec} into ${dir}`);
execFileSync(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    '--loglevel=error',
    '--no-package-lock',
    spec,
    ...Object.entries(TOOLS).map(([name, version]) => `${name}@${version}`),
  ],
  { cwd: dir, stdio: ['ignore', 'inherit', 'inherit'] },
);
const installed = JSON.parse(readFileSync(join(dir, 'node_modules', PKG, 'package.json'), 'utf8'));
console.log(`testing ${PKG}@${installed.version}\n`);

const cells = [];
function record(group, id, pass, detail, { required = false, goal = false } = {}) {
  cells.push({
    group,
    // The bun group repeats the node cells; the prefix keeps the ids (and the baseline) apart.
    id: group === 'bun' && !id.startsWith('bun: ') ? `bun: ${id}` : id,
    pass,
    detail: pass ? '' : String(detail || '').slice(0, 400),
    required,
    goal,
  });
}

// ---------------------------------------------------------------------------------------------
// Entry points and what consumers expect from them

const S = (sub) => (sub === '.' ? PKG : `${PKG}/${sub.slice(2)}`);

// `main` checks the thing an entry is about: what `require(x).default` or an ESM default import
// should give a consumer. `named` lists the named exports.
const ENTRIES = [
  {
    sub: '.',
    main: "typeof v === 'function' && typeof new v().apply === 'function'",
    named: ['SvgSpritePlugin'],
    cjsMain: true,
  },
  {
    sub: './plugin',
    main: "typeof v === 'function' && typeof new v().apply === 'function'",
    named: ['FallbackRawSource', 'resolveRawSource'],
  },
  {
    sub: './loader',
    main: "typeof v === 'function' && v.NAMESPACE === 'rspack-plugin-svg-sprite'",
    named: [
      'NAMESPACE',
      'parseRootTag',
      'parseViewBox',
      'extractSvgInner',
      'extractSvgAttrs',
      'generateSymbolId',
      'legacy',
    ],
  },
  { sub: './rsbuild', main: null, named: ['pluginSvgSprite', 'isSvgOnlyPattern'] },
  {
    sub: './runtime/symbol',
    main: "typeof v === 'function' && new v({ id: 'a', viewBox: '', content: '' }).url === '#a'",
    named: [],
  },
  {
    sub: './runtime/browser-sprite',
    main: "typeof v === 'object' && typeof v.add === 'function' && typeof v.mount === 'function'",
    named: [],
  },
];

// ---------------------------------------------------------------------------------------------
// Node: CommonJS and ESM consumers

// `exe`/`args` pick the runtime: Node by default, `bun --bun` for the bun group.
let runtime = { group: 'node', exe: process.execPath, args: [] };
function node(code, esm) {
  const file = write(`node-checks/check-${cells.length}.${esm ? 'mjs' : 'cjs'}`, code);
  const r = spawnSync(runtime.exe, [...runtime.args, file], { cwd: dir, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}
const assertJs = (expr, what) => `if (!(${expr})) throw new Error(${JSON.stringify(what)});\n`;

function nodeChecks() {
  for (const e of ENTRIES) {
    const s = S(e.sub);
    const named = e.named;
    // CommonJS
    let r = node(`const v = require('${s}');\n${assertJs('v != null', 'empty')}`);
    record(runtime.group, `require ${e.sub}`, r.ok, r.out, { required: true });
    if (e.cjsMain) {
      r = node(
        `const v = require('${s}');\n${assertJs(e.main, 'require(x) is not the entry value')}`,
      );
      record(runtime.group, `require ${e.sub} is the value`, r.ok, r.out, { required: true });
    }
    if (e.main) {
      r = node(`const v = require('${s}').default;\n${assertJs(e.main, '.default is wrong')}`);
      record(runtime.group, `require ${e.sub} .default`, r.ok, r.out, { required: true });
    }
    if (named.length) {
      r = node(
        `const { ${named.join(', ')} } = require('${s}');\n` +
          named.map((n) => assertJs(`${n} !== undefined`, `missing ${n}`)).join(''),
      );
      record(runtime.group, `require ${e.sub} named`, r.ok, r.out, { required: true });
    }
    // ESM
    r = node(`import v from '${s}';\n${assertJs('v != null', 'empty')}`, true);
    record(runtime.group, `import default ${e.sub} loads`, r.ok, r.out);
    if (e.main) {
      r = node(
        `import v from '${s}';\n${assertJs(e.main, 'default import is not the value')}`,
        true,
      );
      record(runtime.group, `import default ${e.sub} is the value`, r.ok, r.out, { goal: true });
      r = node(
        `import d from '${s}';\nconst v = d.default;\n${assertJs(e.main, 'd.default is wrong')}`,
        true,
      );
      record(runtime.group, `import default ${e.sub} .default`, r.ok, r.out);
    }
    if (named.length) {
      r = node(
        `import d from '${s}';\n` +
          named.map((n) => assertJs(`d.${n} !== undefined`, `d.${n} missing`)).join(''),
        true,
      );
      record(runtime.group, `import default ${e.sub} .named`, r.ok, r.out);
      r = node(
        `import { ${named.join(', ')} } from '${s}';\n` +
          named.map((n) => assertJs(`${n} !== undefined`, `missing ${n}`)).join(''),
        true,
      );
      record(runtime.group, `import { named } ${e.sub}`, r.ok, r.out, { goal: true });
    }
    r = node(
      `import * as ns from '${s}';\n` +
        named.map((n) => assertJs(`ns.${n} !== undefined`, `ns.${n} missing`)).join('') +
        (e.main ? `const v = ns.default;\n${assertJs(e.main, 'ns.default is not the value')}` : ''),
      true,
    );
    record(runtime.group, `import * as ns ${e.sub}`, r.ok, r.out, { goal: true });
  }
  let r = node(`require.resolve('${PKG}/loader');`);
  record(runtime.group, 'require.resolve loader', r.ok, r.out, { required: true });
  r = node(`import.meta.resolve('${PKG}/loader');`, true);
  record(runtime.group, 'import.meta.resolve loader', r.ok, r.out);
  r = node(`${assertJs(`require('${PKG}/package.json').name === '${PKG}'`, 'name')}`);
  record(runtime.group, 'require package.json', r.ok, r.out, { goal: true });
  r = node(
    `import p from '${PKG}/package.json' with { type: 'json' };\n${assertJs(`p.name === '${PKG}'`, 'name')}`,
    true,
  );
  record(runtime.group, 'import package.json', r.ok, r.out, { goal: true });
}

// ---------------------------------------------------------------------------------------------
// TypeScript consumers

// One file per cell. `esmOnly`/`cjsOnly` limit a cell to module systems where it is meaningful.
const TS_CELLS = [
  ['root default', `import P from '${PKG}';\nnew P({ plainSprite: true });`],
  ['root named', `import { SvgSpritePlugin } from '${PKG}';\nnew SvgSpritePlugin();`],
  ['root namespace', `import * as ns from '${PKG}';\nnew ns.SvgSpritePlugin();`],
  ['root require', `import P = require('${PKG}');\nnew P();\nnew P.SvgSpritePlugin();`, 'cjs'],
  ['plugin default', `import P from '${PKG}/plugin';\nnew P({ spriteAttrs: {} });`],
  ['plugin default as type', `import P from '${PKG}/plugin';\nconst p: P = new P();\np.apply;`],
  ['plugin default.default', `import P from '${PKG}/plugin';\nnew P.default();`],
  ['plugin named', `import { resolveRawSource } from '${PKG}/plugin';\nresolveRawSource({});`],
  ['plugin require', `import m = require('${PKG}/plugin');\nnew m.default();`, 'cjs'],
  ['loader default', `import L from '${PKG}/loader';\nconst n: string = L.NAMESPACE;\nn;`],
  [
    'loader default.default',
    `import L from '${PKG}/loader';\nconst n: string = L.default.NAMESPACE;\nn;`,
  ],
  [
    'loader named',
    `import { parseViewBox, NAMESPACE } from '${PKG}/loader';\nparseViewBox(NAMESPACE);`,
  ],
  ['loader namespace', `import * as ns from '${PKG}/loader';\nns.parseViewBox('');`],
  [
    'rsbuild named',
    `import { pluginSvgSprite } from '${PKG}/rsbuild';\npluginSvgSprite({ extract: true });`,
  ],
  ['rsbuild namespace', `import * as ns from '${PKG}/rsbuild';\nns.pluginSvgSprite();`],
  [
    'symbol default',
    `import S from '${PKG}/runtime/symbol';\nconst u: string = new S({ id: 'a', viewBox: '', content: '' }).url;\nu;`,
  ],
  ['symbol default as type', `import S from '${PKG}/runtime/symbol';\nlet s: S | undefined;\ns;`],
  [
    'browser-sprite default',
    `import B from '${PKG}/runtime/browser-sprite';\nB.add({ id: 'a', content: '' });`,
  ],
  [
    'browser-sprite default.default',
    `import B from '${PKG}/runtime/browser-sprite';\nB.default.add({ id: 'a', content: '' });`,
  ],
  [
    'client reference',
    `/// <reference types="${PKG}/client" />\nimport icon from './icon.svg';\nconst u: string = icon.url;\nu;`,
  ],
];

const TS_MODES = [
  { name: 'node10', ext: 'ts', options: { module: 'commonjs', moduleResolution: 'node10' } },
  { name: 'node16-cjs', ext: 'cts', options: { module: 'node16', moduleResolution: 'node16' } },
  { name: 'node16-esm', ext: 'mts', options: { module: 'node16', moduleResolution: 'node16' } },
  { name: 'bundler', ext: 'ts', options: { module: 'esnext', moduleResolution: 'bundler' } },
];

function tsc(project) {
  const r = spawnSync(
    process.execPath,
    [join(dir, 'node_modules/typescript/bin/tsc'), '-p', project, '--pretty', 'false'],
    { cwd: dir, encoding: 'utf8' },
  );
  return `${r.stdout}${r.stderr}`;
}

function typeChecks() {
  for (const mode of TS_MODES) {
    const base = `types-${mode.name}`;
    const files = [];
    for (const [name, code, only] of TS_CELLS) {
      if (only === 'cjs' && mode.ext === 'mts') continue;
      if (only === 'cjs' && mode.name === 'bundler') continue;
      const file = `${name.replace(/[^a-z0-9]+/gi, '-')}.${mode.ext}`;
      write(`${base}/${file}`, `${code}\nexport {};\n`);
      files.push([name, file]);
    }
    const compilerOptions = {
      ...mode.options,
      target: 'es2022',
      strict: true,
      esModuleInterop: true,
      noEmit: true,
      types: [],
      skipLibCheck: true,
    };
    write(`${base}/tsconfig.json`, JSON.stringify({ compilerOptions, include: ['*'] }, null, 2));
    const out = tsc(join(dir, base));
    for (const [name, file] of files) {
      const errors = out.split('\n').filter((l) => l.startsWith(`${base}/${file}(`));
      // Goals for 1.6.0: subpath types under node10, and ESM default imports that type as the
      // value under node16.
      const goal =
        (mode.name === 'node10' && !name.includes('default.default')) ||
        (mode.name === 'node16-esm' && name.includes('default'));
      record('types', `${mode.name}: ${name}`, errors.length === 0, errors.join(' | '), { goal });
    }
    // The package's own declaration files must type-check as well.
    write(
      `${base}-lib/all.${mode.ext}`,
      ENTRIES.map((e, i) => `import * as e${i} from '${S(e.sub)}';\ne${i};`).join('\n') +
        '\nexport {};\n',
    );
    write(
      `${base}-lib/tsconfig.json`,
      JSON.stringify(
        {
          compilerOptions: { ...compilerOptions, skipLibCheck: false, types: ['node'] },
          include: ['*'],
        },
        null,
        2,
      ),
    );
    const lib = tsc(join(dir, `${base}-lib`))
      .split('\n')
      .filter((l) => l.includes(`node_modules/${PKG}/`) || l.startsWith(`${base}-lib/all.`));
    record('types', `${mode.name}: package declarations`, lib.length === 0, lib.join(' | '), {
      goal: true,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Real builds

const STAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polygon points="16,2 20,12 31,12"/></svg>\n';
const CIRCLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>\n';

// Collects what the bundle exported and what the inline runtime put into the page.
const ENTRY_JS =
  "import star from './icons/star.svg';\n" +
  "import circle from './icons/circle.svg';\n" +
  'globalThis.__result = { icons: [star, circle].map((s) => ({ id: s.id, url: String(s.url), viewBox: s.viewBox })) };\n';

// Also imports the runtime directly: the app and the generated loader code must share one
// sprite and one SpriteSymbol class (no dual-package hazard).
const ENTRY_RUNTIME_JS =
  "import star from './icons/star.svg';\n" +
  `import sprite from '${PKG}/runtime/browser-sprite';\n` +
  `import SpriteSymbol from '${PKG}/runtime/symbol';\n` +
  "sprite.add(new SpriteSymbol({ id: 'extra', viewBox: '0 0 1 1', content: '<symbol id=\"extra\"></symbol>' }));\n" +
  'globalThis.__result = { isSymbol: star instanceof SpriteSymbol, icons: [{ id: star.id, url: String(star.url) }] };\n';

function webpackConfig(format, mode, variant) {
  const extract = mode === 'extract';
  const lines = [];
  if (format === 'cjs') {
    lines.push(
      variant === 'subpath'
        ? `const SvgSpritePlugin = require('${PKG}/plugin').default;`
        : `const { SvgSpritePlugin } = require('${PKG}');`,
    );
  } else if (variant === 'subpath') {
    lines.push(`import SvgSpritePlugin from '${PKG}/plugin';`);
  } else {
    lines.push(`import SvgSpritePlugin from '${PKG}';`);
  }
  if (format === 'mjs') {
    lines.push("import { fileURLToPath } from 'node:url';");
    lines.push('const here = fileURLToPath(new URL(".", import.meta.url));');
  } else {
    lines.push('const here = __dirname;');
  }
  const loader =
    variant === 'resolved'
      ? format === 'mjs'
        ? `fileURLToPath(import.meta.resolve('${PKG}/loader'))`
        : `require.resolve('${PKG}/loader')`
      : `'${PKG}/loader'`;
  const entry = variant === 'runtime' ? './src/runtime.js' : './src/index.js';
  lines.push(
    `const config = {
  mode: 'development',
  devtool: false,
  context: here,
  target: 'web',
  entry: '${entry}',
  output: { path: here + '/out', publicPath: '/', clean: true },
  module: {
    rules: [
      {
        test: /\\.svg$/,
        type: 'javascript/auto',
        loader: ${loader},
        options: { extract: ${extract} },
      },
    ],
  },
  plugins: [${extract ? 'new SvgSpritePlugin()' : ''}],
};`,
  );
  lines.push(format === 'cjs' ? 'module.exports = config;' : 'export default config;');
  return lines.join('\n') + '\n';
}

function rsbuildConfig(format, mode) {
  const head =
    format === 'cjs'
      ? `const { pluginSvgSprite } = require('${PKG}/rsbuild');`
      : `import { pluginSvgSprite } from '${PKG}/rsbuild';`;
  const body = `{
  plugins: [pluginSvgSprite({ extract: ${mode === 'extract'} })],
  source: { entry: { index: './src/index.js' } },
  output: { distPath: { root: 'out' }, assetPrefix: '/', filenameHash: false, minify: false, cleanDistPath: true },
  performance: { chunkSplit: { strategy: 'all-in-one' } },
  tools: { htmlPlugin: false },
}`;
  return `${head}\nconst config = ${body};\n${format === 'cjs' ? 'module.exports = config;' : 'export default config;'}\n`;
}

const RUNNER = `import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
const [bundler, configFile, mode] = process.argv.slice(2);
const config = (await import(pathToFileURL(configFile).href)).default;
const root = join(configFile, '..');
const pick = (m) => m.rspack || m.webpack || m.default;
async function build() {
  if (bundler.startsWith('rsbuild')) {
    const m = await import(bundler === 'rsbuild1' ? '@rsbuild/core' : 'rsbuild-v2');
    const rsbuild = await m.createRsbuild({ cwd: root, rsbuildConfig: config });
    await rsbuild.build();
    return;
  }
  const impl = pick(await import(bundler === 'webpack' ? 'webpack' : bundler === 'rspack1' ? '@rspack/core' : 'rspack-v2'));
  await new Promise((res, rej) => {
    const compiler = impl(config);
    compiler.run((err, stats) => compiler.close(() => {
      if (err) return rej(err);
      if (stats.hasErrors()) return rej(new Error(stats.toString({ all: false, errors: true })));
      res();
    }));
  });
}
await build();
const out = join(root, 'out');
const jsDir = existsSync(join(out, 'static/js')) ? join(out, 'static/js') : out;
const js = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
const inserted = [];
const el = () => ({ html: '', style: {}, setAttribute() {}, getElementById(id) { return this.html.includes('id="' + id + '"') ? {} : null; }, insertAdjacentHTML(_p, h) { this.html += h; } });
const document = { readyState: 'complete', body: { firstChild: null, insertBefore(n) { inserted.push(n); } }, createElementNS: () => el(), addEventListener() {} };
const ctx = vm.createContext({ document, console, setTimeout, clearTimeout });
ctx.self = ctx; ctx.window = ctx;
for (const f of js) vm.runInContext(readFileSync(join(jsDir, f), 'utf8'), ctx);
const result = ctx.__result;
const sprite = mode === 'extract' && existsSync(join(out, 'sprite.svg')) ? readFileSync(join(out, 'sprite.svg'), 'utf8') : null;
console.log(JSON.stringify({ result, sprites: inserted.map((n) => n.html), sprite }));
`;

// `bunOnly` limits the matrix to Rspack 1 builds with the shared config shapes.
function buildChecks(bunOnly = false) {
  write('runner.mjs', RUNNER);
  write('icons/star.svg', STAR);
  write('icons/circle.svg', CIRCLE);
  const project = (name, configName, config, entry = ENTRY_JS) => {
    write(`${name}/src/icons/star.svg`, STAR);
    write(`${name}/src/icons/circle.svg`, CIRCLE);
    write(`${name}/src/index.js`, ENTRY_JS);
    write(`${name}/src/runtime.js`, entry === ENTRY_JS ? ENTRY_RUNTIME_JS : entry);
    return write(`${name}/${configName}`, config);
  };
  const run = (bundler, configFile, mode) => {
    const r = spawnSync(
      runtime.exe,
      [...runtime.args, join(dir, 'runner.mjs'), bundler, configFile, mode],
      {
        cwd: dir,
        encoding: 'utf8',
        timeout: 120000,
      },
    );
    if (r.status !== 0) return { ok: false, out: `${r.stdout}${r.stderr}`.trim() };
    const line = r.stdout.trim().split('\n').pop();
    return { ok: true, data: JSON.parse(line) };
  };
  const verify = (data, mode, runtime) => {
    const icons = data.result && data.result.icons;
    if (!icons) return 'bundle did not export the icons';
    const ids = runtime ? ['star'] : ['star', 'circle'];
    for (let i = 0; i < ids.length; i++) {
      if (!icons[i] || icons[i].id !== ids[i]) return `icon ${i} has id ${icons[i] && icons[i].id}`;
      const url = mode === 'extract' ? `/sprite.svg#${ids[i]}` : `#${ids[i]}`;
      if (icons[i].url !== url) return `icon ${ids[i]} url ${icons[i].url}, expected ${url}`;
    }
    if (mode === 'extract') {
      if (!data.sprite) return 'sprite.svg was not emitted';
      for (const id of ids)
        if (!data.sprite.includes(`<symbol id="${id}"`)) return `sprite lacks ${id}`;
      if (data.sprites.length) return 'extract mode mounted an inline sprite';
    } else {
      if (data.sprites.length !== 1)
        return `${data.sprites.length} inline sprites mounted, expected 1`;
      const want = runtime ? ['star', 'extra'] : ids;
      for (const id of want)
        if (!data.sprites[0].includes(`<symbol id="${id}"`)) return `inline sprite lacks ${id}`;
      if (runtime && data.result.isSymbol !== true) return 'two SpriteSymbol classes in one bundle';
    }
    return null;
  };
  const check = (label, bundler, configFile, mode, opts, runtime = false) => {
    const r = run(bundler, configFile, mode);
    const problem = r.ok ? verify(r.data, mode, runtime) : r.out;
    record(runtime.group === 'bun' ? 'bun' : 'build', label, problem === null, problem, opts);
  };

  if (bunOnly) {
    for (const mode of ['inline', 'extract']) {
      for (const format of ['cjs', 'mjs']) {
        const file = project(
          `bun-${mode}-${format}`,
          `config.${format}`,
          webpackConfig(format, mode, 'root'),
        );
        check(`bun: rspack1 ${mode} ${format} config`, 'rspack1', file, mode);
      }
    }
    return;
  }
  for (const bundler of ['rspack1', 'rspack2', 'webpack']) {
    for (const mode of ['inline', 'extract']) {
      for (const format of ['cjs', 'mjs']) {
        const name = `b-${bundler}-${mode}-${format}`;
        const file = project(name, `config.${format}`, webpackConfig(format, mode, 'root'));
        check(`${bundler} ${mode} ${format} config`, bundler, file, mode, { required: true });
      }
      // Loader given as a resolved file path, as ESM configs must do without require.resolve.
      for (const format of ['cjs', 'mjs']) {
        const name = `b-${bundler}-${mode}-${format}-resolved`;
        const file = project(name, `config.${format}`, webpackConfig(format, mode, 'resolved'));
        check(`${bundler} ${mode} ${format} config, resolved loader path`, bundler, file, mode);
      }
    }
    // The plugin imported from its own subpath in an ESM config (default import).
    const sub = project(
      `b-${bundler}-subpath`,
      'config.mjs',
      webpackConfig('mjs', 'extract', 'subpath'),
    );
    check(`${bundler} extract mjs config, /plugin default import`, bundler, sub, 'extract', {
      goal: true,
    });
    const subCjs = project(
      `b-${bundler}-subpath-cjs`,
      'config.cjs',
      webpackConfig('cjs', 'extract', 'subpath'),
    );
    check(`${bundler} extract cjs config, require('/plugin').default`, bundler, subCjs, 'extract', {
      required: true,
    });
    const rt = project(
      `b-${bundler}-runtime`,
      'config.cjs',
      webpackConfig('cjs', 'inline', 'runtime'),
    );
    check(
      `${bundler} inline, app imports runtime too (one sprite)`,
      bundler,
      rt,
      'inline',
      {},
      true,
    );
  }
  for (const bundler of ['rsbuild1', 'rsbuild2']) {
    for (const mode of ['inline', 'extract']) {
      for (const format of ['cjs', 'mjs']) {
        const name = `b-${bundler}-${mode}-${format}`;
        const file = project(name, `config.${format}`, rsbuildConfig(format, mode));
        check(`${bundler} ${mode} ${format} config`, bundler, file, mode);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------

if (only.has('node')) nodeChecks();
if (only.has('types')) typeChecks();
if (only.has('build')) buildChecks();
let bunMissing = false;
if (only.has('bun')) {
  const probe = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) {
    console.log(`bun group: bun ${probe.stdout.trim()}`);
    runtime = { group: 'bun', exe: 'bun', args: ['--bun'] };
    nodeChecks();
    buildChecks(true);
  } else {
    bunMissing = true;
    console.log(
      `NOTE: bun is not on PATH, the bun group is skipped${flag('--require-bun') ? '' : ' (use --require-bun to fail)'}`,
    );
  }
}

const strict = flag('--strict');
let failedRequired = bunMissing && flag('--require-bun') ? 1 : 0;
if (failedRequired) console.log('FAIL: --require-bun was given but bun is not on PATH');
const rows = cells.map((c) => {
  const before = baseline ? baseline.get(c.id) : undefined;
  const required = c.required || before === true || (strict && c.goal);
  if (required && !c.pass) failedRequired++;
  const change =
    before === undefined ? '' : before === c.pass ? '' : c.pass ? 'NEW PASS' : 'REGRESSION';
  return { ...c, required, before, change };
});

const yesNo = (v) => (v === undefined ? '-' : v ? 'pass' : 'FAIL');
const width = Math.max(...rows.map((r) => r.id.length)) + 2;
let group = '';
for (const r of rows) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group.toUpperCase()}`);
    console.log(`${'cell'.padEnd(width)}${baseline ? 'before  ' : ''}now     req  change`);
  }
  console.log(
    `${r.id.padEnd(width)}${baseline ? yesNo(r.before).padEnd(8) : ''}${yesNo(r.pass).padEnd(8)}` +
      `${r.required ? 'yes' : r.goal ? 'goal' : ''}`.padEnd(5) +
      r.change,
  );
  if (!r.pass && r.required) console.log(`  -> ${r.detail.replace(/\s+/g, ' ')}`);
}
const passed = rows.filter((r) => r.pass).length;
console.log(
  `\n${PKG}@${installed.version}: ${passed}/${rows.length} cells pass, ` +
    `${failedRequired} required cell(s) failed`,
);
if (option('--json')) {
  writeFileSync(
    option('--json'),
    JSON.stringify({ version: installed.version, cells: rows }, null, 2) + '\n',
  );
}
if (flag('--keep')) console.log(`kept ${dir}`);
else rmSync(dir, { recursive: true, force: true });
process.exit(failedRequired ? 1 : 0);
