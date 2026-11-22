import type { Dashboard, DashboardMetric } from '@fluxion/core';
import { useState } from 'react';
import { Chart } from './chart/index.js';
import { DataTable } from './DataTable.js';
import { formatValue } from './format.js';
import { chartPeriodsOf, isTotal, nameOf } from './metrics.js';
import { Tiles } from './Tiles.js';

function Status({ dashboard }: { dashboard: Dashboard }) {
  const fetched = new Date(dashboard.fetchedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' });
  return (
    <div className="status">
      <span>
        {dashboard.range.since} to {dashboard.range.until}
      </span>
      <span>{dashboard.n.toLocaleString('en-US')} merged PRs</span>
      <span>fetched {fetched} UTC</span>
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

export function Detail({ dashboard, metric }: { dashboard: Dashboard; metric: DashboardMetric }) {
  return (
    <main className="detail">
      <div className="detail-head">
        <h1>{nameOf(metric)}</h1>
      </div>
      <Status dashboard={dashboard} />
      {dashboard.n === 0 ? <div className="empty">No merged PRs in this range</div> : <Body key={metric.id} metric={metric} />}
    </main>
  );
}
