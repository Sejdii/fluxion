import { hasMedian, xOf, yOf, type Frame } from './geometry.js';
import type { ChartPeriod } from './types.js';

interface MarkersProps {
  periods: ChartPeriod[];
  frame: Frame;
  max: number;
}

export function Markers({ periods, frame, max }: MarkersProps) {
  return (
    <>
      {periods.map((period, index) =>
        hasMedian(period) ? (
          <circle
            key={period.period}
            className={period.lowSample ? 'marker low-n' : period.inProgress ? 'marker in-progress' : 'marker'}
            cx={xOf(frame, periods.length, index)}
            cy={yOf(frame, max, period.median ?? 0)}
            r={4}
            fill={period.lowSample || period.inProgress ? 'var(--panel)' : 'var(--accent)'}
            stroke="var(--accent)"
            strokeOpacity={period.lowSample ? 0.45 : 1}
            strokeWidth={period.lowSample || period.inProgress ? 1.75 : 0}
          />
        ) : null,
      )}
    </>
  );
}

export function LowSampleTags({ periods, frame, max }: MarkersProps) {
  return (
    <>
      {periods.map((period, index) =>
        period.lowSample && hasMedian(period) ? (
          <text key={period.period} className="tag" x={xOf(frame, periods.length, index)} y={yOf(frame, max, period.median ?? 0) - 9} textAnchor="middle">
            low n
          </text>
        ) : null,
      )}
    </>
  );
}
