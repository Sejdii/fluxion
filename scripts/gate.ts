import { spawnSync } from 'node:child_process';
import { checkDepcruiseOutput } from './depcruise-report.js';

function run(command: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: `${result.stdout}${result.stderr}` };
}

function step(name: string, command: string, args: string[]): void {
  console.log(`\n== ${name}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) fail(`${name} failed`);
}

function fail(message: string): never {
  console.error(`\nGATE FAILED: ${message}`);
  process.exit(1);
}

function dependencyCruiser(): void {
  console.log('\n== dependency-cruiser');
  const { stdout } = run('pnpm', ['exec', 'depcruise', 'packages', '--config', '.dependency-cruiser.mjs', '-T', 'json']);
  const problems = checkDepcruiseOutput(stdout);
  if (problems.length > 0) fail(`dependency-cruiser\n  ${problems.join('\n  ')}`);
  console.log('no dependency violations');
}

dependencyCruiser();
step('eslint', 'pnpm', ['exec', 'eslint', '.']);
step('typecheck', 'pnpm', ['exec', 'tsc', '--noEmit']);
step('unit tests', 'pnpm', ['exec', 'vitest', 'run', '--coverage']);
step('frontend build', 'pnpm', ['--filter', '@fluxion/web', 'build']);
step('playwright', 'pnpm', ['exec', 'playwright', 'test']);
console.log('\nGATE PASSED');
