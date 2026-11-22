import { xOf, yOf, type Frame } from './geometry.js';
import type { ChartPeriod } from './types.js';

interface BarsProps {
  periods: ChartPeriod[];
  frame: Frame;
  max: number;
  pick(period: ChartPeriod): number;
  className: string;
}

const BAR_FILL = 0.6;

export function Bars({ periods, frame, max, pick, className }: BarsProps) {
  const width = ((frame.width - frame.left - frame.right) / periods.length) * BAR_FILL;
  const baseline = frame.height - frame.bottom;
  return (
    <>
      {periods.map((period, index) => {
        const top = yOf(frame, max, pick(period));
        if (baseline - top <= 0) return null;
        const style = period.inProgress ? { fill: 'none', stroke: 'var(--accent)', strokeDasharray: '3 2' } : { fill: 'var(--bar)' };
        return <rect key={period.period} className={className} x={xOf(frame, periods.length, index) - width / 2} y={top} width={width} height={baseline - top} rx={2} {...style} />;
      })}
    </>
  );
}
