/**
 * Executable docs. Every fenced js/ts/mjs/cjs/jsx/tsx/vue block (plus the "after" side of `diff`
 * blocks) in README.md and website/docs/*.md is either checked or explicitly skipped, so a new
 * example is covered by default and an example that drifts from the API fails the build.
 *
 * Skipping: put `<!-- docs-test: skip (reason) -->` on the line directly before the opening fence.
 * It renders as nothing in both GitHub Markdown and Rspress. A block that is neither classified
 * nor marked fails the test.
 *
 * Classes:
 * - config  `module.exports = ...` blocks. Type-checked as JS against the built `dist/` types
 *           (so `require('rspack-plugin-svg-sprite')` must really export what the docs destructure).
 *           Blocks that define module rules are also BUILT for real: the block is evaluated, run
 *           through the bundler named in its first-line comment (webpack.config -> webpack 5,
 *           rsbuild.config -> Rsbuild 1 and 2, anything else -> Rspack 1 and 2) on a two-SVG
 *           fixture, and must build without errors and emit a `<symbol`.
 * - rule    a bare `{ test: ..., loader: ... }` object. Type-checked wrapped in `const rule = (...)`.
 * - usage   `import icon from './x.svg'` plus JSX. Type-checked as TSX/JSX with the types from
 *           `client.d.ts`. The preamble (preamble.d.ts) declares a free `icon`/`logo` of the symbol
 *           type and a permissive JSX namespace, for snippets that use them without importing.
 * - vue     the `<script>` part is type-checked (the template is not).
 * - ambient the documented `declare module '*.svg'` is type-checked alone (without client.d.ts) and
 *           must accept the symbol shape.
 *
 * Type-checking uses the repo's own `tsc --noEmit` on a generated temp project, with `paths`
 * pointing the package name at `dist/`. Run `bun run build` first (test:ci does).
 */
import { describe, it, expect } from '@rstest/core';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  ALL_BUNDLERS,
  DIST,
  LOADER,
  build,
  makeProject,
  nodeRequire,
  removeProject,
  svg,
} from './helpers';

const ROOT = process.cwd();
const LANGS = new Set(['js', 'ts', 'mjs', 'cjs', 'jsx', 'tsx', 'vue', 'diff']);
const SKIP_RE = /^<!--\s*docs-test:\s*skip\s*\((.+)\)\s*-->$/;

interface Block {
  file: string;
  heading: string;
  /** 1-based order of the block under its heading. */
  index: number;
  lang: string;
  code: string;
  skip: string | null;
}

function extractBlocks(file: string, markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');
  const perHeading = new Map<string, number>();
  let heading = '(top)';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const fence = /^```(\w*)/.exec(line);
    if (!fence) {
      const h = /^#{1,6}\s+(.*)$/.exec(line);
      if (h) heading = (h[1] as string).trim();
      continue;
    }
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !(lines[j] as string).startsWith('```'))
      body.push(lines[j++] as string);
    const lang = fence[1] as string;
    if (LANGS.has(lang)) {
      const marker = SKIP_RE.exec((lines[i - 1] ?? '').trim());
      const n = (perHeading.get(heading) ?? 0) + 1;
      perHeading.set(heading, n);
      blocks.push({
        file,
        heading,
        index: n,
        lang,
        code: body.join('\n'),
        skip: marker ? (marker[1] as string) : null,
      });
    }
    i = j;
  }
  return blocks;
}

/** The "after" side of a diff block. */
function applyDiff(code: string): string {
  return code
    .split('\n')
    .filter((l) => !l.startsWith('-'))
    .map((l) => (l.startsWith('+') ? l.slice(1) : l))
    .join('\n');
}

type Kind = 'config' | 'rule' | 'usage' | 'vue' | 'ambient';

interface Classified {
  kind: Kind | null;
  /** Source to check, as plain JS/TS/TSX. */
  source: string;
  ext: string;
}

