import type { DashboardMetric } from '@fluxion/core';
import { Sparkline } from './chart/index.js';
import { formatChange, formatValue } from './format.js';
import { chartPeriodsOf, headlineOf, isTotal, nameOf } from './metrics.js';

interface RailProps {
  metrics: DashboardMetric[];
  selectedId: string;
  onSelect(id: string): void;
}

function RailRow({ metric, selected, onSelect }: { metric: DashboardMetric; selected: boolean; onSelect(): void }) {
  const change = formatChange(metric);
  const lowSample = metric.tiles.current.lowSample ? 'low sample' : null;
  return (
    <div role="option" aria-selected={selected} className={selected ? 'row selected' : 'row'} onClick={onSelect}>
      <span className="row-top">
        <span>{nameOf(metric)}</span>
        <span className="value">{formatValue(metric.unit, headlineOf(metric, metric.tiles.current))}</span>
      </span>
      <span className="muted">{change ?? lowSample}</span>
      <Sparkline kind={isTotal(metric) ? 'bars' : 'line'} periods={chartPeriodsOf(metric)} />
    </div>
  );
}

export function Rail({ metrics, selectedId, onSelect }: RailProps) {
  return (
    <aside className="rail">
      <div className="brand">fluxion</div>
      <div role="listbox" aria-label="Metrics" className="metric-list">
        {metrics.map((metric) => (
          <RailRow key={metric.id} metric={metric} selected={metric.id === selectedId} onSelect={() => onSelect(metric.id)} />
        ))}
      </div>
    </aside>
  );
}
