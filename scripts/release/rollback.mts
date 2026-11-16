#!/usr/bin/env node
// Rolls the `latest` dist-tag back and deprecates a bad release.
//
//   node scripts/release/rollback.mts <bad-version> [--to <good-version>] [--execute]
//
// Without --execute it only prints what it would do. With --execute it runs the two npm commands,
// which needs the maintainer's own npm login (`npm whoami` must work, with 2FA when it is on).
// <good-version> defaults to the highest published, non-prerelease version below <bad-version>.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compare, isPrerelease, parse } from '../lib/semver.mts';
import { bold, dim, fail, info, ok, warn } from '../lib/output.mts';

const PKG = 'rspack-plugin-svg-sprite';
const REPO = 'https://github.com/yichenzhu1337/rspack-plugin-svg-sprite';

// The highest published release (no prerelease) that is lower than `bad`, or null.
export function pickGoodVersion(bad: string, published: string[]): string | null {
  const candidates = published
    .filter((v) => parse(v) && !isPrerelease(v) && compare(v, bad) < 0)
    .sort(compare);
  return candidates.at(-1) ?? null;
}

export function deprecationMessage(bad: string, good: string): string {
  return `${bad} has a defect and was rolled back. Use ${good} instead.`;
}

// The two npm commands, as argument lists.
export function plan(bad: string, good: string): string[][] {
  return [
    ['dist-tag', 'add', `${PKG}@${good}`, 'latest'],
    ['deprecate', `${PKG}@${bad}`, deprecationMessage(bad, good)],
  ];
}

export function checklist(bad: string, good: string): string[] {
  return [
    `Check from npm: \`npm view ${PKG} dist-tags\` shows latest = ${good}.`,
    `Check the install: \`npm i ${PKG}@latest\` in a scratch folder resolves to ${good}.`,
    `Mark the GitHub release v${bad} as a pre-release or edit its notes: ${REPO}/releases/tag/v${bad}`,
    'Open an issue that explains what was wrong, and link it from the deprecation.',
    'Fix forward: add a changeset on main and release a new patch version through the Release workflow.',
    `Do not unpublish ${bad}: npm keeps it installable by exact version and unpublishing breaks lockfiles.`,
  ];
}

const shell = (args: string[]) =>
  `npm ${args.map((a: string) => (/^[\w./:=@-]+$/.test(a) ? a : JSON.stringify(a))).join(' ')}`;

function publishedVersions(): string[] {
  const out = execFileSync('npm', ['view', PKG, 'versions', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [parsed];
}

interface Args {
  bad: string | null;
  to: string | null;
  execute: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { bad: null, to: null, execute: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--execute') args.execute = true;
    else if (argv[i] === '--to') args.to = argv[++i] ?? null;
    else if (!args.bad) args.bad = argv[i];
    else throw new Error(`unexpected argument: ${argv[i]}`);
  }
  return args;
}

export function main(argv: string[]): number {
  const usage = 'usage: rollback.mts <bad-version> [--to <good-version>] [--execute]';
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`${(error as Error).message}\n${usage}`);
    return 2;
  }
  if (!args.bad || !parse(args.bad) || (args.to !== null && !parse(args.to))) {
    console.error(usage);
    return 2;
  }
  let published: string[];
  try {
    published = publishedVersions();
  } catch {
    fail(`could not read the published versions of ${PKG} from npm`);
    return 1;
  }
  if (!published.includes(args.bad)) {
    fail(`${PKG}@${args.bad} is not published, so there is nothing to roll back`);
    return 1;
  }
  const good = args.to ?? pickGoodVersion(args.bad, published);
  if (!good) {
    fail(`no published release below ${args.bad} to roll back to; pass --to <version>`);
    return 1;
  }
  if (!published.includes(good)) {
    fail(`${PKG}@${good} is not published`);
    return 1;
  }
  if (good === args.bad) {
    fail('the version to roll back to is the bad version');
    return 1;
  }

  const commands = plan(args.bad, good);
  console.log(bold(`Rollback: ${PKG} ${args.bad} -> ${good}`));
  console.log('');
  console.log(args.execute ? 'Running:' : 'Dry run. This would run:');
  for (const command of commands) console.log(`  ${shell(command)}`);
  console.log('');
  console.log('Then, by hand:');
  for (const [i, step] of checklist(args.bad, good).entries()) console.log(`  ${i + 1}. ${step}`);

  if (!args.execute) {
    console.log('');
    info(dim('Nothing was changed. Add --execute to run the npm commands.'));
    return 0;
  }
  console.log('');
  for (const command of commands) {
    try {
      execFileSync('npm', command, { stdio: 'inherit' });
      ok(shell(command));
    } catch {
      fail(`${shell(command)} failed. Fix the cause (npm login, 2FA) and run it again.`);
      return 1;
    }
  }
  warn('Now work through the checklist above.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
