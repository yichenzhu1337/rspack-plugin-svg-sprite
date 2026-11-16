// Shared helpers for the consumer suite: running commands, packing the package, and building one
// consumer app in a temp directory against any install source.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(e2eDir, '..');
export const PACKAGE = 'rspack-plugin-svg-sprite';

export function run(command, args, cwd, label, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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

/**
 * Turns a version or dist-tag into the exact version npm serves for it, so that every consumer
 * installs the same one whatever its package manager's own release-age rules say.
 */
export async function resolveVersion(spec) {
  const out = await run(
    'npm',
    ['view', `${PACKAGE}@${spec}`, 'version', '--json'],
    repoRoot,
    'npm view',
  );
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed.at(-1) : parsed;
}

/** Builds the package and packs it into `packDir`; returns the tarball path. */
export async function packPackage(packDir) {
  fs.mkdirSync(packDir, { recursive: true });
  await run('bun', ['run', 'build'], repoRoot, 'bun run build');
  await run('npm', ['pack', '--pack-destination', packDir], repoRoot, 'npm pack');
  const tarball = fs.readdirSync(packDir).find((file) => file.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack produced no .tgz file');
  return path.join(packDir, tarball);
}

// Probe entry for the differential test: loads every icon and publishes what the app would see.
const probeSource = (
  icons,
) => `${icons.map((n, i) => `import i${i} from './icons/${n}.svg';`).join('\n')}
const pick = (s) => ({ id: s.id, viewBox: s.viewBox, url: s.url, content: s.content });
globalThis.__probe = JSON.stringify({ ${icons.map((n, i) => `${n}: pick(i${i})`).join(', ')} });
`;

/**
 * Copies a consumer to `dir`, points its dependency on the package at `spec` (a version, a
 * dist-tag or a `file:` tarball), installs with the consumer's own package manager, and builds.
 * `registry` (a URL) is written to each manager's own config. `probe` (a list of icon names)
 * swaps the app entry for the icon probe. Returns the dist directory and the installed version.
 */
export async function buildConsumer(consumer, dir, { spec, registry, probe }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(e2eDir, 'consumers', '_shared'), dir, { recursive: true });
  fs.cpSync(path.join(e2eDir, 'consumers', consumer.name), dir, { recursive: true });

  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies[PACKAGE] = spec;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  if (probe) {
    // Whichever of these a consumer's config uses as its entry gets the probe.
    for (const name of ['app.js', 'main.js']) {
      const entry = path.join(dir, 'src', name);
      if (fs.existsSync(entry)) fs.writeFileSync(entry, probeSource(probe));
    }
  }

  const pm = consumer.packageManager ?? 'npm';
  const published = !spec.startsWith('file:');
  if (pm === 'pnpm' && (registry || published)) {
    // pnpm holds back versions younger than its release-age default; this suite wants exactly
    // the version it asked for, even a minute after it was published.
    fs.appendFileSync(path.join(dir, '.npmrc'), 'minimum-release-age=0\n');
  }
  if (registry) {
    // npm and pnpm read .npmrc; Bun reads bunfig.toml.
    if (pm === 'bun') {
      fs.writeFileSync(path.join(dir, 'bunfig.toml'), `[install]\nregistry = "${registry}"\n`);
    } else {
      fs.appendFileSync(path.join(dir, '.npmrc'), `registry=${registry}\n`);
    }
  }

  // A bundler launched through `bun run` still runs on Node (its bin has a Node shebang).
  const installs = {
    npm: ['npm', ['install', '--no-audit', '--no-fund']],
    bun: ['bun', ['install']],
    // pnpm's strict node_modules is where missing-dependency bugs surface; the repo itself no
    // longer uses pnpm, so it is fetched on demand and pinned (bunx cannot run it).
    pnpm: ['npx', ['--yes', 'pnpm@12.18.0', 'install', '--ignore-workspace']],
  };
  const [command, args] = installs[pm];
  await run(command, args, dir, `${consumer.name}: ${pm} install`);
  await run(
    pm === 'bun' ? 'bun' : 'npm',
    ['run', 'build'],
    dir,
    `${consumer.name}: ${pm} run build`,
  );

  const dist = path.join(dir, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    throw new Error(`${consumer.name}: the build wrote no dist/index.html`);
  }
  const installed = JSON.parse(
    fs.readFileSync(path.join(dir, 'node_modules', PACKAGE, 'package.json'), 'utf8'),
  ).version;
  return { dist, installed };
}
