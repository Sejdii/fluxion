#!/usr/bin/env -S pnpm exec tsx
import { createRunMetric } from './config.js';
import { runCli } from './program.js';

const run = createRunMetric(process.cwd(), () => new Date());
process.exitCode = await runCli(process.argv.slice(2), run, {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
