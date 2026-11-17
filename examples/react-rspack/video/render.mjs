// Renders the intro video frame by frame: builds the 265 flags with the plugin, reads the real numbers
// from the build, draws every frame in headless Chrome (scene.html, a pure function of time) and pipes
// the PNG frames into ffmpeg.
//
//   node video/render.mjs                    final render: public/intro.mp4 and public/intro-poster.webp
//   node video/render.mjs --draft            960x540 at 15 fps, written to the scratch directory
//   node video/render.mjs --stills 0,12.5    PNG stills at those seconds, to the scratch directory
//   node video/render.mjs --sheet            contact sheet, one frame every 2 seconds
//
// Options: --out <dir> (scratch directory), --crf <n> (final quality, default 32).
// Environment: FFMPEG (path of ffmpeg), CHROME_PATH (path of Chrome; else /usr/bin/google-chrome, else
// the Chromium that Playwright manages).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { FLAG_ORDER } from './flag-order.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');

const FPS = 30;
const DURATION = 43;
const POSTER_T = 33;

const { values: args } = (await import('node:util')).parseArgs({
  options: {
    stills: { type: 'string' },
    sheet: { type: 'boolean', default: false },
    draft: { type: 'boolean', default: false },
    out: { type: 'string' },
    crf: { type: 'string', default: '32' },
  },
});

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const scratch = path.resolve(args.out || path.join(os.tmpdir(), 'svg-sprite-intro-video'));
const isFinal = !args.draft && !args.stills && !args.sheet;

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stderr || r.error}`);
  return r;
}

// ---------------------------------------------------------------------------
// 1. Build the 265 flags in extract mode and collect the real numbers.
// ---------------------------------------------------------------------------
async function buildAndCollect() {
  const { rspack } = require('@rspack/core');
  const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');
  const pkgName = JSON.parse(
    fs.readFileSync(path.resolve(here, '../../../package.json'), 'utf8'),
  ).name;
  const loader = `${pkgName}/loader`;
  require.resolve(loader); // fails when the repository root was not built

  // The flags are not in the package's `exports` map, so resolve the folder from package.json.
  const flagsDir = path.join(
    fs.realpathSync(path.dirname(require.resolve('country-flag-icons/package.json'))),
    '3x2',
  );
  const codes = fs
    .readdirSync(flagsDir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4));
  if (codes.length !== 265) throw new Error(`expected 265 flags, found ${codes.length}`);
  const sameSet = codes.every((c) => FLAG_ORDER.includes(c)) && FLAG_ORDER.length === codes.length;
  if (!sameSet) throw new Error('flag-order.mjs does not match the flags of the package');

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-sprite-flags-'));
  const entry = path.join(work, 'entry.js');
  fs.writeFileSync(
    entry,
    `globalThis.__flags = {};\n` +
      codes
        .map(
          (c) =>
            `globalThis.__flags[${JSON.stringify(c)}] = require(${JSON.stringify(path.join(flagsDir, `${c}.svg`))});`,
        )
        .join('\n'),
  );
  const dist = path.join(work, 'dist');
  const compiler = rspack({
    context: work,
    mode: 'production',
    target: 'node',
    entry,
    output: { path: dist, filename: 'bundle.js', publicPath: '' },
    module: {
      rules: [
        {
          test: /\.svg$/,
          type: 'javascript/auto',
          loader: require.resolve(loader), // the string `loader` is what the video shows
          options: {
            extract: true,
            symbolId: 'flag-[name]',
            spriteFilename: 'sprite.svg',
            esModule: false,
          },
        },
      ],
    },
    plugins: [new SvgSpritePlugin()],
  });
  await new Promise((resolve, reject) =>
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      compiler.close(() => resolve());
    }),
  );

  const vm = await import('node:vm');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(dist, 'bundle.js'), 'utf8'), context);
  const jp = context.__flags.JP;
  const importResult = { id: jp.id, viewBox: jp.viewBox, url: jp.url };

  const spriteText = fs.readFileSync(path.join(dist, 'sprite.svg'), 'utf8');
  const sprite = Buffer.from(spriteText);
  const symbols = [...spriteText.matchAll(/<symbol\b[^>]*>/g)].map((m) => m[0]);
  if (symbols.length !== 265) throw new Error(`sprite has ${symbols.length} symbols`);

  const files = FLAG_ORDER.map((code) => ({
    code,
    bytes: fs.statSync(path.join(flagsDir, `${code}.svg`)).size,
  }));
  return {
    data: {
      loader,
      pkg: pkgName,
      install: `npm install -D ${pkgName}`,
      docs: 'yichenzhu1337.github.io/rspack-plugin-svg-sprite/docs',
      order: FLAG_ORDER,
      files,
      filesTotalBytes: files.reduce((n, f) => n + f.bytes, 0),
      importResult,
      sprite: {
        bytes: sprite.length,
        gzipBytes: zlib.gzipSync(sprite, { level: 9 }).length,
        symbols,
      },
      fps: FPS,
      duration: DURATION,
      chapters: JSON.parse(fs.readFileSync(path.join(here, 'chapters.json'), 'utf8')),
    },
    spritePath: path.join(dist, 'sprite.svg'),
    work,
  };
}

// ---------------------------------------------------------------------------
// 2. Serve the scene (a tiny static server: `<use>` needs a real origin for sprite.svg).
// ---------------------------------------------------------------------------
function serve(data, spritePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://x').pathname.slice(1) || 'scene.html';
    let body;
    if (name === 'data.js') body = `window.DATA = ${JSON.stringify(data)};`;
    else if (name === 'sprite.svg') body = fs.readFileSync(spritePath);
    else if (name === 'scene.html' || name === 'scene.js')
      body = fs.readFileSync(path.join(here, name));
    else {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': types[path.extname(name)] || 'text/plain',
      'cache-control': 'no-store',
    });
    res.end(body);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })),
  );
}

// ---------------------------------------------------------------------------
// 3. Draw frames.
// ---------------------------------------------------------------------------
async function launch() {
  const { chromium } = require('playwright-core');
  const chromePath =
    process.env.CHROME_PATH ||
    (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  return chromium.launch({
    executablePath: chromePath,
    args: [
      '--hide-scrollbars',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-gpu-vsync',
    ],
  });
}

function encoder(outFile, fps, scale) {
  const argv = [
    '-y',
    '-v',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-i',
    '-',
    '-vf',
    `${scale ? `scale=${scale}:flags=lanczos,` : ''}scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    args.draft ? 'veryfast' : 'slow',
    '-tune',
    'animation',
    '-crf',
    args.draft ? '30' : args.crf,
    '-r',
    String(fps),
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-movflags',
    '+faststart',
    '-an',
    outFile,
  ];
  const child = spawn(ffmpeg, argv, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
    );
    child.on('error', reject);
  });
  return {
    async write(buf) {
      if (!child.stdin.write(buf)) await new Promise((r) => child.stdin.once('drain', r));
    },
    async end() {
      child.stdin.end();
      await done;
    },
  };
}

