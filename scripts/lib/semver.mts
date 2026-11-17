// Tiny SemVer helpers for the release scripts. No dependencies.
const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export interface Version {
  major: number;
  minor: number;
  patch: number;
  pre: string | null;
}

export function parse(version: string): Version | null {
  const match = PATTERN.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
  };
}

export const isPrerelease = (version: string) => parse(version)?.pre != null;

// Negative when a < b. Numeric parts first; a release sorts after its own prereleases.
export function compare(a: string, b: string): number {
  const x = parse(a) as Version;
  const y = parse(b) as Version;
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (x[key] !== y[key]) return x[key] - y[key];
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  // Dot-separated identifiers: numbers compare as numbers and sort before text (rc.9 < rc.10).
  const a1 = x.pre.split('.');
  const b1 = y.pre.split('.');
  for (let i = 0; i < Math.min(a1.length, b1.length); i++) {
    if (a1[i] === b1[i]) continue;
    const an = /^\d+$/.test(a1[i]);
    const bn = /^\d+$/.test(b1[i]);
    if (an && bn) return Number(a1[i]) - Number(b1[i]);
    if (an !== bn) return an ? -1 : 1;
    return a1[i] < b1[i] ? -1 : 1;
  }
  return a1.length - b1.length;
}

// The release candidate that comes next for `base`: X.Y.Z-rc.N, N one above the highest taken.
export function nextRc(base: string, published: string[]): string {
  const { major, minor, patch } = parse(base) as Version;
  const stem = `${major}.${minor}.${patch}-rc.`;
  let highest = 0;
  for (const version of published) {
    if (!version.startsWith(stem)) continue;
    const n = Number(version.slice(stem.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${stem}${highest + 1}`;
}
