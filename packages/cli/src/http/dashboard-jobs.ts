import { randomUUID } from 'node:crypto';
import type { Dashboard, DashboardProgress, ProgressListener } from '@fluxion/core';

const MAX_FINISHED_JOBS = 20;

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
    const job: Job = { id: randomUUID(), progress: null, outcome: null, settled: Promise.resolve() };
    job.settled = query((progress) => (job.progress = progress)).then(
      (dashboard) => this.finish(job, { dashboard }),
      (error: unknown) => this.finish(job, { error }),
    );
    this.jobs.set(job.id, job);
    return job;
  }

  find(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  private finish(job: Job, outcome: JobOutcome): void {
    job.outcome = outcome;
    this.jobs.delete(job.id);
    this.jobs.set(job.id, job);
    this.forgetEarliestFinished();
  }

  private forgetEarliestFinished(): void {
    const finished = [...this.jobs.values()].filter((job) => job.outcome !== null);
    finished.slice(0, -MAX_FINISHED_JOBS).forEach((job) => this.jobs.delete(job.id));
  }
}

export async function settledWithin(job: Job, milliseconds: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, milliseconds)));
  await Promise.race([job.settled, timeout]);
  clearTimeout(timer);
}
