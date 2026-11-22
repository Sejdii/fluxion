import type { ChartPeriod } from './types.js';

export interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export function runs(periods: ChartPeriod[], has: (period: ChartPeriod) => boolean): number[][] {
  const result: number[][] = [];
  periods.forEach((period, index) => {
    const last = result[result.length - 1];
    if (!has(period)) result.push([]);
    else if (last && last.length > 0 && last[last.length - 1] === index - 1) last.push(index);
    else result.push([index]);
  });
  return result.filter((run) => run.length > 0);
}

export function hasMedian(period: ChartPeriod): boolean {
  return period.n > 0 && period.median !== null;
}

export function hasP90(period: ChartPeriod): boolean {
  return hasMedian(period) && !period.lowSample && period.p90 !== null;
}

export function xOf(frame: Frame, count: number, index: number): number {
  const band = (frame.width - frame.left - frame.right) / count;
  return frame.left + band * (index + 0.5);
}

export function yOf(frame: Frame, max: number, value: number): number {
  const plotHeight = frame.height - frame.top - frame.bottom;
  return frame.height - frame.bottom - (max === 0 ? 0 : (value / max) * plotHeight);
}

export function maxOf(periods: ChartPeriod[]): number {
  return Math.max(0, ...periods.map((period) => Math.max(period.median ?? 0, period.p90 ?? 0)));
}

export function linePath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

export function bandPath(upper: Point[], lower: Point[]): string {
  return `${linePath(upper)} ${[...lower].reverse().map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')} Z`;
}

export function settled(run: number[], periods: ChartPeriod[]): { solid: number[]; pending: number[] } {
  const lastIndex = run[run.length - 1];
  const lastIsPending = lastIndex !== undefined && periods[lastIndex]?.inProgress === true;
  if (!lastIsPending) return { solid: run, pending: [] };
  return { solid: run.slice(0, -1), pending: run.slice(-2) };
}
