import type { DashboardMetric } from '@fluxion/core';
import { headlineOf } from './metrics.js';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const HOURS_SHOWN_AS_DAYS = 48;
const ONE_DECIMAL = 10;
const PERCENT = 100;
const NO_VALUE = '—';

function hours(value: number): string {
  if (value < 1) return `${Math.round(value * MINUTES_PER_HOUR)}m`;
  if (value >= HOURS_SHOWN_AS_DAYS) return `${(value / HOURS_PER_DAY).toFixed(1)}d`;
  return `${value < ONE_DECIMAL ? value.toFixed(1) : Math.round(value)}h`;
}

export function formatValue(unit: string | undefined, value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_VALUE;
  if (unit === 'hours') return hours(value);
  return Number.isInteger(value) ? value.toLocaleString('en-US') : String(Math.round(value * ONE_DECIMAL) / ONE_DECIMAL);
}

export function formatChange(metric: DashboardMetric): string | null {
  const { current, previous } = metric.tiles;
  const now = headlineOf(metric, current);
  const before = headlineOf(metric, previous);
  if (current.lowSample || previous.lowSample || now === null || !before) return null;
  const percent = Math.round(((now - before) / before) * PERCENT);
  return percent > 0 ? `+${percent}%` : `${percent}%`;
}
