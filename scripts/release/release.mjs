#!/usr/bin/env node
// Helpers for .github/workflows/release.yml. Run from the repository root.
//
//   guards                  can this commit be released? (MODE=publish turns problems into errors)
//   smoke <tarball|spec>    install into a fresh folder; CJS, ESM and subpath imports must work
//   notes <version>         print the CHANGELOG.md section for <version>
//   report                  write the release report (job summary + RELEASE_REPORT file)
//   verify <version>        after publishing: npm serves it, `latest` points at it, provenance,
//                           smoke test from the registry, `npm audit signatures`
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PKG = 'rspack-plugin-svg-sprite';

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}
function attempt(cmd, args, options) {
  try {
    return { ok: true, out: run(cmd, args, options) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() };
  }
}
const output = (key, value) =>
  process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
const currentVersion = () => JSON.parse(readFileSync('package.json', 'utf8')).version;
const isPublished = (version) =>
  attempt('npm', ['view', `${PKG}@${version}`, 'version']).out === version;
const pendingChangesets = () =>
  readdirSync('.changeset').filter((f) => f.endsWith('.md') && f !== 'README.md');

function guards() {
  const version = currentVersion();
  const problems = [];
  if (process.env.GITHUB_REF !== 'refs/heads/main') {
    problems.push(`releases run from main only; this run is on ${process.env.GITHUB_REF}`);
  }
  const pending = pendingChangesets();
  if (pending.length) {
    problems.push(
      `${pending.length} unreleased changeset(s): merge the "chore: version packages" PR first`,
    );
  }
  if (isPublished(version)) {
    problems.push(`${PKG}@${version} is already on npm; nothing new to publish`);
  }
  if (attempt('git', ['rev-parse', '-q', '--verify', `refs/tags/v${version}`]).ok) {
    problems.push(`tag v${version} already exists`);
  }
  output('version', version);
  output('warnings', JSON.stringify(problems));
  const fatal = process.env.MODE === 'publish';
  for (const problem of problems) console.log(`::${fatal ? 'error' : 'warning'}::${problem}`);
  if (fatal && problems.length) process.exit(1);
  console.log(
    `version ${version}: ${problems.length ? 'dry run continues despite warnings' : 'ok'}`,
  );
}

