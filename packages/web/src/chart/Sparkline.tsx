import { Bars } from './Bars.js';
import { hasMedian, maxOf, runs, xOf, yOf, type Frame } from './geometry.js';
import { Lines } from './Lines.js';
import type { SparklineProps } from './types.js';

const FRAME: Frame = { width: 200, height: 34, left: 4, right: 4, top: 4, bottom: 4 };
const WEIGHT = 1.75;
const DOT_RADIUS = 2;

function IsolatedDots({ periods, max }: { periods: SparklineProps['periods']; max: number }) {
  const singles = runs(periods, hasMedian).filter((run) => run.length === 1);
  return (
    <>
      {singles.map(([index]) => (
        <circle key={index} className="spark-dot" cx={xOf(FRAME, periods.length, index ?? 0)} cy={yOf(FRAME, max, periods[index ?? 0]?.median ?? 0)} r={DOT_RADIUS} fill="var(--accent)" />
      ))}
    </>
  );
}

export function Sparkline({ kind, periods }: SparklineProps) {
  const max = maxOf(periods);
  return (
    <svg className="sparkline" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} aria-hidden="true" focusable="false">
      {kind === 'bars' ? (
        <Bars periods={periods} frame={FRAME} max={max} pick={(period) => period.median ?? 0} className="spark-bar" />
      ) : (
        <>
          <Lines periods={periods} frame={FRAME} max={max} weight={WEIGHT} withP90={false} />
          <IsolatedDots periods={periods} max={max} />
        </>
      )}
    </svg>
  );
}
