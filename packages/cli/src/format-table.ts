import type { MetricRow, WorkSchedule } from '@fluxion/core';

function valueCell(row: MetricRow): string {
  if (row.value === null) return '-';
  return row.lowSample ? `${row.value} (low n)` : String(row.value);
}

function periodCell(row: MetricRow): string {
  return row.inProgress ? `${row.period} (in progress)` : row.period;
}

function scheduleLine(schedule: WorkSchedule): string {
  return `working time: ${schedule.days.join(',')} ${schedule.start}-${schedule.end} ${schedule.timeZone}\n`;
}

export function formatTable(metric: string, rows: MetricRow[], unit?: string, schedule?: WorkSchedule): string {
  const heading = unit ? `${metric} (${unit})` : metric;
  const cells = [['period', heading, 'n'], ...rows.map((r) => [periodCell(r), valueCell(r), String(r.n)])];
  const widths = [0, 1, 2].map((column) => Math.max(...cells.map((row) => (row[column] ?? '').length)));
  const table = cells.map((row) => row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ').trimEnd()).join('\n') + '\n';
  return schedule ? scheduleLine(schedule) + table : table;
}
