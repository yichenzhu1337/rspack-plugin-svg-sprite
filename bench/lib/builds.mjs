import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatedIcon } from './fixtures.mjs';

const require = createRequire(import.meta.url);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function createProject(count) {
  const dir = mkdtempSync(join(tmpdir(), 'svg-sprite-bench-'));
  mkdirSync(join(dir, 'icons'));
  mkdirSync(join(dir, 'src'));
  let entry = "import { touch } from './touch.js';\n";
  for (let i = 0; i < count; i++) {
    writeFileSync(join(dir, 'icons', `icon-${i}.svg`), generatedIcon(i));
    entry += `import i${i} from '../icons/icon-${i}.svg';\n`;
  }
  entry += `export const icons = [${Array.from({ length: count }, (_, i) => 'i' + i).join(', ')}];\n`;
  entry += 'console.log(icons.length, touch);\n';
  writeFileSync(join(dir, 'src', 'index.js'), entry);
  writeFileSync(join(dir, 'src', 'touch.js'), 'export const touch = 0;\n');
  return dir;
}

function config(rspack, dir, dist, mode) {
  const { SvgSpritePlugin } = require(join(dist, 'index.js'));
  return {
    context: dir,
    mode: 'development',
    devtool: false,
    entry: './src/index.js',
    output: { path: join(dir, 'out-' + mode), publicPath: '/', clean: true },
    infrastructureLogging: { level: 'error' },
    stats: 'none',
    module: {
      rules: [
        {
          test: /\.svg$/,
          type: 'javascript/auto',
          loader: join(dist, 'loader.js'),
          options: mode === 'extract' ? { extract: true, symbolId: 'icon-[name]' } : {},
        },
      ],
    },
    plugins: mode === 'extract' ? [new SvgSpritePlugin()] : [],
  };
}

function build(rspack, cfg) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const compiler = rspack(cfg);
    compiler.run((err, stats) => {
      const elapsed = performance.now() - start;
      compiler.close(() => {
        if (err) return reject(err);
        if (stats.hasErrors())
          return reject(new Error(stats.toString({ all: false, errors: true })));
        resolve(elapsed);
      });
    });
  });
}

function watchRebuilds(rspack, cfg, dir, runs) {
  return new Promise((resolve, reject) => {
    const times = [];
    let step = 0;
    let startedAt = 0;
    const compiler = rspack(cfg);
    const watching = compiler.watch({ aggregateTimeout: 0 }, (err, stats) => {
      if (err || stats.hasErrors()) {
        watching.close(() =>
          reject(err || new Error(stats.toString({ all: false, errors: true }))),
        );
        return;
      }
      if (step > 0) times.push(performance.now() - startedAt);
      if (step >= runs + 1) {
        watching.close(() => resolve(times));
        return;
      }
      step++;
      // Let the watcher settle, then touch one JS file.
      setTimeout(() => {
        startedAt = performance.now();
        writeFileSync(join(dir, 'src', 'touch.js'), `export const touch = ${step};\n`);
      }, 300);
    });
  });
}

export async function runBuildBenchmarks({ dist }) {
  const { rspack } = require('@rspack/core');
  const count = Number(process.env.BENCH_ICONS || 1000);
  const runs = Number(process.env.BENCH_BUILD_RUNS || 5);
  const dir = createProject(count);
  const out = [];
  try {
    for (const mode of ['inline', 'extract']) {
      await build(rspack, config(rspack, dir, dist, mode)); // warm up the module cache of the process
      const cold = [];
      for (let i = 0; i < runs; i++)
        cold.push(await build(rspack, config(rspack, dir, dist, mode)));
      const rebuild = await watchRebuilds(rspack, config(rspack, dir, dist, mode), dir, runs);
      for (const [label, times] of [
        ['cold build', cold],
        ['incremental rebuild', rebuild],
      ]) {
        const ms = median(times);
        out.push({
          group: 'Real builds',
          name: `${label} ${mode}: ${count} icons`,
          unit: 'build',
          units: 1,
          ms,
          opsPerSec: 1000 / ms,
          rme: times.length > 1 ? ((Math.max(...times) - Math.min(...times)) / 2 / ms) * 100 : 0,
          samples: times.length,
        });
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}
