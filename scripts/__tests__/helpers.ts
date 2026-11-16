// Shared helpers for the script tests: throwaway directories and repositories, and fake `npm` and
// `gh` commands. Nothing here touches the network.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const ROOT = resolve(process.cwd());
export const script = (...parts: string[]) => join(ROOT, 'scripts', ...parts);
const FAKE = script('__tests__', 'fake-cli.mts');

export const tempDir = (label = 'script-test') =>
  mkdtempSync(join(tmpdir(), `svg-sprite-${label}-`));

export function write(dir: string, file: string, content: string) {
  const full = join(dir, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

const IDENTITY = {
  GIT_AUTHOR_NAME: 'Test Author',
  GIT_AUTHOR_EMAIL: 'author@example.test',
  GIT_COMMITTER_NAME: 'Test Author',
  GIT_COMMITTER_EMAIL: 'author@example.test',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

export function git(dir: string, ...args: string[]) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...IDENTITY },
  }).trim();
}

// A repository on `main` with one commit holding `files`. Returns its path and the base commit.
export function makeRepo(files: Record<string, string> = { 'README.md': '# demo\n' }) {
  const dir = tempDir('repo');
  git(dir, 'init', '-q', '-b', 'main');
  for (const [file, content] of Object.entries(files)) write(dir, file, content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  return { dir, base: git(dir, 'rev-parse', 'HEAD') };
}

export function commit(dir: string, files: Record<string, string>, message = 'change') {
  for (const [file, content] of Object.entries(files)) write(dir, file, content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}

type Fake = { out?: string; err?: string; code?: number };

// A bin folder with fake `npm` and `gh`. `responses` maps "<tool> <args>" to a reply.
export function fakeTools(responses: Record<string, Fake>) {
  const dir = tempDir('bin');
  const responsesFile = join(dir, 'responses.json');
  const logFile = join(dir, 'calls.log');
  writeFileSync(responsesFile, JSON.stringify(responses));
  writeFileSync(logFile, '');
  for (const name of ['npm', 'gh']) {
    const shim = join(dir, name);
    writeFileSync(
      shim,
      `#!/bin/sh\nFAKE_NAME=${name} FAKE_RESPONSES='${responsesFile}' FAKE_LOG='${logFile}' exec '${process.execPath}' '${FAKE}' "$@"\n`,
    );
    chmodSync(shim, 0o755);
  }
  return { dir, calls: () => readFileSync(logFile, 'utf8').split('\n').filter(Boolean) };
}

export type Result = {
  code: number;
  out: string;
  summary: string;
  outputs: Record<string, string>;
};

// Runs a script with a clean environment. Returns its exit code, its output, and what it wrote to
// the job summary and to the workflow output file.
export function run(
  file: string,
  args: string[] = [],
  options: { cwd?: string; env?: Record<string, string>; bin?: string; bash?: boolean } = {},
): Result {
  const scratch = tempDir('run');
  const summaryFile = join(scratch, 'summary.md');
  const outputFile = join(scratch, 'output.txt');
  writeFileSync(summaryFile, '');
  writeFileSync(outputFile, '');
  const env: Record<string, string> = { NO_COLOR: '1', ...IDENTITY };
  for (const key of ['HOME', 'TMPDIR', 'LANG']) {
    if (process.env[key]) env[key] = process.env[key] as string;
  }
  env.PATH = `${options.bin ? `${options.bin}:` : ''}${dirname(process.execPath)}:/usr/bin:/bin`;
  env.GITHUB_STEP_SUMMARY = summaryFile;
  env.GITHUB_OUTPUT = outputFile;
  Object.assign(env, options.env);
  const result = spawnSync(options.bash ? 'bash' : process.execPath, [file, ...args], {
    cwd: options.cwd ?? ROOT,
    env,
    encoding: 'utf8',
  });
  const outputs: Record<string, string> = {};
  for (const line of readFileSync(outputFile, 'utf8').split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) outputs[line.slice(0, at)] = line.slice(at + 1);
  }
  return {
    code: result.status ?? -1,
    out: `${result.stdout}${result.stderr}`,
    summary: existsSync(summaryFile) ? readFileSync(summaryFile, 'utf8') : '',
    outputs,
  };
}
