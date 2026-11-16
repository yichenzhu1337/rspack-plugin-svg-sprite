import { describe, it, expect } from '@rstest/core';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fakeTools, git, makeRepo, run, script, tempDir, write } from './helpers';

const RELEASE = script('release', 'release.mts');
const PKG = 'rspack-plugin-svg-sprite';
const NIGHTLY =
  'gh run list --workflow nightly.yml --branch main --status completed --limit 1 --json conclusion,url';
const CHANGELOG = `# ${PKG}

## 1.2.3

### Patch Changes

- Fixed a thing.

## 1.2.2

- Older.
`;

type Fake = { out?: string; err?: string; code?: number };

// A repository that looks like the project at version 1.2.3, and fake npm and gh replies.
function project(options: { changesets?: boolean; tag?: boolean } = {}) {
  const { dir } = makeRepo({
    'package.json': JSON.stringify({ name: PKG, version: '1.2.3' }),
    'CHANGELOG.md': CHANGELOG,
    '.changeset/README.md': 'readme\n',
    ...(options.changesets ? { '.changeset/brave-owl.md': 'x\n' } : {}),
  });
  git(dir, 'tag', 'v1.2.2');
  if (options.tag) git(dir, 'tag', 'v1.2.3');
  return dir;
}

function registry(extra: Record<string, Fake> = {}) {
  return fakeTools({
    [`npm view ${PKG}@1.2.3 version`]: { code: 1 },
    [`npm view ${PKG} dist-tags.latest`]: { out: '1.2.2' },
    [`npm view ${PKG} versions --json`]: { out: JSON.stringify(['1.2.1', '1.2.2']) },
    [NIGHTLY]: {
      out: JSON.stringify([{ conclusion: 'success', url: 'https://example.test/run/1' }]),
    },
    ...extra,
  });
}

function guards(tools: ReturnType<typeof registry>, env: Record<string, string>, cwd = project()) {
  return run(RELEASE, ['guards'], {
    cwd,
    bin: tools.dir,
    env: { GITHUB_REF: 'refs/heads/main', ...env },
  });
}

