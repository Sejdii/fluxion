import { isLowSample } from './low-sample.js';

const P90_RANK = 0.9;
const DECIMALS = 100;

function meanOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number): number {
  return Math.round(value * DECIMALS) / DECIMALS;
}

function median(sorted: number[]): number {
  return meanOf(sorted.slice(Math.ceil(sorted.length / 2) - 1, Math.floor(sorted.length / 2) + 1));
}

function p90(sorted: number[]): number {
  const rank = Math.ceil(P90_RANK * sorted.length);
  return meanOf(sorted.slice(rank - 1, rank));
}

export function summarize(values: number[], statistic: string): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (statistic === 'p90') return isLowSample(values.length) ? null : rounded(p90(sorted));
  return rounded(median(sorted));
}
