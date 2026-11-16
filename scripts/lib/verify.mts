// Compares what npm serves with what the release workflow built.
// `expected` and `actual` are { integrity, shasum }. An expected value that is empty is not checked.
interface Integrity {
  integrity?: string | undefined;
  shasum?: string | undefined;
}
export function integrityProblems(expected: Integrity, actual: Integrity): string[] {
  const problems: string[] = [];
  if (expected.integrity && expected.integrity !== actual.integrity) {
    problems.push(
      `dist.integrity on npm is ${actual.integrity || '(empty)'}, the built tarball is ${expected.integrity}`,
    );
  }
  if (expected.shasum && expected.shasum !== actual.shasum) {
    problems.push(
      `dist.shasum on npm is ${actual.shasum || '(empty)'}, the built tarball is ${expected.shasum}`,
    );
  }
  return problems;
}
