import { randomUUID } from 'node:crypto';
import type { Dashboard, DashboardProgress, ProgressListener } from '@fluxion/core';

const MAX_UNCOLLECTED_JOBS = 20;

export type JobOutcome = { dashboard: Dashboard } | { error: unknown };

export interface Job {
  id: string;
  progress: DashboardProgress | null;
  outcome: JobOutcome | null;
  settled: Promise<void>;
}

export class DashboardJobs {
  private readonly jobs = new Map<string, Job>();

  start(query: (onProgress: ProgressListener) => Promise<Dashboard>): Job {
    this.forgetOldestUncollected();
    const job: Job = { id: randomUUID(), progress: null, outcome: null, settled: Promise.resolve() };
    job.settled = query((progress) => (job.progress = progress)).then(
      (dashboard) => void (job.outcome = { dashboard }),
      (error: unknown) => void (job.outcome = { error }),
    );
    this.jobs.set(job.id, job);
    return job;
  }

  find(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  forget(job: Job): void {
    this.jobs.delete(job.id);
  }

  private forgetOldestUncollected(): void {
    const settled = [...this.jobs.values()].filter((job) => job.outcome !== null);
    settled.slice(0, Math.max(0, settled.length - MAX_UNCOLLECTED_JOBS + 1)).forEach((job) => this.forget(job));
  }
}

export async function settledWithin(job: Job, milliseconds: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, milliseconds)));
  await Promise.race([job.settled, timeout]);
  clearTimeout(timer);
}
