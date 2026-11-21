import type { MetricRow } from '@fluxion/core';

export function formatTable(metric: string, rows: MetricRow[]): string {
  const cells = [['period', metric, 'n'], ...rows.map((r) => [r.period, r.value === null ? '-' : String(r.value), String(r.n)])];
  const widths = [0, 1, 2].map((column) => Math.max(...cells.map((row) => (row[column] ?? '').length)));
  return cells.map((row) => row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ').trimEnd()).join('\n') + '\n';
}
