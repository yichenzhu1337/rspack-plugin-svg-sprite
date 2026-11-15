// Packs the package, installs the tarball into a temp copy of every consumer (outside the
// workspace, so the apps see exactly what npm users get), and builds each consumer once.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumers } from '../consumers.mjs';

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(e2eDir, '..');

export const workDir = process.env.E2E_WORKDIR || path.join(os.tmpdir(), 'svg-sprite-e2e');
export const manifestPath = path.join(workDir, 'manifest.json');

function run(command, args, cwd, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(output);
      reject(new Error(`${label} failed with exit code ${code}\n${output.slice(-4000)}`));
    });
  });
}

async function packPackage() {
  const packDir = path.join(workDir, 'pack');
  fs.mkdirSync(packDir, { recursive: true });
  await run('pnpm', ['build'], repoRoot, 'pnpm build');
  await run('pnpm', ['pack', '--pack-destination', packDir], repoRoot, 'pnpm pack');
  const tarball = fs.readdirSync(packDir).find((file) => file.endsWith('.tgz'));
  if (!tarball) throw new Error('pnpm pack produced no .tgz file');
  return path.join(packDir, tarball);
}

async function buildConsumer(consumer, tarball) {
  const dir = path.join(workDir, consumer.name);
  const shared = path.join(e2eDir, 'consumers', '_shared');
  fs.cpSync(shared, dir, { recursive: true });
  fs.cpSync(path.join(e2eDir, 'consumers', consumer.name), dir, { recursive: true });

  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies['rspack-plugin-svg-sprite'] = `file:${tarball}`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  await run('pnpm', ['install', '--ignore-workspace'], dir, `${consumer.name}: pnpm install`);
  await run('pnpm', ['run', 'build'], dir, `${consumer.name}: pnpm run build`);

  const dist = path.join(dir, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`${consumer.name}: the build wrote no dist/index.html`);
  }
  return dist;
}

export async function setup() {
  if (process.env.E2E_REUSE === '1' && fs.existsSync(manifestPath)) return;
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  const started = Date.now();
  const tarball = await packPackage();
  const dists = await Promise.all(consumers.map((consumer) => buildConsumer(consumer, tarball)));
  const manifest = Object.fromEntries(consumers.map((c, i) => [c.name, { ...c, dist: dists[i] }]));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    `Built ${consumers.length} consumers in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
