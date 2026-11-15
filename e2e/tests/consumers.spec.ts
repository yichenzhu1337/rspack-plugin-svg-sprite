import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { consumers, initialIcons, lateIcon } from '../consumers.mjs';

type Consumer = (typeof consumers)[number];

interface Session {
  problems: string[];
  svgResponses: { url: string; status: number; contentType: string }[];
}

async function open(page: Page, consumer: Consumer): Promise<Session> {
  const session: Session = { problems: [], svgResponses: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') session.problems.push(`console error: ${message.text()}`);
  });
  page.on('pageerror', (error) => session.problems.push(`page error: ${error.message}`));
  page.on('requestfailed', (request) => session.problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (response.status() >= 400) {
      session.problems.push(`HTTP ${response.status()}: ${response.url()}`);
    }
    if (pathname.endsWith('.svg')) {
      session.svgResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type'] ?? '',
      });
    }
  });
  await page.goto(`http://127.0.0.1:${consumer.port}/`);
  await expect(page.locator(`svg[data-icon="${initialIcons[0]}"]`)).toBeVisible();
  return session;
}

/** Share of pixels that differ from the white page background, from a screenshot of the element. */
async function paintedShare(locator: Locator): Promise<number> {
  const png = PNG.sync.read(await locator.screenshot());
  let painted = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const distance =
      Math.abs(png.data[i] - 255) +
      Math.abs(png.data[i + 1] - 255) +
      Math.abs(png.data[i + 2] - 255);
    if (png.data[i + 3] > 0 && distance > 60) painted++;
  }
  return painted / (png.width * png.height);
}

async function expectIconPaints(page: Page, id: string) {
  const icon = page.locator(`svg[data-icon="${id}"]`);
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box?.width, `${id} width`).toBeGreaterThan(0);
  expect(box?.height, `${id} height`).toBeGreaterThan(0);
  // An external sprite can arrive after the first paint, so poll until the icon shows.
  await expect
    .poll(() => paintedShare(icon), { message: `${id} is blank`, timeout: 5000 })
    .toBeGreaterThan(0.02);
}

async function symbolIds(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('symbol')).map((s) => s.id));
}

async function expectNoDuplicates(ids: string[]) {
  expect(new Set(ids).size, `duplicate symbol ids in ${ids.join(', ')}`).toBe(ids.length);
}

async function addLateIcon(page: Page) {
  await page.getByRole('button', { name: 'Add icon' }).click();
  await expect(page.locator(`svg[data-icon="${lateIcon}"]`)).toBeVisible();
}

// Known WebKit (Safari) limitation: a gradient, pattern, filter, mask or clip-path that an icon
// references with url(#id) is not resolved when the icon lives in an external sprite file, so
// the icon paints blank. Inline mode is not affected. The README documents this.
function paintable(browserName: string, mode: string): string[] {
  const skipGradient = browserName === 'webkit' && mode === 'extract';
  return initialIcons.filter((id) => !(skipGradient && id === 'gradient'));
}

for (const consumer of consumers) {
  test.describe(consumer.name, () => {
    test('every icon resolves and paints', async ({ page, browserName }) => {
      const session = await open(page, consumer);
      for (const id of paintable(browserName, consumer.mode)) await expectIconPaints(page, id);
      expect(session.problems).toEqual([]);
    });

    if (consumer.mode === 'inline') {
      test('the hidden sprite holds each symbol once', async ({ page }) => {
        await open(page, consumer);
        const ids = await symbolIds(page);
        expect([...ids].sort()).toEqual([...initialIcons].sort());
        await expectNoDuplicates(ids);
        const hidden = await page.evaluate(() => {
          const sprite = document.querySelector('symbol')?.closest('svg');
          if (!sprite) return null;
          const rect = sprite.getBoundingClientRect();
          return { ariaHidden: sprite.getAttribute('aria-hidden'), width: rect.width };
        });
        expect(hidden).toEqual({ ariaHidden: 'true', width: 0 });
      });
    } else {
      test('the sprite file is requested and every <use> points at it', async ({
        page,
        browserName,
      }) => {
        const session = await open(page, consumer);
        for (const id of paintable(browserName, consumer.mode)) await expectIconPaints(page, id);
        expect(session.svgResponses).toHaveLength(1);
        const [sprite] = session.svgResponses;
        expect(sprite.status).toBe(200);
        expect(sprite.contentType).toContain('image/svg+xml');
        expect(await symbolIds(page), 'extract mode must not inline symbols').toEqual([]);

        const hrefs = await page.evaluate(() =>
          Array.from(document.querySelectorAll('svg[data-icon] use')).map((use) =>
            use.getAttribute('href'),
          ),
        );
        expect(hrefs).toHaveLength(initialIcons.length);
        for (const [index, href] of hrefs.entries()) {
          const target = new URL(href ?? '', page.url());
          expect(target.origin + target.pathname).toBe(new URL(sprite.url).href);
          expect(target.hash).toBe(`#${initialIcons[index]}`);
        }
      });
    }

    test('an icon added after load renders too', async ({ page }) => {
      const session = await open(page, consumer);
      await addLateIcon(page);
      await expectIconPaints(page, lateIcon);
      if (consumer.mode === 'inline') {
        const ids = await symbolIds(page);
        expect([...ids].sort()).toEqual([...initialIcons, lateIcon].sort());
        await expectNoDuplicates(ids);
      } else {
        expect(session.svgResponses.length).toBeGreaterThan(0);
        expect(session.svgResponses.every((r) => r.status === 200)).toBe(true);
      }
      expect(session.problems).toEqual([]);
    });

    test('has no serious or critical accessibility violations', async ({ page }) => {
      await open(page, consumer);
      await addLateIcon(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([]);
    });
  });
}