describe('release.mts guards', () => {
  it('is ready on a clean main in a dry run and records version, latest and no warnings', () => {
    const result = guards(registry(), { MODE: 'dry-run' });
    expect(result.code).toBe(0);
    expect(result.outputs).toMatchObject({ version: '1.2.3', latest: '1.2.2', warnings: '[]' });
    expect(result.summary).toContain('can be released from this commit');
  });

  it('warns but continues in a dry run, and stops a publish run, on each problem', () => {
    const cases: [string, ReturnType<typeof registry>, string, string][] = [
      ['pending changeset', registry(), project({ changesets: true }), 'unreleased changeset'],
      [
        'already published',
        registry({ [`npm view ${PKG}@1.2.3 version`]: { out: '1.2.3' } }),
        project(),
        'is already on npm',
      ],
      ['existing tag', registry(), project({ tag: true }), 'tag v1.2.3 already exists'],
    ];
    for (const [, tools, cwd, text] of cases) {
      const dry = guards(tools, { MODE: 'dry-run' }, cwd);
      expect(dry.code).toBe(0);
      expect(dry.out).toContain('::warning::');
      expect(JSON.parse(dry.outputs.warnings).join(' ')).toContain(text);
      expect(dry.summary).toContain('a publish run would stop here');

      const publish = guards(tools, { MODE: 'publish' }, cwd);
      expect(publish.code).toBe(1);
      expect(publish.out).toContain('::error::');
      expect(publish.summary).toContain('cannot be released from this commit');
    }
  });

  it('stops a publish run that is not on main', () => {
    const result = guards(registry(), { MODE: 'publish', GITHUB_REF: 'refs/heads/topic' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('releases run from main only');
  });

  describe('nightly guard', () => {
    const red = registry({
      [NIGHTLY]: {
        out: JSON.stringify([{ conclusion: 'failure', url: 'https://example.test/run/9' }]),
      },
    });

    it('is a warning in a dry run', () => {
      const result = guards(red, { MODE: 'dry-run' });
      expect(result.code).toBe(0);
      expect(JSON.parse(result.outputs.warnings)[0]).toContain('latest nightly run on main failed');
    });

    it('is fatal in a publish run and names the override', () => {
      const result = guards(red, { MODE: 'publish' });
      expect(result.code).toBe(1);
      expect(result.out).toContain('https://example.test/run/9');
      expect(result.out).toContain('allow-red-nightly');
    });

    it('is only a notice when allow-red-nightly is on', () => {
      const result = guards(red, { MODE: 'publish', ALLOW_RED_NIGHTLY: 'true' });
      expect(result.code).toBe(0);
      expect(result.outputs.warnings).toBe('[]');
      expect(result.summary).toContain('continuing because allow-red-nightly is on');
    });

    it('passes when the latest completed run succeeded', () => {
      expect(guards(registry(), { MODE: 'publish' }).code).toBe(0);
    });

    it('tolerates a failing gh call with a warning', () => {
      const result = guards(registry({ [NIGHTLY]: { code: 1, err: 'HTTP 403' } }), {
        MODE: 'publish',
      });
      expect(result.code).toBe(0);
      expect(result.out).toContain('could not read the latest nightly run');
    });

    it('tolerates no runs and unreadable output', () => {
      for (const out of ['[]', 'not json']) {
        const result = guards(registry({ [NIGHTLY]: { out } }), { MODE: 'publish' });
        expect(result.code).toBe(0);
        expect(result.out).toContain('could not read the latest nightly run');
      }
    });
  });

  describe('release candidate mode', () => {
    it('computes the next free X.Y.Z-rc.N and allows pending changesets', () => {
      const tools = registry({
        [`npm view ${PKG} versions --json`]: {
          out: JSON.stringify(['1.2.2', '1.2.3-rc.1', '1.2.3-rc.2', '1.2.4-rc.7']),
        },
      });
      const result = guards(tools, { MODE: 'release-candidate' }, project({ changesets: true }));
      expect(result.code).toBe(0);
      expect(result.outputs).toMatchObject({
        version: '1.2.3-rc.3',
        latest: '1.2.2',
        warnings: '[]',
      });
    });

    it('starts at rc.1 and copes with a single published version', () => {
      const tools = registry({ [`npm view ${PKG} versions --json`]: { out: '"1.2.2"' } });
      expect(guards(tools, { MODE: 'release-candidate' }).outputs.version).toBe('1.2.3-rc.1');
      const none = registry({ [`npm view ${PKG} versions --json`]: { code: 1 } });
      expect(guards(none, { MODE: 'release-candidate' }).outputs.version).toBe('1.2.3-rc.1');
    });

    it('does not mind an existing tag or published base version', () => {
      const tools = registry({ [`npm view ${PKG}@1.2.3 version`]: { out: '1.2.3' } });
      expect(guards(tools, { MODE: 'release-candidate' }, project({ tag: true })).code).toBe(0);
    });

    it('stops when not on main', () => {
      const result = guards(registry(), {
        MODE: 'release-candidate',
        GITHUB_REF: 'refs/heads/topic',
      });
      expect(result.code).toBe(1);
      expect(result.out).toContain('releases run from main only');
    });

    it('treats a red nightly as a notice only', () => {
      const tools = registry({
        [NIGHTLY]: {
          out: JSON.stringify([{ conclusion: 'failure', url: 'https://example.test/r' }]),
        },
      });
      const result = guards(tools, { MODE: 'release-candidate' });
      expect(result.code).toBe(0);
      expect(result.summary).toContain('continuing because a release candidate');
    });
  });
});

describe('release.mts notes', () => {
  it('prints the changelog section for a version', () => {
    const result = run(RELEASE, ['notes', '1.2.3'], { cwd: project() });
    expect(result.code).toBe(0);
    expect(result.out).toContain(`## 🚀 ${PKG} v1.2.3`);
    expect(result.out).toContain(`npm i -D ${PKG}@1.2.3`);
    expect(result.out).toContain('Fixed a thing.');
    expect(result.out).not.toContain('Older.');
  });

  it('fails when the changelog has no section for the version', () => {
    const result = run(RELEASE, ['notes', '9.9.9'], { cwd: project() });
    expect(result.code).toBe(1);
    expect(result.out).toContain('CHANGELOG.md has no section for 9.9.9');
  });
});

describe('release.mts usage', () => {
  it('exits 2 and lists the commands for an unknown command', () => {
    const result = run(RELEASE, ['nope']);
    expect(result.code).toBe(2);
    expect(result.out).toContain('guards | smoke | notes | report | verify');
  });
});

describe('release.mts report', () => {
  const pack = (files: string[], size: number) =>
    JSON.stringify([
      { files: files.map((path) => ({ path })), unpackedSize: size, entryCount: files.length },
    ]);

  function report(env: Record<string, string>, cwd = project()) {
    const out = tempDir('report');
    const tools = registry({
      'npm pack /*': { out: pack(['package.json', 'dist/a.js', 'dist/new.js'], 3000) },
      [`npm pack ${PKG}@1.2.2*`]: { out: pack(['package.json', 'dist/a.js', 'dist/old.js'], 2000) },
    });
    const file = join(out, 'report.md');
    const result = run(RELEASE, ['report'], {
      cwd,
      bin: tools.dir,
      env: {
        TARBALL: join(out, 'pkg-1.2.3.tgz'),
        SHA256: 'abc123',
        GITHUB_SHA: '1234567890abcdef',
        RELEASE_REPORT: file,
        PUBLINT_OUTCOME: 'success',
        ATTW_OUTCOME: 'success',
        SMOKE_OUTCOME: 'success',
        PUBLISH_DRY_RUN_OUTCOME: 'success',
        ...env,
      },
    });
    return { ...result, text: readFileSync(file, 'utf8') };
  }

  it('renders a passing dry run', () => {
    const result = report({ MODE: 'dry-run' });
    expect(result.code).toBe(0);
    expect(result.text).toContain('> [!TIP]');
    expect(result.text).toContain('Dry run: all checks pass');
    expect(result.text).toContain('+ dist/new.js');
    expect(result.text).toContain('- dist/old.js');
    expect(result.text).toContain('`abc123`');
    expect(result.text).toContain('Fixed a thing.');
    expect(result.summary).toBe(result.text);
  });

  it('no longer prints the stale known-issues note', () => {
    const result = report({ MODE: 'dry-run' });
    expect(result.text).not.toContain('Known package issues');
    expect(result.text).not.toContain('node10');
  });

  it('renders a passing publish run that waits for approval', () => {
    const result = report({ MODE: 'publish' });
    expect(result.text).toContain('> [!IMPORTANT]');
    expect(result.text).toContain('What `publish` runs');
    expect(result.text).toContain('`git tag v1.2.3`');
    expect(result.text).toContain('approve the `publish` job');
  });

  it('renders each failed check and says nothing will be published', () => {
    const dry = report({ MODE: 'dry-run', ATTW_OUTCOME: 'failure' });
    expect(dry.text).toContain('> [!CAUTION]');
    expect(dry.text).toContain('1 check(s) failed (attw (new problems only))');
    expect(dry.text).toContain('Nothing was published, tagged or released.');
    expect(dry.text).toContain('❌ failure');
    expect(dry.out).toContain('1 check(s) failed');

    const publish = report({
      MODE: 'publish',
      SMOKE_OUTCOME: 'failure',
      PUBLINT_OUTCOME: 'failure',
    });
    expect(publish.text).toContain('2 check(s) failed');
    expect(publish.text).toContain('Nothing will be published.');
    expect(publish.text).toContain('there is nothing to approve');
  });

  it('shows skipped checks as skipped, not failed', () => {
    const result = report({ MODE: 'dry-run', SMOKE_OUTCOME: '' });
    expect(result.text).toContain('⏭️ Skipped');
    expect(result.text).toContain('> [!TIP]');
  });

  it('lists guard warnings in a passing dry run', () => {
    const result = report({ MODE: 'dry-run', GUARD_WARNINGS: '["a guard problem"]' });
    expect(result.text).toContain('> [!WARNING]');
    expect(result.text).toContain('- a guard problem');
    expect(result.text).toContain('Resolve the guard warnings above first.');
  });

  it('renders a release candidate run: next tag, no git tag, no GitHub release', () => {
    const cwd = project();
    write(cwd, 'package.json', JSON.stringify({ name: PKG, version: '1.2.3-rc.1' }));
    const result = report({ MODE: 'release-candidate' }, cwd);
    expect(result.text).toContain('> [!IMPORTANT]');
    expect(result.text).toContain('1.2.3-rc.1');
    expect(result.out).toContain('release candidate run: ');
    expect(result.text).toContain('What `publish-rc` runs');
    expect(result.text).toContain('--tag next --provenance');
    expect(result.text).toContain('No git tag and no GitHub release');
    expect(result.text).not.toContain('gh release create');
    expect(result.text).toContain('approve the `publish-rc` job');
    expect(result.text).toContain('`verify-rc`');
  });

  it('works without a published latest version', () => {
    const out = tempDir('report');
    const tools = fakeTools({
      [`npm view ${PKG} dist-tags.latest`]: { code: 1 },
      'npm pack /*': { code: 1 },
    });
    const result = run(RELEASE, ['report'], {
      cwd: project(),
      bin: tools.dir,
      env: {
        MODE: 'dry-run',
        TARBALL: join(out, 'pkg.tgz'),
        SHA256: 'abc',
        RELEASE_REPORT: join(out, 'r.md'),
      },
    });
    expect(result.code).toBe(0);
    expect(readFileSync(join(out, 'r.md'), 'utf8')).toContain('(none)');
  });
});

describe('release.mts verify', () => {
  const served = (extra: Record<string, Fake> = {}) =>
    registry({
      [`npm view ${PKG}@1.2.3 version`]: { out: '1.2.3' },
      [`npm view ${PKG} dist-tags.latest`]: { out: '1.2.3' },
      [`npm view ${PKG}@1.2.3 dist.attestations --json`]: { out: '{"url":"x"}' },
      [`npm view ${PKG}@1.2.3 dist.integrity`]: { out: 'sha512-built' },
      [`npm view ${PKG}@1.2.3 dist.shasum`]: { out: 'sha1built' },
      ...extra,
    });
  const verify = (tools: ReturnType<typeof registry>, env: Record<string, string>) =>
    run(RELEASE, ['verify', '1.2.3'], { cwd: project(), bin: tools.dir, env });

  it('fails when the integrity differs from the built tarball', () => {
    const result = verify(served(), { EXPECTED_INTEGRITY: 'sha512-other' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('dist.integrity on npm is sha512-built');
    expect(result.summary).toContain('Published bytes match the built tarball | ❌ Mismatch');
  });

  it('fails when the shasum differs from the built tarball', () => {
    const result = verify(served(), { EXPECTED_SHASUM: 'sha1other' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('dist.shasum on npm is sha1built');
  });

  it('fails when latest does not point at the version, or provenance is missing', () => {
    const latest = verify(served({ [`npm view ${PKG} dist-tags.latest`]: { out: '1.2.2' } }), {});
    expect(latest.code).toBe(1);
    expect(latest.out).toContain('dist-tag latest is 1.2.2, expected 1.2.3');
    const bare = verify(
      served({ [`npm view ${PKG}@1.2.3 dist.attestations --json`]: { code: 1 } }),
      {},
    );
    expect(bare.code).toBe(1);
    expect(bare.out).toContain('no provenance attestation');
  });

  it('checks the next tag for a release candidate and that latest did not move', () => {
    const tools = served({
      [`npm view ${PKG} dist-tags.next`]: { out: '1.2.3' },
      [`npm view ${PKG} dist-tags.latest`]: { out: '1.2.9' },
    });
    const result = verify(tools, {
      DIST_TAG: 'next',
      EXPECTED_LATEST: '1.2.2',
      EXPECTED_INTEGRITY: 'sha512-built',
    });
    expect(result.code).toBe(1);
    expect(result.out).toContain('dist-tag latest moved to 1.2.9, expected it to stay at 1.2.2');
    expect(result.out).not.toContain('dist-tag next is');
    expect(result.summary).toContain('`next` points at it | ✅ Pass');
    expect(result.summary).toContain('`latest` did not move | ❌ latest is 1.2.9');
  });

  it('fails when the next tag points elsewhere', () => {
    const tools = served({ [`npm view ${PKG} dist-tags.next`]: { out: '1.2.0' } });
    const result = verify(tools, { DIST_TAG: 'next' });
    expect(result.code).toBe(1);
    expect(result.out).toContain('dist-tag next is 1.2.0, expected 1.2.3');
  });
});
