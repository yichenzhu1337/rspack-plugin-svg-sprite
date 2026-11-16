import { describe, it, expect } from '@rstest/core';
import fs from 'fs';
import path from 'path';

/**
 * Keeps the guarantees map from rotting. Every row of the table in `.github/GUARANTEES.md`
 * either names the tests that enforce it, or says `not enforced`. A named test file must exist
 * and its source must still contain the quoted text from the test title.
 */

const ROOT = process.cwd();
const MAP = path.join(ROOT, '.github', 'GUARANTEES.md');
const REFERENCE = /`([^`]+)` › "([^"]+)"/g;

interface Row {
  area: string;
  guarantee: string;
  status: string;
  enforcedBy: string;
}

function readRows(): Row[] {
  const rows: Row[] = [];
  for (const line of fs.readFileSync(MAP, 'utf8').split('\n')) {
    if (!line.startsWith('| ')) continue;
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    if (cells.length !== 4) continue;
    if (cells[0] === 'Area' || /^-+$/.test(cells[0] ?? '')) continue;
    rows.push({
      area: cells[0] ?? '',
      guarantee: cells[1] ?? '',
      status: cells[2] ?? '',
      enforcedBy: cells[3] ?? '',
    });
  }
  return rows;
}

const rows = readRows();

describe('guarantees map', () => {
  it('lists the guarantees of the package', () => {
    expect(rows.length).toBeGreaterThan(40);
    for (const row of rows) {
      expect(row.area).not.toBe('');
      expect(row.guarantee).not.toBe('');
    }
  });

  it('marks every row either enforced or not enforced', () => {
    for (const row of rows) {
      const enforced = row.status.startsWith('✅') && row.status.includes('Enforced');
      const notEnforced = row.status.startsWith('⚠️') && row.status.includes('not enforced');
      expect({ guarantee: row.guarantee, ok: enforced || notEnforced }).toEqual({
        guarantee: row.guarantee,
        ok: true,
      });
    }
  });

  it('gives every enforced row at least one test reference, and a not-enforced row none', () => {
    for (const row of rows) {
      const refs = [...row.enforcedBy.matchAll(REFERENCE)];
      const enforced = row.status.startsWith('✅');
      expect({ guarantee: row.guarantee, hasRefs: refs.length > 0 }).toEqual({
        guarantee: row.guarantee,
        hasRefs: enforced,
      });
    }
  });

  it('only references test files and test names that still exist', () => {
    const missing: string[] = [];
    for (const row of rows) {
      for (const [, file, fragment] of row.enforcedBy.matchAll(REFERENCE)) {
        const abs = path.join(ROOT, file as string);
        if (!/\.(test|spec)\.ts$/.test(file as string) || !fs.existsSync(abs)) {
          missing.push('missing test file ' + file);
        } else if (!fs.readFileSync(abs, 'utf8').includes(fragment as string)) {
          missing.push(file + ' no longer contains "' + fragment + '"');
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('is not skipped past a table row it cannot parse', () => {
    const tableLines = fs
      .readFileSync(MAP, 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('| ') && line.split(/(?<!\\)\|/).length === 6);
    // header + one line per guarantee (the separator line starts with "| ---")
    expect(tableLines.filter((l) => !l.startsWith('| ---')).length).toBe(rows.length + 1);
  });
});
