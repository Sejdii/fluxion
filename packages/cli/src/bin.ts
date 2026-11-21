#!/usr/bin/env -S pnpm exec tsx
import { createRunners } from './config.js';
import { runCli } from './program.js';

const runners = createRunners(process.cwd(), () => new Date());
process.exitCode = await runCli(process.argv.slice(2), runners, {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
