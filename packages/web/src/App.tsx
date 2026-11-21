import type { Dashboard } from '@fluxion/core';
import { useState } from 'react';
import { Detail } from './Detail.js';
import { inRailOrder } from './metrics.js';
import { Rail } from './Rail.js';
import { useDashboard } from './useDashboard.js';

function Loaded({ dashboard }: { dashboard: Dashboard }) {
  const metrics = inRailOrder(dashboard.metrics);
  const [selectedId, setSelectedId] = useState(metrics[0]?.id);
  const selected = metrics.find((metric) => metric.id === selectedId) ?? metrics[0];
  if (!selected) return null;
  return (
    <div className="shell">
      <Rail metrics={metrics} selectedId={selected.id} onSelect={setSelectedId} />
      <Detail dashboard={dashboard} metric={selected} />
    </div>
  );
}

export function App() {
  const state = useDashboard();
  if (state.status === 'loading') return <div className="loading" aria-busy="true">Loading all six metrics…</div>;
  if (state.status === 'error') return <div className="error" role="alert">{state.message}</div>;
  return <Loaded dashboard={state.dashboard} />;
}
