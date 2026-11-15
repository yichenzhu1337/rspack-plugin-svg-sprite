// The CHANGELOG.md section for one version, or null when there is none.
// Plain line scan: the version is compared as text, never compiled into a pattern.
export function sectionOf(text, version) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `## ${version}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}
