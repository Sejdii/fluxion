import type { Dashboard, DashboardMetric } from '@fluxion/core';
import { useState } from 'react';
import { Chart } from './chart/index.js';
import { DataTable } from './DataTable.js';
import { formatValue } from './format.js';
import { chartPeriodsOf, isTotal, nameOf } from './metrics.js';
import { Tiles } from './Tiles.js';

function repositoriesNote(repositories: string[]): string {
  return repositories.length > 1 ? `pooled from ${repositories.length} repositories` : (repositories[0] ?? '');
}

function Status({ dashboard, onRefresh }: { dashboard: Dashboard; onRefresh(): void }) {
  const fetched = new Date(dashboard.fetchedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' });
  return (
    <div className="status">
      <span>{repositoriesNote(dashboard.repositories)}</span>
      <span>
        {dashboard.range.since} to {dashboard.range.until}
      </span>
      <span>{dashboard.n.toLocaleString('en-US')} merged PRs</span>
      <span>fetched {fetched} UTC</span>
      <button className="link-button" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}

function Body({ metric }: { metric: DashboardMetric }) {
  const [showData, setShowData] = useState(false);
  return (
    <>
      <Tiles metric={metric} />
      <Chart kind={isTotal(metric) ? 'bars' : 'line'} periods={chartPeriodsOf(metric)} label={`${nameOf(metric)} per period`} format={(value) => formatValue(metric.unit, value)} />
      {showData ? <DataTable metric={metric} /> : null}
      <button className="link-button" onClick={() => setShowData(!showData)}>
        {showData ? 'Hide data' : 'View data'}
      </button>
    </>
  );
}

interface DetailProps {
  dashboard: Dashboard;
  metric: DashboardMetric;
  error: string | null;
  onRefresh(): void;
}

export function Detail({ dashboard, metric, error, onRefresh }: DetailProps) {
  return (
    <main className="detail">
      <div className="detail-head">
        <h1>{nameOf(metric)}</h1>
      </div>
      {error ? <Alert message={error} /> : null}
      <Status dashboard={dashboard} onRefresh={onRefresh} />
      {dashboard.n === 0 ? <div className="empty">No merged PRs in this range</div> : <Body key={metric.id} metric={metric} />}
    </main>
  );
}

export function Alert({ message }: { message: string }) {
  return (
    <div className="error" role="alert">
      {message}
    </div>
  );
}
