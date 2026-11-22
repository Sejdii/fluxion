import { cruise } from 'dependency-cruiser';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import config from '../../../.dependency-cruiser.mjs';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'chart-boundary-'));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}

async function violations(files: Record<string, string>): Promise<string[]> {
  const root = project(files);
  const result = await cruise(['packages'], { baseDir: root, validate: true, ruleSet: config });
  const output = result.output as { summary: { violations: { rule: { name: string } }[] } };
  return output.summary.violations.map((violation) => violation.rule.name);
}

const CHART = {
  'packages/web/src/chart/index.ts': "export { draw } from './draw.js';",
  'packages/web/src/chart/draw.ts': 'export const draw = 1;',
};

test('importingTheChartIndexIsAllowed', async () => {
  const found = await violations({ ...CHART, 'packages/web/src/Detail.ts': "import { draw } from './chart/index.js';\nexport const x = draw;" });

  expect(found).toEqual([]);
});

test('importingChartInternalsFailsTheDependencyRule', async () => {
  const found = await violations({ ...CHART, 'packages/web/src/Detail.ts': "import { draw } from './chart/draw.js';\nexport const x = draw;" });

  expect(found).toEqual(['chart-module-only-via-index']);
});