function smoke(target) {
  const dir = mkdtempSync(join(tmpdir(), 'svg-sprite-smoke-'));
  writeFileSync(join(dir, 'package.json'), '{ "private": true }\n');
  const spec = existsSync(target) ? resolve(target) : target;
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', spec], { cwd: dir });
  const checks = [
    [
      'CommonJS require',
      [
        '-e',
        `const P = require('${PKG}'); if (typeof P !== 'function' || P.SvgSpritePlugin !== P) throw new Error('unexpected export')`,
      ],
    ],
    [
      'ESM default and named import',
      [
        '--input-type=module',
        '-e',
        `import P, { SvgSpritePlugin } from '${PKG}'; if (typeof P !== 'function' || P !== SvgSpritePlugin) throw new Error('unexpected export')`,
      ],
    ],
    [
      'ESM named import of the Rsbuild plugin',
      [
        '--input-type=module',
        '-e',
        `import { pluginSvgSprite } from '${PKG}/rsbuild'; if (typeof pluginSvgSprite !== 'function') throw new Error('unexpected export')`,
      ],
    ],
    ['Loader subpath resolves', ['-e', `require.resolve('${PKG}/loader')`]],
  ];
  let failed = 0;
  for (const [name, args] of checks) {
    const result = attempt(process.execPath, args, { cwd: dir });
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${name}${result.ok ? '' : `\n${result.out}`}`);
    if (!result.ok) failed++;
  }
  if (failed) process.exit(1);
  return dir;
}

function changelogSection(version) {
  const text = readFileSync('CHANGELOG.md', 'utf8');
  const escaped = version.replace(/\./g, '\\.');
  const match = text.match(
    new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'),
  );
  return match ? match[1].trim() : null;
}

function notes(version) {
  const section = changelogSection(version);
  if (!section) {
    console.error(`CHANGELOG.md has no section for ${version}`);
    process.exit(1);
  }
  process.stdout.write(section + '\n');
}

function packInfo(spec, cwd) {
  const result = attempt('npm', ['pack', spec, '--dry-run', '--json', '--ignore-scripts'], { cwd });
  if (!result.ok) return null;
  const [info] = JSON.parse(result.out.slice(result.out.indexOf('[')));
  return {
    files: info.files.map((f) => f.path).sort(),
    size: info.unpackedSize,
    count: info.entryCount,
  };
}

const status = (outcome) =>
  outcome === 'success' ? '✅ pass' : outcome ? `❌ ${outcome}` : '⏭️ not run';
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

function report() {
  const { TARBALL, SHA256, MODE, GITHUB_SHA } = process.env;
  const version = currentVersion();
  const latest = attempt('npm', ['view', PKG, 'dist-tags.latest']).out || null;
  const warnings = JSON.parse(process.env.GUARD_WARNINGS || '[]');
  const lastTag = attempt('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*']).out;
  const commits = lastTag
    ? attempt('git', ['log', '--format=- %s (%h)', `${lastTag}..HEAD`]).out
    : '';
  const next = packInfo(resolve(TARBALL));
  const previous = latest ? packInfo(`${PKG}@${latest}`, tmpdir()) : null;
  const section = changelogSection(version);

  const out = [];
  out.push(`# Release report: ${PKG} ${version}`);
  out.push(
    MODE === 'publish'
      ? '> **Publish run.** After the checks, the `publish` job waits for your approval in the `npm-release` environment.'
      : '> **Dry run.** Nothing was published, tagged or released.',
  );
  if (warnings.length) {
    out.push(
      '',
      '**A publish run would refuse to continue:**',
      ...warnings.map((w) => `- ⚠️ ${w}`),
    );
  }
  out.push('', '| | |', '|---|---|');
  out.push(`| npm \`latest\` today | ${latest ?? '(none)'} |`);
  out.push(`| This release | **${version}** |`);
  out.push(`| Commit | \`${(GITHUB_SHA || '').slice(0, 7)}\` on main |`);
  if (next) {
    const delta = previous
      ? ` (${next.size >= previous.size ? '+' : ''}${kb(next.size - previous.size)} vs ${latest})`
      : '';
    out.push(
      `| Tarball | \`${TARBALL.split('/').pop()}\` · ${next.count} files · ${kb(next.size)}${delta} |`,
    );
  }
  out.push(`| sha256 | \`${SHA256}\` |`);

  out.push(
    '',
    '## Changelog section',
    '',
    section ?? '_No CHANGELOG.md section for this version yet._',
  );
  out.push('', `## Commits since ${lastTag || 'the first commit'}`, '', commits || '_None._');

  if (next && previous) {
    const added = next.files.filter((f) => !previous.files.includes(f));
    const removed = previous.files.filter((f) => !next.files.includes(f));
    out.push('', `## Package contents vs ${latest}`, '');
    out.push(added.length ? `Added: ${added.map((f) => `\`${f}\``).join(', ')}` : 'Added: none');
    out.push(
      '',
      removed.length ? `Removed: ${removed.map((f) => `\`${f}\``).join(', ')}` : 'Removed: none',
    );
  }

  out.push('', '## Checks', '', '| Check | Result |', '|---|---|');
  out.push(`| Full CI on this commit | ✅ pass (required before this job) |`);
  out.push(`| publint | ${status(process.env.PUBLINT_OUTCOME)} |`);
  out.push(
    `| attw (new problems only; two known ones are listed below) | ${status(process.env.ATTW_OUTCOME)} |`,
  );
  out.push(`| Import smoke test on the tarball | ${status(process.env.SMOKE_OUTCOME)} |`);
  out.push(`| \`npm publish --dry-run\` | ${status(process.env.PUBLISH_DRY_RUN_OUTCOME)} |`);
  out.push(
    '',
    'Known package issues, not blocking yet: subpath imports fail under TypeScript `moduleResolution: node10`, ' +
      'and the `/plugin`, `/loader` and `/runtime/*` subpaths expose a CommonJS `default` that ESM default imports see as an object.',
  );

  out.push('', '## What `publish` runs', '');
  out.push(`1. Verify the downloaded tarball's sha256 is \`${SHA256}\``);
  out.push(
    `2. \`npm publish ${TARBALL.split('/').pop()} --provenance --access public\` (npm trusted publishing)`,
  );
  out.push(`3. \`git tag v${version}\` on \`${(GITHUB_SHA || '').slice(0, 7)}\` and push it`);
  out.push(
    `4. \`gh release create v${version}\` with the changelog section above and the tarball attached`,
  );
  out.push(
    '5. Verify from npm: `latest` points at it, provenance is present, the import smoke test passes',
  );

  const text = out.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  writeFileSync(process.env.RELEASE_REPORT || 'release-report.md', text);
  console.log(text);
}

async function verify(version) {
  for (let i = 0; i < 40 && !isPublished(version); i++) {
    console.log('waiting for npm to serve the new version...');
    await new Promise((done) => setTimeout(done, 15000));
  }
  const problems = [];
  if (!isPublished(version)) problems.push(`npm does not serve ${PKG}@${version} after 10 minutes`);
  const latest = attempt('npm', ['view', PKG, 'dist-tags.latest']).out;
  if (latest !== version) problems.push(`dist-tag latest is ${latest}, expected ${version}`);
  const attestations = attempt('npm', ['view', `${PKG}@${version}`, 'dist.attestations', '--json']);
  if (!attestations.ok || !attestations.out)
    problems.push('no provenance attestation on the published version');
  if (problems.length) {
    for (const problem of problems) console.log(`::error::${problem}`);
    process.exit(1);
  }
  const dir = smoke(`${PKG}@${version}`);
  const signatures = attempt('npm', ['audit', 'signatures'], { cwd: dir });
  console.log(signatures.out);
  if (!signatures.ok) {
    console.log('::error::npm audit signatures failed');
    process.exit(1);
  }
  console.log(`${PKG}@${version} verified from the registry`);
}

const [command, arg] = process.argv.slice(2);
const commands = {
  guards,
  smoke: () => smoke(arg),
  notes: () => notes(arg),
  report,
  verify: () => verify(arg),
};
if (!commands[command]) {
  console.error(`usage: release.mjs <${Object.keys(commands).join(' | ')}> [arg]`);
  process.exit(2);
}
await commands[command]();
