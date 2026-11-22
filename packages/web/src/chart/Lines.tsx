import { bandPath, hasMedian, hasP90, linePath, runs, settled, xOf, yOf, type Frame, type Point } from './geometry.js';
import type { ChartPeriod } from './types.js';

interface LinesProps {
  periods: ChartPeriod[];
  frame: Frame;
  max: number;
  weight: number;
  withP90: boolean;
}

function pointsOf({ periods, frame, max }: LinesProps, indexes: number[], pick: 'median' | 'p90'): Point[] {
  return indexes.map((index) => ({ x: xOf(frame, periods.length, index), y: yOf(frame, max, periods[index]?.[pick] ?? 0) }));
}

function MedianRun({ run, ...props }: { run: number[] } & LinesProps) {
  const { periods, weight } = props;
  const { solid, pending } = settled(run, periods);
  return (
    <>
      {solid.length > 1 ? <path className="median" d={linePath(pointsOf(props, solid, 'median'))} fill="none" stroke="var(--accent)" strokeWidth={weight} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {pending.length > 1 ? <path className="in-progress" d={linePath(pointsOf(props, pending, 'median'))} fill="none" stroke="var(--accent)" strokeWidth={weight * 0.8} strokeDasharray="4 3" /> : null}
    </>
  );
}

function P90Run({ run, ...props }: { run: number[] } & LinesProps) {
  const { weight } = props;
  const upper = pointsOf(props, run, 'p90');
  return (
    <>
      <path className="band" d={bandPath(pointsOf(props, run, 'median'), upper)} fill="var(--band)" stroke="none" />
      <path className="p90" d={linePath(upper)} fill="none" stroke="var(--accent-dim)" strokeWidth={weight * 0.6} strokeDasharray="1 4" strokeLinecap="round" />
    </>
  );
}

export function Lines(props: LinesProps) {
  const { periods, withP90 } = props;
  return (
    <>
      {withP90 ? runs(periods, hasP90).filter((run) => run.length > 1).map((run) => <P90Run key={`p90-${run[0]}`} run={run} {...props} />) : null}
      {runs(periods, hasMedian).map((run) => (
        <MedianRun key={`median-${run[0]}`} run={run} {...props} />
      ))}
    </>
  );
}
