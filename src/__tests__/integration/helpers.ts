import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = process.cwd();
export const DIST = path.join(ROOT, 'dist');
const FIXTURES = path.join(ROOT, 'src/__tests__/fixtures');

/** Native require, so the real bundlers and the compiled dist are loaded, not bundled. */
export const nodeRequire = createRequire(path.join(ROOT, 'package.json'));

export const LOADER = path.join(DIST, 'loader.js');
export const SvgSpritePlugin = nodeRequire(path.join(DIST, 'index.js'));

export interface Bundler {
  name: string;
  impl: any;
}

const RSPACK_LINES: Bundler[] = [
  { name: 'rspack 1', impl: nodeRequire('@rspack/core') },
  { name: 'rspack 2', impl: nodeRequire('rspack-v2') },
];

/** Every bundler line the README lists as tested. */
export const ALL_BUNDLERS: Bundler[] = [
  ...RSPACK_LINES,
  { name: 'webpack 5', impl: nodeRequire('webpack') },
];

export function svg(pathData: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="' +
    pathData +
    '"/></svg>\n'
  );
}

export function fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

/** Creates a throwaway project. The real path matters: macOS tmp is a symlink. */
export function makeProject(files: Record<string, string>): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'svg-sprite-it-')));
  for (const rel of Object.keys(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel]);
  }
  return dir;
}

export function removeProject(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export interface BuildResult {
  hasErrors: boolean;
  /** Warnings raised by this package only. */
  warnings: string[];
}

export function build(impl: any, config: any): Promise<BuildResult> {
  return new Promise((resolve, reject) => {
    const compiler = impl(config);
    compiler.run((err: Error | null, stats: any) => {
      compiler.close(() => {
        if (err) return reject(err);
        const json = stats.toJson({ all: false, warnings: true });
        resolve({
          hasErrors: stats.hasErrors(),
          warnings: (json.warnings || [])
            .map((w: any) => String(w.message || w))
            .filter((m: string) => m.includes('[rspack-plugin-svg-sprite]')),
        });
      });
    });
  });
}

export function symbolIds(spriteFile: string): string[] {
  if (!fs.existsSync(spriteFile)) return [];
  const ids: string[] = [];
  const re = /<symbol id="([^"]+)"/g;
  const text = fs.readFileSync(spriteFile, 'utf8');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) ids.push(match[1]);
  return ids;
}

/** Runs `fn` with console.warn silenced (the plugin warns when it has nothing to emit). */
export async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Watcher {
  /** Applies a file change and resolves once the compiler has been idle for one second. */
  change(apply: () => void): Promise<void>;
  close(): Promise<void>;
}

/**
 * Starts `compiler.watch` and waits for the first build to settle. "Settled" means no build
 * callback for one second, which absorbs the extra rebuild some file watchers fire for files
 * that were written just before watching started.
 */
export async function startWatch(impl: any, config: any): Promise<Watcher> {
  await sleep(1200);
  let onIdle: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failure: Error | null = null;

  const compiler = impl(config);
  const waitIdle = () =>
    new Promise<void>((resolve, reject) => {
      onIdle = () => (failure ? reject(failure) : resolve());
    });

  const first = waitIdle();
  const watching = compiler.watch({ aggregateTimeout: 100 }, (err: Error | null) => {
    if (err) failure = err;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const done = onIdle;
      onIdle = null;
      if (done) done();
    }, 1000);
  });
  await first;

  return {
    async change(apply: () => void) {
      const idle = waitIdle();
      apply();
      await idle;
    },
    close() {
      return new Promise<void>((resolve) => {
        if (timer) clearTimeout(timer);
        watching.close(() => compiler.close(() => resolve()));
      });
    },
  };
}
