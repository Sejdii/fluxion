import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createRunners } from '../src/config.js';
import { runCli } from '../src/program.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'fluxion-cli-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

test('commandOutsideAGitRepositoryExitsWith2AndExplainsOnStderr', async () => {
  let stderr = '';
  const runners = createRunners(workDir, () => new Date('2026-03-20T10:00:00Z'));

  const code = await runCli(['pr', 'prsMerged', 'total', 'monthly'], runners, { stdout: () => undefined, stderr: (t) => (stderr += t) });

  expect({ code, stderr }).toEqual({ code: 2, stderr: `error: ${workDir} is not inside a git repository\n` });
});

test('usageMistakeOutsideAGitRepositoryStillExitsWith1', async () => {
  const runners = createRunners(workDir, () => new Date('2026-03-20T10:00:00Z'));

  const code = await runCli(['pr', 'nope', 'total', 'monthly'], runners, { stdout: () => undefined, stderr: () => undefined });

  expect(code).toBe(1);
});
