#!/usr/bin/env node
// Launcher for `pnpm link --global`: the sources are TypeScript, so register tsx first.
import { register } from 'tsx/esm/api';

register();
await import('../src/bin.ts');
