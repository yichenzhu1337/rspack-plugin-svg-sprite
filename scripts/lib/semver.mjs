// Tiny SemVer helpers for the release scripts. No dependencies.
const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parse(version) {
  const match = PATTERN.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
  };
}

export const isPrerelease = (version) => parse(version)?.pre != null;

// Negative when a < b. Numeric parts first; a release sorts after its own prereleases.
export function compare(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (x[key] !== y[key]) return x[key] - y[key];
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

// The release candidate that comes next for `base`: X.Y.Z-rc.N, N one above the highest taken.
export function nextRc(base, published) {
  const { major, minor, patch } = parse(base);
  const stem = `${major}.${minor}.${patch}-rc.`;
  let highest = 0;
  for (const version of published) {
    if (!version.startsWith(stem)) continue;
    const n = Number(version.slice(stem.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${stem}${highest + 1}`;
}