function classify(block: Block): Classified {
  const code = block.lang === 'diff' ? applyDiff(block.code) : block.code;
  if (block.lang === 'vue') {
    const m = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/i.exec(code);
    if (!m) return { kind: null, source: code, ext: 'ts' };
    return {
      kind: 'vue',
      source: (m[1] as string) + '\nexport {};\n',
      ext: /lang=["']ts/.test(code) ? 'ts' : 'js',
    };
  }
  const trimmed = code.replace(/^(\s*\/\/.*\n)+/, '').trimStart();
  if (/^declare module ['"]\*\.svg['"]/.test(trimmed))
    return { kind: 'ambient', source: code, ext: 'ts' };
  const jsExt =
    block.lang === 'ts' || block.lang === 'tsx' ? block.lang : block.lang === 'jsx' ? 'jsx' : 'js';
  if (trimmed.startsWith('{')) {
    return { kind: 'rule', source: 'const rule = (\n' + code + '\n);\nexport {};\n', ext: 'js' };
  }
  if (/\bmodule\.exports\s*=/.test(code)) return { kind: 'config', source: code, ext: 'js' };
  if (/<[a-z][\w.]*[\s>/]/.test(code) || /\bimport\b[^\n]*\.svg/.test(code)) {
    const jsx = jsExt === 'js' || jsExt === 'ts' ? (jsExt === 'ts' ? 'tsx' : 'jsx') : jsExt;
    return { kind: 'usage', source: code + '\nexport {};\n', ext: jsx };
  }
  return { kind: null, source: code, ext: jsExt };
}

const label = (b: Block) => `${b.file} > ${b.heading} #${b.index}`;

function docFiles(): string[] {
  const dir = path.join(ROOT, 'website/docs');
  return [
    'README.md',
    ...fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => 'website/docs/' + f),
  ];
}

const BLOCKS = docFiles().flatMap((f) =>
  extractBlocks(f, fs.readFileSync(path.join(ROOT, f), 'utf8')),
);
const CLASSIFIED = BLOCKS.map((block) => ({ block, ...classify(block) }));
const CHECKED = CLASSIFIED.filter((c) => !c.block.skip && c.kind);

const PREAMBLE = `/// <reference path="${path.join(ROOT, 'client.d.ts').replace(/\\/g, '/')}" />
declare const icon: typeof import('x.svg').default;
declare const logo: typeof import('x.svg').default;
declare namespace JSX {
  interface IntrinsicElements {
    [tag: string]: any;
  }
}
`;

function tsconfig(
  files: string[],
  extraPaths = true /* false: ambient-declaration project, which must stay a script */,
): string {
  const d = DIST.replace(/\\/g, '/');
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'preserve',
      moduleResolution: 'bundler',
      moduleDetection: extraPaths ? 'force' : 'auto',
      allowJs: true,
      checkJs: true,
      strict: true,
      noImplicitAny: false,
      noEmit: true,
      jsx: 'preserve',
      skipLibCheck: true,
      types: [],
      paths: extraPaths
        ? {
            'rspack-plugin-svg-sprite': [d + '/index.d.ts'],
            'rspack-plugin-svg-sprite/*': [d + '/*.d.ts'],
          }
        : {},
    },
    files,
  });
}

