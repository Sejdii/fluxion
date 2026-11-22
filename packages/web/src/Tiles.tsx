import type { DashboardMetric, DateRange } from '@fluxion/core';
import type { ReactNode } from 'react';
import { changeOf, type ChangeContext, type Statistic } from './change.js';
import { ChangeBadge } from './ChangeBadge.js';
import { formatValue } from './format.js';
import { hasTotalAlongside, isTotal } from './metrics.js';

interface TileProps {
  label: string;
  value: string;
  statistic: Statistic;
  context: ChangeContext;
  note?: ReactNode;
}

function Tile({ label, value, statistic, context, note }: TileProps) {
  return (
    <div role="group" aria-label={label} className="tile">
      <div className="label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-change">
        <ChangeBadge change={changeOf(statistic, context)} />
        {note ? <span className="muted">{note}</span> : null}
      </div>
    </div>
  );
}

function TotalTiles({ metric, context }: { metric: DashboardMetric; context: ChangeContext }) {
  const { values } = metric.tiles.current;
  return <Tile label="Total" value={formatValue(metric.unit, values['total'])} statistic="total" context={context} />;
}

function DistributionTiles({ metric, context }: { metric: DashboardMetric; context: ChangeContext }) {
  const { n, values, lowSample } = metric.tiles.current;
  return (
    <>
      <Tile label="Median" value={formatValue(metric.unit, values['median'])} statistic="median" context={context} />
      <Tile label="p90" value={formatValue(metric.unit, values['p90'])} statistic="p90" context={context} note={lowSample ? 'low sample' : null} />
      {hasTotalAlongside(metric) ? <Tile label="Total" value={formatValue(metric.unit, values['total'])} statistic="total" context={context} /> : null}
      <Tile label="Merged PRs (n)" value={n.toLocaleString('en-US')} statistic="n" context={context} />
    </>
  );
}

interface TilesProps {
  metric: DashboardMetric;
  previousRange: DateRange;
  lowSampleThreshold: number;
}

export function Tiles({ metric, previousRange, lowSampleThreshold }: TilesProps) {
  const context = { metric, previousRange, lowSampleThreshold };
  return <div className="tiles">{isTotal(metric) ? <TotalTiles metric={metric} context={context} /> : <DistributionTiles metric={metric} context={context} />}</div>;
}
