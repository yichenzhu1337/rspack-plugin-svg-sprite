// sprite.html: shows the one file the build wrote. A sprite only defines <symbol> elements, so opening
// sprite.svg on its own shows a blank page; this page reads it and draws every symbol with <use>.
import './theme';
import './styles.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const grid = document.getElementById('symbols');
const filter = document.getElementById('symbol-filter');
const count = document.getElementById('symbol-count');
const status = document.getElementById('copy-status');

async function gzipSize(text) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

function tile(id, viewBox) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'symbol';
  button.title = `Copy <svg><use href="sprite.svg#${id}"/></svg>`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (viewBox) svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `sprite.svg#${id}`);
  svg.appendChild(use);
  const label = document.createElement('code');
  label.textContent = id;
  button.append(svg, label);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`<svg><use href="sprite.svg#${id}"/></svg>`);
      status.textContent = `Copied the markup for ${id}`;
    } catch (e) {
      status.textContent = 'Copy failed';
    }
  });
  return button;
}

async function main() {
  const response = await fetch('sprite.svg');
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const symbols = [...doc.querySelectorAll('symbol')].map((s) => ({
    id: s.getAttribute('id'),
    viewBox: s.getAttribute('viewBox'),
  }));

  document.getElementById('out-count').textContent = String(symbols.length);
  document.getElementById('out-size').textContent = kb(new Blob([text]).size);
  const gz = await gzipSize(text);
  if (gz) document.getElementById('out-gzip').textContent = `· ${kb(gz)} gzipped`;

  const tiles = symbols.map((s) => ({ id: s.id, el: tile(s.id, s.viewBox) }));
  grid.replaceChildren(...tiles.map((t) => t.el));
  const update = () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    for (const t of tiles) {
      const match = !q || t.id.toLowerCase().includes(q);
      t.el.hidden = !match;
      if (match) shown++;
    }
    count.textContent = q
      ? `${shown} of ${symbols.length} symbols`
      : `${symbols.length} symbols, click one to copy its markup`;
  };
  filter.addEventListener('input', update);
  update();

  // The start of the file as written, one element per line.
  const lines = text.replace(/></g, '>\n<').split('\n');
  const head = lines.slice(0, 24).join('\n');
  document.getElementById('sprite-source').textContent =
    lines.length > 24 ? `${head}\n… ${lines.length - 24} more lines` : head;
}

main().catch(() => {
  count.textContent = 'Could not load sprite.svg.';
});
