import type { Dashboard } from '@fluxion/core';
import { useState } from 'react';
import { Controls } from './Controls.js';
import { Alert, Detail } from './Detail.js';
import { inRailOrder } from './metrics.js';
import { selectionKey } from './query.js';
import { Rail } from './Rail.js';
import { useDashboard } from './useDashboard.js';

const GOODHARTS_LAW_URL = 'https://lawsofsoftwareengineering.com/laws/goodharts-law/';
const LOADING_MESSAGE = 'Loading all six metrics…';

function Header() {
  return (
    <header className="app-header">
      <a className="goodhart" href={GOODHARTS_LAW_URL} target="_blank" rel="noopener">
        Goodhart’s law
      </a>
    </header>
  );
}

function Placeholder({ loading, error }: { loading: boolean; error: string | null }) {
  return (
    <main className="detail">
      {loading ? <div className="loading" aria-busy="true">{LOADING_MESSAGE}</div> : null}
      {error ? <Alert message={error} /> : null}
    </main>
  );
}

function DetailOrPlaceholder({ dashboard, selectedId, loading, error, onRefresh }: { dashboard: Dashboard | null; selectedId: string | undefined; loading: boolean; error: string | null; onRefresh(): void }) {
  const metrics = dashboard ? inRailOrder(dashboard.metrics) : [];
  const selected = metrics.find((metric) => metric.id === selectedId) ?? metrics[0];
  if (loading || !dashboard || !selected) return <Placeholder loading={loading} error={error} />;
  return <Detail dashboard={dashboard} metric={selected} error={error} onRefresh={onRefresh} />;
}

export function App() {
  const state = useDashboard();
  const [selectedId, setSelectedId] = useState<string>();
  const metrics = state.dashboard ? inRailOrder(state.dashboard.metrics) : [];
  const controls = state.query && state.dashboard ? (
    <Controls key={selectionKey(state.query)} options={state.options} applied={state.query} dayPeriodMaxMonths={state.dashboard.dayPeriodMaxMonths} today={new Date()} onApply={state.apply} />
  ) : null;
  return (
    <>
      <Header />
      <div className="shell">
        <Rail metrics={metrics} selectedId={selectedId ?? metrics[0]?.id ?? ''} onSelect={setSelectedId} controls={controls} loading={state.loading} />
        <DetailOrPlaceholder dashboard={state.dashboard} selectedId={selectedId} loading={state.loading} error={state.error} onRefresh={state.refresh} />
      </div>
    </>
  );
}
