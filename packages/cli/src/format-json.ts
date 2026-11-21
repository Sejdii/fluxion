import type { MetricResult } from '@fluxion/core';

interface Query {
  metric: string;
  statistic: string;
  period: string;
}

export function formatJson(query: Query, result: MetricResult): string {
  return `${JSON.stringify({ ...query, ...result }, null, 2)}\n`;
}
