// Renders public/og.png (1200x630) from og/og.html. Run once when the design changes:
//   node examples/react-rspack/og/render.mjs
// Set CHROME_PATH to use an installed Chrome instead of Playwright's own Chromium.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Playwright is installed in the e2e workspace.
const { chromium } = createRequire(path.join(here, '../../../e2e/package.json'))(
  '@playwright/test',
);
const flagsDir = path.join(
  path.dirname(
    createRequire(path.join(here, '../package.json')).resolve('country-flag-icons/package.json'),
  ),
  '3x2',
);

const codes = ['US', 'GB', 'DE', 'FR', 'JP', 'BR', 'IN', 'CA', 'KR'];
const band = codes
  .map((code) => {
    const svg = readFileSync(path.join(flagsDir, `${code}.svg`));
    return `<img alt="" src="data:image/svg+xml;base64,${svg.toString('base64')}" />`;
  })
  .join('');

// The page links ../public/logo.svg, so the copy sits next to the original.
const tmp = mkdtempSync(path.join(here, '.tmp-'));
try {
  const html = readFileSync(path.join(here, 'og.html'), 'utf8')
    .replace('<!--FLAGS-->', band)
    .replace('../public/logo.svg', pathToFileURL(path.join(here, '../public/logo.svg')).href);
  const file = path.join(tmp, 'og.html');
  writeFileSync(file, html);

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, '../public/og.png') });
  await browser.close();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
