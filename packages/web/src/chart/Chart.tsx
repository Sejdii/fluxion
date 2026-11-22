import { useState } from 'react';
import { Bars } from './Bars.js';
import { maxOf, xOf, yOf, type Frame } from './geometry.js';
import { Lines } from './Lines.js';
import { LowSampleTags, Markers } from './Markers.js';
import { Tooltip } from './Tooltip.js';
import type { ChartPeriod, ChartProps } from './types.js';

const FRAME: Frame = { width: 720, height: 280, left: 52, right: 10, top: 18, bottom: 22 };
const COUNT_BARS_HEIGHT = 30;
const GRID_LINES = 4;
const MEDIAN_WEIGHT = 2.5;

function countOf(period: ChartPeriod): number {
  return period.commentTotal ?? period.n;
}

function medianOf(period: ChartPeriod): number {
  return period.median ?? 0;
}

function Grid({ max, format }: { max: number; format(value: number | null): string }) {
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => (max / GRID_LINES) * index);
  return (
    <>
      {ticks.map((tick, index) => (
        <g key={index}>
          <line x1={FRAME.left} x2={FRAME.width - FRAME.right} y1={yOf(FRAME, max, tick)} y2={yOf(FRAME, max, tick)} stroke="var(--line)" />
          <text className="axis" x={FRAME.left - 8} y={yOf(FRAME, max, tick) + 4} textAnchor="end">
            {format(tick)}
          </text>
        </g>
      ))}
    </>
  );
}

function Hover({ periods, onHover }: { periods: ChartPeriod[]; onHover(index: number | null): void }) {
  const band = (FRAME.width - FRAME.left - FRAME.right) / periods.length;
  return (
    <>
      {periods.map((period, index) => (
        <rect key={period.period} x={xOf(FRAME, periods.length, index) - band / 2} y={0} width={band} height={FRAME.height} fill="transparent" onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(null)} />
      ))}
    </>
  );
}

function Plot({ kind, periods, max }: { kind: ChartProps['kind']; periods: ChartPeriod[]; max: number }) {
  const countsFrame: Frame = { ...FRAME, top: FRAME.height - FRAME.bottom - COUNT_BARS_HEIGHT };
  const maxN = Math.max(1, ...periods.map(countOf));
  if (kind === 'bars') return <Bars periods={periods} frame={FRAME} max={max} pick={medianOf} className="count-bar" />;
  return (
    <>
      <Bars periods={periods} frame={countsFrame} max={maxN} pick={countOf} className="n-bar" />
      <Lines periods={periods} frame={FRAME} max={max} weight={MEDIAN_WEIGHT} withP90 />
      <Markers periods={periods} frame={FRAME} max={max} />
      <LowSampleTags periods={periods} frame={FRAME} max={max} />
    </>
  );
}

export function Chart({ kind, periods, label, barsLabel, format }: ChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, maxOf(periods));
  const active = hovered === null ? undefined : periods[hovered];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} role="img" aria-label={label}>
        <Grid max={max} format={format} />
        <Plot kind={kind} periods={periods} max={max} />
        <Hover periods={periods} onHover={setHovered} />
      </svg>
      {barsLabel ? <div className="chart-caption">{barsLabel}</div> : null}
      {active && hovered !== null ? <Tooltip period={active} format={format} showP90={kind === 'line'} leftPercent={(xOf(FRAME, periods.length, hovered) / FRAME.width) * 100} /> : null}
    </div>
  );
}
