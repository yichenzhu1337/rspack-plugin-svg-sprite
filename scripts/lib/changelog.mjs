// The CHANGELOG.md section for one version, or null when there is none.
export function sectionOf(text, version) {
  const escaped = version.replace(/\./g, '\\.');
  const match = text.match(
    new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'),
  );
  return match ? match[1].trim() : null;
}
