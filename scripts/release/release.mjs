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
import { sectionOf } from '../lib/changelog.mjs';
import { details, detail, fail, group, info, ok, summary, table, warn } from '../lib/output.mjs';

const PKG = 'rspack-plugin-svg-sprite';
const REPO = 'https://github.com/yichenzhu1337/rspack-plugin-svg-sprite';
const RELEASE_WORKFLOW = `${REPO}/actions/workflows/release.yml`;

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
  for (const problem of problems) console.log(`::${fatal ? 'error' : 'warning'}::⚠️ ${problem}`);
  if (fatal && problems.length) {
    summary(
      [
        '## 🔍 Release guards',
        '',
        '> [!CAUTION]',
        `> ${PKG} ${version} cannot be released from this commit.`,
        '',
        ...problems.map((p) => `- ❌ ${p}`),
      ].join('\n'),
    );
    fail(`version ${version}: ${problems.length} problem(s); a publish run stops here`);
    process.exit(1);
  }
  summary(
    [
      '## 🔍 Release guards',
      '',
      problems.length
        ? '> [!WARNING]\n> A dry run continues, but a publish run would stop here.'
        : `> [!TIP]\n> ${PKG} ${version} can be released from this commit.`,
      '',
      ...problems.map((p) => `- ⚠️ ${p}`),
    ].join('\n'),
  );
  if (problems.length) warn(`version ${version}: dry run continues despite warnings`);
  else ok(`version ${version}: ready to release`);
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
  const rows = [];
  let failed = 0;
  group(`Import smoke test: ${target}`, () => {
    for (const [name, args] of checks) {
      const result = attempt(process.execPath, args, { cwd: dir });
      if (result.ok) ok(name);
      else {
        fail(name);
        detail(result.out);
        failed++;
      }
      rows.push([name, result.ok ? '✅ Pass' : '❌ Fail']);
    }
  });
  summary(
    [
      '### 🧩 Import smoke test',
      '',
      failed
        ? `> [!CAUTION]\n> ${failed} of ${checks.length} imports failed from \`${target}\`.`
        : `> [!TIP]\n> Every import works from \`${target}\`.`,
      '',
      table(['Check', 'Result'], rows),
    ].join('\n'),
  );
  if (failed) process.exit(1);
  return dir;
}

function changelogSection(version) {
  return sectionOf(readFileSync('CHANGELOG.md', 'utf8'), version);
}

