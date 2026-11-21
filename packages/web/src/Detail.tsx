import type { Dashboard, DashboardMetric } from '@fluxion/core';
import { useState } from 'react';
import { DataTable } from './DataTable.js';
import { nameOf } from './metrics.js';
import { Tiles } from './Tiles.js';

const GOODHARTS_LAW_URL = 'https://lawsofsoftwareengineering.com/laws/goodharts-law/';

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
        <a className="goodhart" href={GOODHARTS_LAW_URL} target="_blank" rel="noopener">
          Goodhart’s law
        </a>
      </div>
      <Status dashboard={dashboard} />
      {dashboard.n === 0 ? <div className="empty">No merged PRs in this range</div> : <Body key={metric.id} metric={metric} />}
    </main>
  );
}
