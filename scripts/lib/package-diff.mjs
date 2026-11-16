// Pure helpers behind scripts/ci/package-check.mjs and scripts/ci/determinism-check.mjs.

// `- file` for entries only in `expected`, `+ file` for entries only in `actual`, sorted by name.
export function lineDiff(expected, actual) {
  const exp = new Set(expected);
  const act = new Set(actual);
  const lines = [];
  for (const f of expected) if (!act.has(f)) lines.push(`- ${f}`);
  for (const f of actual) if (!exp.has(f)) lines.push(`+ ${f}`);
  return lines.sort((a, b) => a.slice(2).localeCompare(b.slice(2)));
}

// One row per size: the measured value, its budget and whether it fits.
export function checkBudgets(info, budget) {
  return [
    { label: 'Packed', key: 'packed', value: info.size },
    { label: 'Unpacked', key: 'unpacked', value: info.unpackedSize },
  ].map((row) => ({ ...row, budget: budget[row.key], ok: row.value <= budget[row.key] }));
}

// Names whose content differs between two { name: hash } maps, or that exist on one side only.
export function differingFiles(a, b) {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((name) => a[name] !== b[name]).sort();
}
