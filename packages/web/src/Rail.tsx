import type { DashboardMetric } from '@fluxion/core';
import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { Sparkline } from './chart/index.js';
import { formatChange, formatValue } from './format.js';
import { chartPeriodsOf, headlineOf, isTotal, nameOf } from './metrics.js';

interface RailProps {
  metrics: DashboardMetric[];
  selectedId: string;
  onSelect(id: string): void;
  controls: ReactNode;
  loading: boolean;
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

function headlineValue(metric: DashboardMetric): string {
  return formatValue(metric.unit, headlineOf(metric, metric.tiles.current));
}

function changeText(metric: DashboardMetric): string | null {
  return formatChange(metric) ?? lowSampleOf(metric);
}

function accessibleName(metric: DashboardMetric): string {
  return [nameOf(metric), headlineValue(metric), changeText(metric)].filter(Boolean).join(', ');
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
        <span className="value">{headlineValue(metric)}</span>
      </span>
      <span className="muted">{changeText(metric)}</span>
      <Sparkline kind={isTotal(metric) ? 'bars' : 'line'} periods={chartPeriodsOf(metric)} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="metric-list" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((slot) => (
        <div key={slot} className="row skeleton" />
      ))}
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

function keyHandler(props: RailProps, rows: { current: (HTMLDivElement | null)[] }) {
  return (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = props.metrics.findIndex((metric) => metric.id === props.selectedId);
    const target = targetIndex(event.key, current, props.metrics.length - 1);
    const next = target === null ? undefined : props.metrics[target];
    if (target === null || !next) return;
    event.preventDefault();
    props.onSelect(next.id);
    rows.current[target]?.focus();
  };
}

export function Rail(props: RailProps) {
  const { metrics, selectedId, onSelect, controls, loading } = props;
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const onKeyDown = keyHandler(props, rows);
  return (
    <aside className="rail">
      <div className="brand">fluxion</div>
      {controls}
      {loading ? <Skeleton /> : null}
      <div role="listbox" aria-label="Metrics" className="metric-list" onKeyDown={onKeyDown} hidden={loading}>
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
