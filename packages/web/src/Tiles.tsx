import type { DashboardMetric } from '@fluxion/core';
import type { ReactNode } from 'react';
import { formatChange, formatValue } from './format.js';
import { isTotal } from './metrics.js';

function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="tile">
      <div className="label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="muted">{note}</div>
    </div>
  );
}

function TotalTiles({ metric }: { metric: DashboardMetric }) {
  const { values } = metric.tiles.current;
  return <Tile label="Total" value={formatValue(metric.unit, values['total'])} note={formatChange(metric)} />;
}

function DistributionTiles({ metric }: { metric: DashboardMetric }) {
  const { n, values, lowSample } = metric.tiles.current;
  return (
    <>
      <Tile label="Median" value={formatValue(metric.unit, values['median'])} note={formatChange(metric)} />
      <Tile label="p90" value={formatValue(metric.unit, values['p90'])} note={lowSample ? 'low sample' : null} />
      <Tile label="Merged PRs (n)" value={n.toLocaleString('en-US')} />
    </>
  );
}

export function Tiles({ metric }: { metric: DashboardMetric }) {
  return <div className="tiles">{isTotal(metric) ? <TotalTiles metric={metric} /> : <DistributionTiles metric={metric} />}</div>;
}
