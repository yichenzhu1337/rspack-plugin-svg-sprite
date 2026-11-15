import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { manifestPath, setup } from './scripts/setup.mjs';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
};

function serve(dist, port) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(dist, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    if (!file.startsWith(dist) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': mimeTypes[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export default async function globalSetup() {
  await setup();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const servers = await Promise.all(
    Object.values(manifest).map((consumer) => serve(consumer.dist, consumer.port)),
  );
  return async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  };
}
