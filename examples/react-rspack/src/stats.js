// Shows the real transfer size of sprite.svg next to its name.
// Nothing is hard-coded, so the number cannot drift.
function show(entry) {
  const bytes = entry.transferSize || entry.encodedBodySize;
  if (!bytes) return false;
  const el = document.getElementById('sprite-size');
  if (el) el.textContent = `(${(bytes / 1024).toFixed(1)} KB)`;
  return true;
}

const isSprite = (entry) => entry.name.split('#')[0].endsWith('sprite.svg');

export function showSpriteSize() {
  if (!window.PerformanceObserver) return;
  const found = performance.getEntriesByType('resource').find(isSprite);
  if (found && show(found)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries().find(isSprite);
      if (entry && show(entry)) observer.disconnect();
    });
    observer.observe({ type: 'resource', buffered: true });
  } catch (e) {
    // Resource Timing is not available: leave the size out.
  }
}
