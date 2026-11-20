import { isLowSample } from '@fluxion/core';

export const cliReady = !isLowSample(5);