function makePoster(png, outFile) {
  fs.mkdirSync(scratch, { recursive: true });
  const src = path.join(scratch, 'poster.png');
  fs.writeFileSync(src, png);
  for (const width of [1920, 1600, 1280]) {
    for (const quality of [80, 70, 60, 50, 40, 30]) {
      run(ffmpeg, [
        '-y',
        '-v',
        'error',
        '-i',
        src,
        '-vf',
        `scale=${width}:-1:flags=lanczos`,
        '-c:v',
        'libwebp',
        '-quality',
        String(quality),
        '-compression_level',
        '6',
        outFile,
      ]);
      const size = fs.statSync(outFile).size;
      if (size <= 60 * 1024) return { width, quality, size };
    }
  }
  throw new Error('poster does not fit in 60 KB');
}

const { data, spritePath, work } = await buildAndCollect();
console.log(
  `built ${data.files.length} flags: sprite.svg ${data.sprite.bytes} B, ${data.sprite.gzipBytes} B gzipped`,
);
const { server, port } = await serve(data, spritePath);
const browser = await launch();
try {
  const scale = args.draft ? 0.5 : 1;
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto(`http://127.0.0.1:${port}/scene.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const draw = async (t) => {
    await page.evaluate((time) => window.renderAt(time), t);
    return page.screenshot({ type: 'png' });
  };
  // Warm-up: let Chrome fetch sprite.svg and resolve every <use> before the first real frame.
  await draw(POSTER_T);
  await page.waitForTimeout(500);
  await draw(POSTER_T);

  fs.mkdirSync(scratch, { recursive: true });
  if (args.stills || args.sheet) {
    const times = args.stills
      ? args.stills.split(',').map(Number)
      : Array.from({ length: Math.floor(DURATION / 2) + 1 }, (_, i) => i * 2);
    const files = [];
    for (const [i, t] of times.entries()) {
      const file = path.join(
        scratch,
        args.sheet ? `sheet-${String(i).padStart(2, '0')}.png` : `still-${t}.png`,
      );
      fs.writeFileSync(file, await draw(t));
      files.push(file);
    }
    if (args.sheet) {
      const sheet = path.join(scratch, 'contact-sheet.png');
      const cols = 3;
      const rows = Math.ceil(times.length / cols);
      run(ffmpeg, [
        '-y',
        '-v',
        'error',
        '-framerate',
        '1',
        '-i',
        path.join(scratch, 'sheet-%02d.png'),
        '-vf',
        `scale=640:-1:flags=lanczos,tile=${cols}x${rows}:padding=8:color=0x222222`,
        '-frames:v',
        '1',
        sheet,
      ]);
      console.log(`contact sheet: ${sheet}`);
    } else {
      files.forEach((f) => console.log(f));
    }
  } else {
    const outFile = isFinal ? path.join(publicDir, 'intro.mp4') : path.join(scratch, 'draft.mp4');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const fps = args.draft ? 15 : FPS;
    const enc = encoder(outFile, fps, args.draft ? '960:540' : null);
    const total = DURATION * fps;
    for (let i = 0; i < total; i++) {
      await enc.write(await draw(i / fps));
      if (i % 150 === 0) console.log(`frame ${i}/${total}`);
    }
    await enc.end();
    console.log(`${outFile}: ${fs.statSync(outFile).size} bytes`);
    if (isFinal) {
      const poster = makePoster(await draw(POSTER_T), path.join(publicDir, 'intro-poster.webp'));
      console.log(
        `poster: ${poster.width}px wide, quality ${poster.quality}, ${poster.size} bytes`,
      );
    }
  }
} finally {
  await browser.close();
  server.close();
  fs.rmSync(work, { recursive: true, force: true });
}
