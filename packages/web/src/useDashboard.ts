import type { Dashboard, DashboardProgress, RepositoryOption } from '@fluxion/core';
import { useCallback, type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDashboard, fetchPullRequestCount, fetchRepositories, type LoadOptions } from './api.js';
import { defaultQuery, queryKey, startingQuery, type Query } from './query.js';
import { loadSchedule, saveSchedule } from './schedule-storage.js';

function browserStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

export interface DashboardState {
  options: RepositoryOption[];
  query: Query | null;
  dashboard: Dashboard | null;
  error: string | null;
  loading: boolean;
  notice: string | null;
  pullRequestCount: number | null;
  progress: DashboardProgress | null;
}

export interface DashboardActions {
  apply(query: Query): void;
  refresh(): void;
  retry(): void;
  cancel(): void;
}

const INITIAL: DashboardState = { options: [], query: null, dashboard: null, error: null, loading: true, notice: null, pullRequestCount: null, progress: null };
const CANCELLED_MESSAGE = 'Loading cancelled.';

async function resolveDashboard(cache: Map<string, Dashboard>, query: Query, refresh: boolean, options: LoadOptions): Promise<Dashboard> {
  const key = queryKey(query);
  const cached = refresh ? undefined : cache.get(key);
  if (cached) return cached;
  const dashboard = await fetchDashboard(query, refresh, options);
  cache.set(key, dashboard);
  return dashboard;
}

type SetState = Dispatch<SetStateAction<DashboardState>>;
type Load = (query: Query, refresh: boolean) => void;

interface Loader {
  load: Load;
  cancel(): void;
}

interface Ticket {
  signal: AbortSignal;
  apply(change: Partial<DashboardState>): void;
}

function useTickets(setState: SetState): { next(): Ticket; drop(): void } {
  const latest = useRef(0);
  const running = useRef(new AbortController());
  return useMemo(() => {
    const drop = () => {
      latest.current += 1;
      running.current.abort();
    };
    const next = (): Ticket => {
      drop();
      running.current = new AbortController();
      const ticket = latest.current;
      const apply = (change: Partial<DashboardState>) => {
        if (ticket === latest.current) setState((previous) => ({ ...previous, ...change }));
      };
      return { signal: running.current.signal, apply };
    };
    return { next, drop };
  }, [setState]);
}

function loadInto(ticket: Ticket, cache: Map<string, Dashboard>, query: Query, refresh: boolean): void {
  const settled = (dashboard: Dashboard) => {
    if (query.workSchedule !== undefined) saveSchedule(browserStorage(), query.workSchedule);
    const resolved = query.workSchedule === undefined ? { ...query, workSchedule: dashboard.workSchedule ?? null } : query;
    ticket.apply({ loading: false, dashboard, query: resolved });
  };
  fetchPullRequestCount(query).then(
    (pullRequestCount) => ticket.apply({ pullRequestCount }),
    () => undefined,
  );
  const onProgress = (progress: DashboardProgress) => ticket.apply({ progress });
  resolveDashboard(cache, query, refresh, { signal: ticket.signal, onProgress }).then(settled, (error: Error) => ticket.apply({ loading: false, error: error.message }));
}

function useLoader(cache: Map<string, Dashboard>, setState: SetState): Loader {
  const tickets = useTickets(setState);
  const load = useCallback<Load>(
    (query, refresh) => {
      setState((previous) => ({ ...previous, query, loading: true, error: null, pullRequestCount: null, progress: null }));
      loadInto(tickets.next(), cache, query, refresh);
    },
    [cache, setState, tickets],
  );
  const cancel = useCallback(() => {
    tickets.drop();
    setState((previous) => ({ ...previous, loading: false, error: CANCELLED_MESSAGE }));
  }, [setState, tickets]);
  return { load, cancel };
}

function useStart(setState: SetState, load: Load): () => void {
  const start = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    fetchRepositories().then(
      async (options) => {
        const schedule = loadSchedule(browserStorage());
        const today = new Date();
        const repos = options.map((option) => option.path);
        const count = await fetchPullRequestCount(defaultQuery(repos, today)).catch(() => null);
        const starting = startingQuery(repos, today, count);
        const query = { ...starting.query, ...(schedule === undefined ? {} : { workSchedule: schedule }) };
        setState((previous) => ({ ...previous, options, notice: starting.notice }));
        load(query, false);
      },
      (error: Error) => setState((previous) => ({ ...previous, loading: false, error: error.message })),
    );
  }, [load, setState]);
  useEffect(start, [start]);
  return start;
}

export function useDashboard(): DashboardState & DashboardActions {
  const cache = useRef(new Map<string, Dashboard>()).current;
  const [state, setState] = useState<DashboardState>(INITIAL);
  const { load, cancel } = useLoader(cache, setState);
  const start = useStart(setState, load);
  const apply = useCallback(
    (query: Query) => {
      setState((previous) => ({ ...previous, notice: null }));
      load(query, false);
    },
    [load],
  );
  const refresh = useCallback(() => {
    cache.clear();
    if (state.query) load(state.query, true);
  }, [cache, load, state.query]);
  const { query } = state;
  const retry = useCallback(() => (query ? load(query, false) : start()), [load, query, start]);
  return { ...state, apply, refresh, retry, cancel };
}
