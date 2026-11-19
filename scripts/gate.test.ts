import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { checkDepcruiseOutput } from './depcruise-report.js';

const root = resolve(import.meta.dirname, '..');

function cruise(files: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'fluxion-dc-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  cpSync(join(root, '.dependency-cruiser.cjs'), join(dir, '.dependency-cruiser.cjs'));
  cpSync(join(root, 'tsconfig.json'), join(dir, 'tsconfig.json'));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  const result = spawnSync(
    join(root, 'node_modules/.bin/depcruise'),
    ['packages', '--config', '.dependency-cruiser.cjs', '-T', 'json'],
    { cwd: dir, encoding: 'utf8' },
  );
  return checkDepcruiseOutput(result.stdout + result.stderr);
}

test('coreImportingNodeBuiltinFailsGate', () => {
  const problems = cruise({ 'packages/core/src/a.ts': "import { readFileSync } from 'node:fs';\nexport const a = readFileSync;\n" });

  expect(problems.join()).toContain('core-no-node-builtins');
});

test('coreImportingAdaptersFailsGate', () => {
  const problems = cruise({
    'packages/core/src/a.ts': "import { b } from '../../adapters/src/b.js';\nexport const a = b;\n",
    'packages/adapters/src/b.ts': 'export const b = 1;\n',
  });

  expect(problems.join()).toContain('core-imports-nothing-outward');
});

test('adapterFoldersImportingEachOtherFailsGate', () => {
  const problems = cruise({
    'packages/adapters/src/github/a.ts': "import { b } from '../git/b.js';\nexport const a = b;\n",
    'packages/adapters/src/git/b.ts': 'export const b = 1;\n',
  });

  expect(problems.join()).toContain('adapter-folders-isolated');
});

test('webImportingAdaptersFailsGate', () => {
  const problems = cruise({
    'packages/web/src/a.ts': "import { b } from '../../adapters/src/b.js';\nexport const a = b;\n",
    'packages/adapters/src/b.ts': 'export const b = 1;\n',
  });

  expect(problems.join()).toContain('only-cli-imports-adapters');
});

test('webImportingCoreValuesFailsGate', () => {
  const problems = cruise({
    'packages/web/src/a.ts': "import { b } from '../../core/src/b.js';\nexport const a = b;\n",
    'packages/core/src/b.ts': 'export const b = 1;\n',
  });

  expect(problems.join()).toContain('web-imports-only-types-from-core');
});

test('webImportingCoreTypesPassesGate', () => {
  const problems = cruise({
    'packages/web/src/a.ts': "import type { B } from '../../core/src/b.js';\nexport type A = B;\n",
    'packages/core/src/b.ts': 'export type B = number;\n',
  });

  expect(problems).toEqual([]);
});

test('importCycleFailsGate', () => {
  const problems = cruise({
    'packages/core/src/a.ts': "import { b } from './b.js';\nexport const a = b;\n",
    'packages/core/src/b.ts': "import { a } from './a.js';\nexport const b = a;\n",
  });

  expect(problems.join()).toContain('no-cycles');
});

test('chartInternalsImportedFromOutsideFailsGate', () => {
  const problems = cruise({
    'packages/web/src/a.ts': "import { b } from './chart/internal.js';\nexport const a = b;\n",
    'packages/web/src/chart/internal.ts': 'export const b = 1;\n',
  });

  expect(problems.join()).toContain('chart-module-only-via-index');
});

test('cruisingZeroModulesFailsGate', () => {
  const problems = checkDepcruiseOutput('{"summary":{"totalCruised":0,"violations":[]}}');

  expect(problems).toEqual(['dependency-cruiser cruised zero modules']);
});

test('missingTscTranspilerFailsGate', () => {
  const problems = checkDepcruiseOutput('missing-tsc-transpiler {"summary":{"totalCruised":3,"violations":[]}}');

  expect(problems).toEqual(['dependency-cruiser reported missing-tsc-transpiler']);
});

test('outputWithoutJsonFailsGate', () => {
  const problems = checkDepcruiseOutput('boom');

  expect(problems).toEqual(['dependency-cruiser produced no JSON report']);
});
