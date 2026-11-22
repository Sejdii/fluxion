import type { Dashboard, RepositoryOption } from '@fluxion/core';
import { useCallback, type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { fetchDashboard, fetchRepositories } from './api.js';
import { defaultQuery, queryKey, type Query } from './query.js';

export interface DashboardState {
  options: RepositoryOption[];
  query: Query | null;
  dashboard: Dashboard | null;
  error: string | null;
  loading: boolean;
}

export interface DashboardActions {
  apply(query: Query): void;
  refresh(): void;
}

const INITIAL: DashboardState = { options: [], query: null, dashboard: null, error: null, loading: true };

async function resolveDashboard(cache: Map<string, Dashboard>, query: Query, refresh: boolean): Promise<Dashboard> {
  const key = queryKey(query);
  const cached = refresh ? undefined : cache.get(key);
  if (cached) return cached;
  const dashboard = await fetchDashboard(query, refresh);
  cache.set(key, dashboard);
  return dashboard;
}

type SetState = Dispatch<SetStateAction<DashboardState>>;
type Load = (query: Query, refresh: boolean) => void;

function useLoader(cache: Map<string, Dashboard>, setState: SetState): Load {
  const latest = useRef(0);
  return useCallback(
    (query, refresh) => {
      const ticket = ++latest.current;
      const settle = (change: Partial<DashboardState>) => {
        if (ticket === latest.current) setState((previous) => ({ ...previous, loading: false, ...change }));
      };
      setState((previous) => ({ ...previous, loading: true, error: null }));
      resolveDashboard(cache, query, refresh).then(
        (dashboard) => settle({ dashboard, query }),
        (error: Error) => settle({ error: error.message }),
      );
    },
    [cache, setState],
  );
}

function useStartingLoad(setState: SetState, load: Load): void {
  useEffect(() => {
    fetchRepositories().then(
      (options) => {
        const query = defaultQuery(options.map((option) => option.path), new Date());
        setState((previous) => ({ ...previous, options, query }));
        load(query, false);
      },
      (error: Error) => setState((previous) => ({ ...previous, loading: false, error: error.message })),
    );
  }, [load, setState]);
}

export function useDashboard(): DashboardState & DashboardActions {
  const cache = useRef(new Map<string, Dashboard>()).current;
  const [state, setState] = useState<DashboardState>(INITIAL);
  const load = useLoader(cache, setState);
  useStartingLoad(setState, load);
  const apply = useCallback((query: Query) => load(query, false), [load]);
  const refresh = useCallback(() => {
    cache.clear();
    if (state.query) load(state.query, true);
  }, [cache, load, state.query]);
  return { ...state, apply, refresh };
}
