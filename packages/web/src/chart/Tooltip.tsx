import type { ChartPeriod } from './types.js';

interface TooltipProps {
  period: ChartPeriod;
  format(value: number | null): string;
  showP90: boolean;
  leftPercent: number;
}

function tag(period: ChartPeriod): string {
  if (period.inProgress) return ' · in progress';
  return period.lowSample ? ' · low n' : '';
}

export function Tooltip({ period, format, showP90, leftPercent }: TooltipProps) {
  const hasP90 = showP90 && !period.lowSample;
  return (
    <div role="tooltip" className="chart-tooltip" style={{ left: `${leftPercent}%` }}>
      <div className="label">
        {period.period}
        {tag(period)}
      </div>
      <div>{showP90 ? 'Median' : 'Total'} {format(period.median)}</div>
      {hasP90 ? <div>p90 {format(period.p90)}</div> : null}
      <div>n {period.n}</div>
    </div>
  );
}
