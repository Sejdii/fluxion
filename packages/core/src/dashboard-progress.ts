import { monthChunks } from './month-chunks.js';
import { repositoryKey, type DateRange, type RepositoryRef } from './pull-request-source.js';

export interface DashboardProgress {
  fetchedMonths: number;
  totalMonths: number;
}

export type ProgressListener = (progress: DashboardProgress) => void;

export type RepositoryMonthListener = (repository: RepositoryRef, month: DateRange) => void;

export function trackMonths(ranges: DateRange[], repositories: RepositoryRef[], listener: ProgressListener): RepositoryMonthListener {
  const totalMonths = new Set(ranges.flatMap(monthChunks).map((month) => month.since)).size;
  const fetchedBy = new Map<string, Set<string>>();
  const report = (): void => {
    const fetchedMonths = [...fetchedBy.values()].filter((fetched) => fetched.size === repositories.length).length;
    listener({ fetchedMonths, totalMonths });
  };
  report();
  return (repository, month) => {
    const fetched = fetchedBy.get(month.since) ?? new Set<string>();
    const key = repositoryKey(repository);
    if (fetched.has(key)) return;
    fetchedBy.set(month.since, fetched.add(key));
    if (fetched.size === repositories.length) report();
  };
}