function tsc(dir: string): string[] {
  const bin = path.join(ROOT, 'node_modules/.bin/tsc');
  try {
    execFileSync(bin, ['-p', path.join(dir, 'tsconfig.json'), '--pretty', 'false'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return [];
  } catch (e: any) {
    return String(e.stdout || e.message)
      .split('\n')
      .filter((l) => l.includes('error TS'));
  }
}

describe('docs examples', () => {
  it('finds the blocks, and every one is checked or explicitly skipped', () => {
    expect(BLOCKS.length).toBeGreaterThan(15);
    const unclassified = CLASSIFIED.filter((c) => !c.block.skip && !c.kind).map((c) =>
      label(c.block),
    );
    expect(unclassified).toEqual([]);
    // eslint-disable-next-line no-console
    console.log(
      `docs examples: ${CHECKED.length} checked, ${CLASSIFIED.filter((c) => c.block.skip).length} skipped`,
    );
  });

  it('extracts blocks keyed by heading and honours the skip marker', () => {
    const md = [
      '# T',
      '```bash',
      '# not a heading',
      '```',
      '## Sec',
      '<!-- docs-test: skip (partial object) -->',
      '```js',
      '{ a: ... }',
      '```',
      '```jsx',
      '<svg />',
      '```',
    ].join('\n');
    const blocks = extractBlocks('x.md', md);
    expect(blocks.map((b) => [b.heading, b.index, b.lang, b.skip])).toEqual([
      ['Sec', 1, 'js', 'partial object'],
      ['Sec', 2, 'jsx', null],
    ]);
    expect(classify(blocks[0] as Block).kind).toBe('rule');
    expect(classify({ ...(blocks[1] as Block), code: 'foo(...)' }).kind).toBe(null);
  });

  it('type-checks every block against the built types', () => {
    const dir = makeProject({});
    try {
      const files: string[] = ['preamble.d.ts'];
      fs.writeFileSync(path.join(dir, 'preamble.d.ts'), PREAMBLE);
      const names = new Map<string, string>();
      CHECKED.filter((c) => c.kind !== 'ambient').forEach((c, i) => {
        const name = `block${i}.${c.ext}`;
        fs.writeFileSync(path.join(dir, name), c.source);
        files.push(name);
        names.set(name, label(c.block));
      });
      fs.writeFileSync(path.join(dir, 'tsconfig.json'), tsconfig(files));
      const errors = tsc(dir).map((l) =>
        l.replace(/(block\d+\.\w+)/, (m) => `${names.get(m) ?? m} [${m}]`),
      );
      expect(errors).toEqual([]);
    } finally {
      removeProject(dir);
    }
  });

  it('the documented ambient declaration accepts the symbol shape', () => {
    const ambient = CHECKED.filter((c) => c.kind === 'ambient');
    expect(ambient.length).toBeGreaterThan(0);
    for (const c of ambient) {
      const dir = makeProject({
        'ambient.ts': c.source,
        'use.ts':
          "import s from './a.svg';\nconst shape: { id: string; viewBox: string; url: string; content: string } = s;\nexport { shape };\n",
        'tsconfig.json': tsconfig(['ambient.ts', 'use.ts'], false),
      });
      try {
        expect(tsc(dir)).toEqual([]);
      } finally {
        removeProject(dir);
      }
    }
  });
});

/** Evaluates a config block, mapping the package's entry points onto dist/. */
function evaluate(code: string): any {
  const mod: { exports: any } = { exports: {} };
  const fakeRequire = (id: string) => {
    const map: Record<string, string> = {
      'rspack-plugin-svg-sprite': 'index.js',
      'rspack-plugin-svg-sprite/loader': 'loader.js',
      'rspack-plugin-svg-sprite/rsbuild': 'rsbuild.js',
    };
    if (!map[id]) throw new Error('docs example requires an unexpected module: ' + id);
    return nodeRequire(path.join(DIST, map[id] as string));
  };
  new Function('module', 'exports', 'require', code)(mod, mod.exports, fakeRequire);
  return mod.exports;
}

function emittedText(dir: string): string {
  let text = '';
  const walk = (cur: string) => {
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else text += fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return text;
}

const FIXTURE = {
  'src/icon.svg': svg('M1 1h14v14H1z'),
  'src/logo.svg': svg('M8 1l7 14H1z'),
  'src/index.js':
    "import icon from './icon.svg';\nimport logo from './logo.svg';\nwindow.__ICONS = [icon, logo];\n",
};

const RUNNABLE = CHECKED.filter((c) => {
  if (c.kind !== 'config') return false;
  const cfg = evaluate(c.source);
  return Array.isArray(cfg?.module?.rules) && cfg.module.rules.length > 0;
}).map((c) => ({
  ...c,
  runner: /rsbuild\.config/.test(c.source)
    ? 'rsbuild'
    : /webpack\.config/.test(c.source)
      ? 'webpack'
      : 'rspack',
}));

// rsbuild configs have `plugins` only, no module.rules, so find them separately.
const RSBUILD = CHECKED.filter((c) => c.kind === 'config' && /rsbuild\.config/.test(c.source)).map(
  (c) => ({
    ...c,
    runner: 'rsbuild',
  }),
);

describe('docs examples: config blocks build for real', () => {
  it('covers the main install and usage configs', () => {
    const labels = [...RUNNABLE, ...RSBUILD].map((c) => label(c.block));
    expect(RUNNABLE.some((c) => c.runner === 'rspack')).toBe(true);
    expect(RUNNABLE.some((c) => c.runner === 'webpack')).toBe(true);
    expect(RSBUILD.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });

  for (const c of RUNNABLE) {
    const bundlers =
      c.runner === 'webpack'
        ? ALL_BUNDLERS.filter((b) => b.name === 'webpack 5')
        : ALL_BUNDLERS.filter((b) => b.name.startsWith('rspack'));
    for (const b of bundlers) {
      it(`${label(c.block)} builds on ${b.name}`, async () => {
        const dir = makeProject(FIXTURE);
        try {
          const cfg = evaluate(c.source);
          const result = await build(b.impl, {
            ...cfg,
            mode: 'development',
            devtool: false,
            target: 'node',
            context: dir,
            entry: './src/index.js',
            output: { path: path.join(dir, 'out'), filename: 'bundle.js' },
            resolveLoader: { alias: { 'rspack-plugin-svg-sprite/loader': LOADER } },
          });
          expect(result.hasErrors).toBe(false);
          expect(result.warnings).toEqual([]);
          expect(emittedText(path.join(dir, 'out'))).toContain('<symbol');
        } finally {
          removeProject(dir);
        }
      });
    }
  }

  for (const c of RSBUILD) {
    for (const entry of ['@rsbuild/core', 'rsbuild-v2']) {
      it(`${label(c.block)} builds on ${entry}`, async () => {
        const dir = makeProject(FIXTURE);
        const log = console.log;
        console.log = () => {};
        try {
          const { createRsbuild } = nodeRequire(entry);
          const rsbuild = await createRsbuild({ cwd: dir, rsbuildConfig: evaluate(c.source) });
          const result = await rsbuild.build();
          if (result && result.close) await result.close();
          expect(emittedText(path.join(dir, 'dist'))).toContain('<symbol');
        } finally {
          console.log = log;
          removeProject(dir);
        }
      });
    }
  }
});
