// Installs the package into a temp copy of every consumer (outside the workspace, so the apps
// see exactly what npm users get), and builds each consumer once.
//
// E2E_SOURCE picks where the package comes from:
//   tarball   (default) the packed tarball of this checkout
//   registry  the checkout, published to a throwaway local registry and installed by name
//   npm       the real npm registry, version or dist-tag E2E_VERSION (default latest); nothing
//             is built locally
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { consumers } from '../consumers.mjs';
import { PACKAGE, buildConsumer, packPackage, resolveVersion } from './lib.mjs';
import { startRegistry } from './registry.mjs';

export const workDir = process.env.E2E_WORKDIR || path.join(os.tmpdir(), 'svg-sprite-e2e');
export const manifestPath = path.join(workDir, 'manifest.json');

export async function setup() {
  if (process.env.E2E_REUSE === '1' && fs.existsSync(manifestPath)) return;
  const source = process.env.E2E_SOURCE || 'tarball';
  if (!['tarball', 'registry', 'npm'].includes(source)) {
    throw new Error(`E2E_SOURCE must be tarball, registry or npm, not "${source}"`);
  }
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  const started = Date.now();
  let registry = null;
  try {
    let options;
    if (source === 'npm') {
      options = { spec: await resolveVersion(process.env.E2E_VERSION || 'latest') };
    } else {
      const tarball = await packPackage(path.join(workDir, 'pack'));
      if (source === 'registry') {
        registry = await startRegistry(tarball);
        options = { spec: registry.version, registry: registry.url };
      } else {
        options = { spec: `file:${tarball}` };
      }
    }
    const builds = await Promise.all(
      consumers.map((c) => buildConsumer(c, path.join(workDir, c.name), options)),
    );
    const manifest = Object.fromEntries(
      consumers.map((c, i) => [
        c.name,
        { ...c, dist: builds[i].dist, source, installed: builds[i].installed },
      ]),
    );
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const versions = [...new Set(builds.map((b) => b.installed))].join(', ');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `Built ${consumers.length} consumers from ${source} (${PACKAGE}@${versions}) in ${seconds}s`,
    );
  } finally {
    registry?.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
