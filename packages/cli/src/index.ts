import { isLowSample } from '@fluxion/core';

export const cliReady = !isLowSample(5);
export { startInMemoryDashboard } from './config.js';
export type { InMemoryDashboard } from './config.js';