function notes(version) {
  const section = changelogSection(version);
  if (!section) {
    console.error(`CHANGELOG.md has no section for ${version}`);
    process.exit(1);
  }
  process.stdout.write(
    [
      `## 🚀 ${PKG} v${version}`,
      '',
      '```sh',
      `npm i -D ${PKG}@${version}`,
      '```',
      '',
      section,
      '',
      `🔗 [npm](https://www.npmjs.com/package/${PKG}/v/${version}) · ` +
        `[CHANGELOG.md](${REPO}/blob/main/CHANGELOG.md) · ` +
        'Published with provenance: npm shows it on the version page.',
    ].join('\n') + '\n',
  );
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
  outcome === 'success' ? '✅ Pass' : outcome ? `❌ ${outcome}` : '⏭️ Skipped';
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const list = (items) => items.map((f) => `- \`${f}\``).join('\n');

function report() {
  const { TARBALL, SHA256, MODE, GITHUB_SHA } = process.env;
  const publish = MODE === 'publish';
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
  const shortSha = (GITHUB_SHA || '').slice(0, 7);
  const tarballName = TARBALL.split('/').pop();
  const runLabel = publish ? 'Publish run' : 'Dry run';

  const checks = [
    ['Full CI on this commit', '✅ Pass (required before this job)'],
    ['publint', status(process.env.PUBLINT_OUTCOME)],
    ['attw (new problems only)', status(process.env.ATTW_OUTCOME)],
    ['Import smoke test on the tarball', status(process.env.SMOKE_OUTCOME)],
    ['`npm publish --dry-run`', status(process.env.PUBLISH_DRY_RUN_OUTCOME)],
  ];
  const failedChecks = checks.filter(([, result]) => result.startsWith('❌')).map(([name]) => name);

  const out = [];
  out.push(`## 🚀 Release report: ${PKG} ${version}`, '');
  if (failedChecks.length) {
    out.push(
      '> [!CAUTION]',
      `> ${runLabel}: ${failedChecks.length} check(s) failed (${failedChecks.join(', ')}). ` +
        (publish ? 'Nothing will be published.' : 'Nothing was published, tagged or released.'),
    );
  } else if (warnings.length) {
    out.push(
      '> [!WARNING]',
      `> ${runLabel}: checks pass, but a publish run would refuse to continue (see the guard warnings).`,
    );
  } else if (publish) {
    out.push(
      '> [!IMPORTANT]',
      '> Checks pass. The `publish` job now waits for your approval in the `npm-release` environment.',
    );
  } else {
    out.push('> [!TIP]', '> Dry run: all checks pass. Nothing was published, tagged or released.');
  }
  if (warnings.length) {
    out.push('', '### ⚠️ Guard warnings', '', ...warnings.map((w) => `- ${w}`));
  }

  const facts = [
    ['🏷️ This release', `**${version}**`],
    ['📦 npm `latest` today', latest ?? '(none)'],
    ['🔍 Commit', `\`${shortSha}\` on main`],
  ];
  if (next) {
    const delta = previous
      ? ` (${next.size >= previous.size ? '+' : ''}${kb(next.size - previous.size)} vs ${latest})`
      : '';
    facts.push([
      '📊 Tarball',
      `\`${tarballName}\` · ${next.count} files · ${kb(next.size)}${delta}`,
    ]);
  }
  facts.push(['🔒 sha256', `\`${SHA256}\``]);
  out.push('', table(['Fact', 'Value'], facts));

  out.push('', '### 🔍 Checks', '', table(['Check', 'Result'], checks));
  out.push(
    '',
    '> [!NOTE]',
    '> Known package issues, not blocking yet: subpath imports fail under TypeScript `moduleResolution: node10`, ' +
      'and the `/plugin`, `/loader` and `/runtime/*` subpaths expose a CommonJS `default` that ESM default imports see as an object.',
  );

  out.push(
    '',
    '### 📝 Changelog',
    '',
    section ?? '_No CHANGELOG.md section for this version yet._',
  );
  const commitCount = commits ? commits.split('\n').length : 0;
  out.push(
    '',
    details(
      `📄 ${commitCount} commit(s) since ${lastTag || 'the first commit'}`,
      commits || '_None._',
    ),
  );
  if (next) {
    out.push('', details(`📄 ${next.files.length} files in the package`, list(next.files)));
  }
  if (next && previous) {
    const added = next.files.filter((f) => !previous.files.includes(f));
    const removed = previous.files.filter((f) => !next.files.includes(f));
    out.push('', `### 📦 Package contents vs ${latest}`, '');
    if (added.length || removed.length) {
      out.push('```diff', ...added.map((f) => `+ ${f}`), ...removed.map((f) => `- ${f}`), '```');
    } else out.push('No files added or removed.');
  }

  out.push('', '### 🛠️ What `publish` runs', '');
  out.push(`1. Verify the downloaded tarball's sha256 is \`${SHA256}\``);
  out.push(
    `2. \`npm publish ${tarballName} --provenance --access public\` (npm trusted publishing)`,
  );
  out.push(`3. \`git tag v${version}\` on \`${shortSha}\` and push it`);
  out.push(
    `4. \`gh release create v${version}\` with the changelog section above and the tarball attached`,
  );
  out.push(
    '5. Verify from npm: `latest` points at it, provenance is present, the import smoke test passes',
  );

  out.push('', '### 💡 Next', '');
  if (failedChecks.length) {
    out.push(
      `- Fix the failed checks, then run [Release](${RELEASE_WORKFLOW}) again with \`dry-run\`.`,
      publish
        ? '- This run stops before `publish`; there is nothing to approve.'
        : '- Publishing stays off until a dry run is green.',
    );
  } else if (publish) {
    out.push(
      '- Review this report, then approve the `publish` job in the `npm-release` environment.',
      '- Reject it to stop. Nothing is published before you approve.',
      '- After publishing, the `verify` job checks npm, provenance and the install.',
    );
  } else {
    if (warnings.length) out.push('- Resolve the guard warnings above first.');
    out.push(
      `- Happy with it? Run [Release](${RELEASE_WORKFLOW}) again with \`publish\`, then approve it.`,
      '- Nothing has shipped yet.',
    );
  }

  const text = out.join('\n') + '\n';
  summary(text);
  writeFileSync(process.env.RELEASE_REPORT || 'release-report.md', text);
  group('Release report', () => {
    console.log(`${runLabel.toLowerCase()}: ${PKG} ${version}`);
    for (const [name, result] of checks) console.log(`${result}  ${name.replace(/`/g, '')}`);
    for (const w of warnings) warn(w);
    if (failedChecks.length) fail(`${failedChecks.length} check(s) failed`);
    else ok('all checks pass');
    detail(`report written to ${process.env.RELEASE_REPORT || 'release-report.md'}`);
  });
}

async function verify(version) {
  for (let i = 0; i < 40 && !isPublished(version); i++) {
    info('waiting for npm to serve the new version...');
    await new Promise((done) => setTimeout(done, 15000));
  }
  const problems = [];
  const served = isPublished(version);
  if (!served) problems.push(`npm does not serve ${PKG}@${version} after 10 minutes`);
  const latest = attempt('npm', ['view', PKG, 'dist-tags.latest']).out;
  if (latest !== version) problems.push(`dist-tag latest is ${latest}, expected ${version}`);
  const attestations = attempt('npm', ['view', `${PKG}@${version}`, 'dist.attestations', '--json']);
  const provenance = attestations.ok && Boolean(attestations.out);
  if (!provenance) problems.push('no provenance attestation on the published version');
  const finish = (signatures) => {
    const failed = problems.length > 0 || signatures.startsWith('❌');
    summary(
      [
        `## 🔍 Verify from npm: ${PKG} ${version}`,
        '',
        failed
          ? '> [!CAUTION]\n> The published version failed verification. Check the rows below.'
          : '> [!TIP]\n> Published, tagged `latest`, with provenance, and installable.',
        '',
        table(
          ['Check', 'Result'],
          [
            ['npm serves the version', served ? '✅ Pass' : '❌ Fail'],
            ['`latest` points at it', latest === version ? '✅ Pass' : `❌ latest is ${latest}`],
            ['Provenance attestation', provenance ? '✅ Pass' : '❌ Missing'],
            ['`npm audit signatures`', signatures],
          ],
        ),
        '',
        `🔗 [npm version page](https://www.npmjs.com/package/${PKG}/v/${version})`,
      ].join('\n'),
    );
  };
  if (problems.length) {
    for (const problem of problems) console.log(`::error::❌ ${problem}`);
    finish('⏭️ Skipped');
    process.exit(1);
  }
  ok(`npm serves ${PKG}@${version}, latest points at it, provenance is present`);
  const dir = smoke(`${PKG}@${version}`);
  const signatures = attempt('npm', ['audit', 'signatures'], { cwd: dir });
  group('npm audit signatures', () => console.log(signatures.out));
  if (!signatures.ok) {
    console.log('::error::❌ npm audit signatures failed');
    finish('❌ Fail');
    process.exit(1);
  }
  finish('✅ Pass');
  ok(`${PKG}@${version} verified from the registry`);
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
