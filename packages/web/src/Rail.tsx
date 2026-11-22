import type { DashboardMetric } from '@fluxion/core';
import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { Sparkline } from './chart/index.js';
import { formatChange, formatValue } from './format.js';
import { chartPeriodsOf, headlineOf, isTotal, nameOf } from './metrics.js';

interface RailProps {
  metrics: DashboardMetric[];
  selectedId: string;
  onSelect(id: string): void;
}

interface RowProps {
  metric: DashboardMetric;
  selected: boolean;
  onSelect(): void;
  setRef(element: HTMLDivElement | null): void;
}

function lowSampleOf(metric: DashboardMetric): string | null {
  return metric.tiles.current.lowSample ? 'low sample' : null;
}

function accessibleName(metric: DashboardMetric): string {
  const value = formatValue(metric.unit, headlineOf(metric, metric.tiles.current));
  return [nameOf(metric), value, formatChange(metric), lowSampleOf(metric)].filter(Boolean).join(', ');
}

function RailRow({ metric, selected, onSelect, setRef }: RowProps) {
  return (
    <div
      ref={setRef}
      role="option"
      aria-selected={selected}
      aria-label={accessibleName(metric)}
      tabIndex={selected ? 0 : -1}
      className={selected ? 'row selected' : 'row'}
      onClick={onSelect}
    >
      <span className="row-top">
        <span>{nameOf(metric)}</span>
        <span className="value">{formatValue(metric.unit, headlineOf(metric, metric.tiles.current))}</span>
      </span>
      <span className="muted">{formatChange(metric) ?? lowSampleOf(metric)}</span>
      <Sparkline kind={isTotal(metric) ? 'bars' : 'line'} periods={chartPeriodsOf(metric)} />
    </div>
  );
}

function targetIndex(key: string, current: number, last: number): number | null {
  if (key === 'ArrowDown') return Math.min(current + 1, last);
  if (key === 'ArrowUp') return Math.max(current - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

export function Rail({ metrics, selectedId, onSelect }: RailProps) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = metrics.findIndex((metric) => metric.id === selectedId);
    const target = targetIndex(event.key, current, metrics.length - 1);
    const next = target === null ? undefined : metrics[target];
    if (target === null || !next) return;
    event.preventDefault();
    onSelect(next.id);
    rows.current[target]?.focus();
  };
  return (
    <aside className="rail">
      <div className="brand">fluxion</div>
      <div role="listbox" aria-label="Metrics" className="metric-list" onKeyDown={onKeyDown}>
        {metrics.map((metric, index) => (
          <RailRow
            key={metric.id}
            metric={metric}
            selected={metric.id === selectedId}
            onSelect={() => onSelect(metric.id)}
            setRef={(element) => {
              rows.current[index] = element;
            }}
          />
        ))}
      </div>
    </aside>
  );
}
