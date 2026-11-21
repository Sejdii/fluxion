import type { Dashboard } from '@fluxion/core';
import { useEffect, useState } from 'react';
import { fetchDashboard } from './api.js';

export type DashboardState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; dashboard: Dashboard };

export function useDashboard(): DashboardState {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });
  useEffect(() => {
    fetchDashboard().then(
      (dashboard) => setState({ status: 'ready', dashboard }),
      (error: Error) => setState({ status: 'error', message: error.message }),
    );
  }, []);
  return state;
}
