import type { Dashboard, DashboardProgress } from '@fluxion/core';
import { useRef, useState } from 'react';
import { Controls } from './Controls.js';
import { Alert, Detail } from './Detail.js';
import { DetailSkeleton } from './Loading.js';
import { inRailOrder } from './metrics.js';
import { selectionKey } from './query.js';
import { Rail } from './Rail.js';
import { useDashboard, type DashboardActions, type DashboardState } from './useDashboard.js';

const FALLBACK_DAY_PERIOD_MAX_MONTHS = 12;
const GOODHARTS_LAW_URL = 'https://lawsofsoftwareengineering.com/laws/goodharts-law/';

function Header() {
  return (
    <header className="app-header">
      <a className="goodhart" href={GOODHARTS_LAW_URL} target="_blank" rel="noopener">
        Goodhart’s law
      </a>
    </header>
  );
}

function ErrorPane({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <main className="detail">
      <div className="error-row">
        <Alert message={message} />
        <button className="retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    </main>
  );
}

function DetailPane({ dashboard, selectedId, loading, error, notice, pullRequestCount, progress, onRefresh, onRetry, onCancel }: { progress: DashboardProgress | null; onCancel(): void; pullRequestCount: number | null; dashboard: Dashboard | null; selectedId: string | undefined; loading: boolean; error: string | null; notice: string | null; onRefresh(): void; onRetry(): void }) {
  if (loading) return <DetailSkeleton pullRequestCount={pullRequestCount} progress={progress} onCancel={onCancel} />;
  if (error) return <ErrorPane message={error} onRetry={onRetry} />;
  const metrics = dashboard ? inRailOrder(dashboard.metrics) : [];
  const selected = metrics.find((metric) => metric.id === selectedId) ?? metrics[0];
  if (!dashboard || !selected) return <main className="detail" />;
  return <Detail dashboard={dashboard} metric={selected} notice={notice} onRefresh={onRefresh} />;
}

function AppControls({ state }: { state: DashboardState & DashboardActions }) {
  const seen = useRef(false);
  if (state.dashboard || state.error) seen.current = true;
  if (!state.query || !seen.current) return null;
  const maxMonths = state.dashboard?.dayPeriodMaxMonths ?? FALLBACK_DAY_PERIOD_MAX_MONTHS;
  return <Controls key={selectionKey(state.query)} options={state.options} applied={state.query} dayPeriodMaxMonths={maxMonths} today={new Date()} onApply={state.apply} disabled={state.loading} />;
}

export function App() {
  const state = useDashboard();
  const [selectedId, setSelectedId] = useState<string>();
  const showing = state.loading || state.error ? null : state.dashboard;
  const metrics = showing ? inRailOrder(showing.metrics) : [];
  const controls = <AppControls state={state} />;
  return (
    <>
      <Header />
      <div className="shell">
        <Rail metrics={metrics} selectedId={selectedId ?? metrics[0]?.id ?? ''} onSelect={setSelectedId} controls={controls} loading={state.loading} />
        <DetailPane dashboard={state.dashboard} selectedId={selectedId} loading={state.loading} error={state.error} notice={state.notice} pullRequestCount={state.pullRequestCount} progress={state.progress} onCancel={state.cancel} onRefresh={state.refresh} onRetry={state.retry} />
      </div>
    </>
  );
}
