import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Deterministic pseudo-random numbers, so every run benchmarks identical input. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pathData(rand, segments) {
  let d = 'M' + (rand() * 24).toFixed(2) + ' ' + (rand() * 24).toFixed(2);
  for (let i = 0; i < segments; i++) {
    d += 'c' + [0, 1, 2, 3, 4, 5].map(() => ((rand() - 0.5) * 8).toFixed(3)).join(' ');
  }
  return d + 'z';
}

/** A typical 24x24 single-path icon. */
export function smallIcon() {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
    '</svg>'
  );
}

/** A large illustration-like icon: many paths and groups, tens of kilobytes. */
export function largeIcon(paths = 300) {
  const rand = rng(1);
  let body = '';
  for (let i = 0; i < paths; i++) {
    body +=
      '<g transform="translate(' +
      (rand() * 100).toFixed(1) +
      ' ' +
      (rand() * 100).toFixed(1) +
      ')"><path fill="#' +
      Math.floor(rand() * 0xffffff)
        .toString(16)
        .padStart(6, '0') +
      '" d="' +
      pathData(rand, 12) +
      '"/></g>\n';
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
    'viewBox="0 0 512 512" width="512" height="512">\n<title>Large</title>\n' +
    body +
    '</svg>\n'
  );
}

/** An icon whose root tag carries many attributes, as exported by design tools. */
export function manyAttrsIcon(count = 40) {
  let attrs =
    'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'version="1.1" viewBox="0 0 24 24" class="icon" style="display:block"';
  for (let i = 0; i < count; i++) {
    attrs += ' data-attr-' + i + '="value number ' + i + ' with > and \' inside"';
  }
  attrs +=
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
    ' stroke-linejoin="round" preserveAspectRatio="xMidYMid meet" aria-hidden="true"';
  return '<svg ' + attrs + '><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
}

/** Icon number `i` of a generated set: small but distinct, like a real icon folder. */
export function generatedIcon(i) {
  const rand = rng(i + 7);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
    '<path d="' +
    pathData(rand, 6) +
    '"/><circle cx="' +
    (rand() * 24).toFixed(1) +
    '" cy="12" r="3"/></svg>'
  );
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.svg')) out.push(full);
  }
}

/** Every .svg file shipped in this repository (test fixtures and example icons). */
export function repoIcons() {
  const files = [];
  walk(join(root, 'src'), files);
  walk(join(root, 'examples'), files);
  files.sort();
  return files.map((file) => ({
    file,
    name: basename(file),
    content: readFileSync(file, 'utf8'),
  }));
}
