interface SymbolEntry {
  id: string;
  content: string;
}

let symbols: Record<string, SymbolEntry> = {};
let sprite: SVGSVGElement | null = null;
let isMounted = false;

function createSpriteElement(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function mount(): void {
  if (isMounted) return;
  sprite = createSpriteElement();
  document.body.insertBefore(sprite, document.body.firstChild);
  isMounted = true;

  Object.keys(symbols).forEach((id) => {
    appendSymbolToSprite(symbols[id]);
  });
}

function appendSymbolToSprite(symbolData: SymbolEntry): void {
  const existing = sprite!.getElementById(symbolData.id);
  if (existing) {
    existing.outerHTML = symbolData.content;
  } else {
    sprite!.insertAdjacentHTML('beforeend', symbolData.content);
  }
}

function add(symbolData: SymbolEntry): void {
  symbols[symbolData.id] = symbolData;
  if (isMounted) {
    appendSymbolToSprite(symbolData);
  }
}

/** @internal Reset all state — for testing only. */
function _reset(): void {
  symbols = {};
  sprite = null;
  isMounted = false;
}

/** @internal Perform auto-mount based on document readiness. */
function autoMount(): void {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }
}

autoMount();

export default { add, mount, _reset, autoMount };
