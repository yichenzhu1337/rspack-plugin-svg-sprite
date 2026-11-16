// A throwaway local npm registry (Verdaccio) for the e2e suite. It serves the freshly built
// package under a unique prerelease version and proxies every other package to npmjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE, e2eDir, run } from './lib.mjs';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitUntilUp(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Verdaccio exited before it was ready');
    try {
      if ((await fetch(`${url}-/ping`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Verdaccio did not start within 20s');
}

/**
 * Starts the registry, publishes `tarball` to it under `<version>-e2e.<timestamp>`, and returns
 * { url, version, stop }. `stop()` kills the server and removes its storage; it also runs on
 * process exit, so a crash does not leave a server behind.
 */
export async function startRegistry(tarball) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-sprite-registry-'));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const config = [
    `storage: ${path.join(root, 'storage')}`,
    'log: { type: stdout, format: pretty, level: error }',
    'uplinks:',
    '  npmjs:',
    '    url: https://registry.npmjs.org/',
    'packages:',
    // The candidate is never proxied, so nothing from the real registry mixes into it.
    `  '${PACKAGE}':`,
    '    access: $all',
    '    publish: $all',
    "  '**':",
    '    access: $all',
    '    publish: $all',
    '    proxy: npmjs',
    'max_body_size: 100mb',
    '',
  ].join('\n');
  const configPath = path.join(root, 'config.yaml');
  fs.writeFileSync(configPath, config);

  const bin = path.join(e2eDir, 'node_modules', '.bin', 'verdaccio');
  const child = spawn(bin, ['--config', configPath, '--listen', `127.0.0.1:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_UPDATE_NOTIFIER: '1' },
  });
  let log = '';
  child.stdout.on('data', (c) => (log += c));
  child.stderr.on('data', (c) => (log += c));

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    child.kill('SIGKILL');
    fs.rmSync(root, { recursive: true, force: true });
  };
  process.on('exit', stop);

  try {
    await waitUntilUp(url, child);

    // Publish a temp copy with a unique prerelease version; the repository is left untouched.
    const unpack = path.join(root, 'unpack');
    fs.mkdirSync(unpack);
    await run('tar', ['-xzf', tarball, '-C', unpack], root, 'tar');
    const pkgDir = path.join(unpack, 'package');
    const pkgPath = path.join(pkgDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = `${pkg.version}-e2e.${Date.now()}`;
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    const npmrc = path.join(root, 'publish.npmrc');
    // npm insists on a token to publish, so register a throwaway user on this registry.
    const login = await fetch(`${url}-/user/org.couchdb.user:e2e`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'e2e',
        password: 'e2e-throwaway-pass',
        email: 'e2e@example.com',
      }),
    });
    const { token } = await login.json();
    if (!token) throw new Error(`The local registry gave no token (HTTP ${login.status})`);
    fs.writeFileSync(npmrc, `//127.0.0.1:${port}/:_authToken=${token}\n`);
    await run(
      'npm',
      [
        'publish',
        pkgDir,
        '--registry',
        url,
        '--userconfig',
        npmrc,
        '--tag',
        'e2e',
        '--ignore-scripts',
      ],
      root,
      'npm publish (local registry)',
    );
    return { url, version, stop };
  } catch (error) {
    stop();
    throw new Error(`${error.message}\n--- registry log ---\n${log.slice(-2000)}`, {
      cause: error,
    });
  }
}
