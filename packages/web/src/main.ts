import type { LOW_SAMPLE_THRESHOLD } from '@fluxion/core';

export type Threshold = typeof LOW_SAMPLE_THRESHOLD;

const root = document.getElementById('root');
if (root) root.textContent = 'Fluxion';
