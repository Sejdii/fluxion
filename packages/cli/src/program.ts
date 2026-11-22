import { Command, CommanderError } from '@commander-js/extra-typings';
import { DataError, UsageError, listFamilies, parseWorkSchedule, listMetricsOf, type Explanation, type MetricRequest, type MetricResult, type WorkSchedule } from '@fluxion/core';
import { formatExplanation, formatExplanationJson } from './format-explanation.js';
import { formatJson } from './format-json.js';
import { formatTable } from './format-table.js';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CliMetricRequest extends MetricRequest {
  repos?: string[];
}

export type RunMetric = (request: CliMetricRequest) => Promise<MetricResult>;

export interface ExplainRequest {
  number: number;
  repos?: string[];
}

export type RunExplain = (request: ExplainRequest) => Promise<Explanation>;

export interface ServeRequest {
  port?: number;
  open: boolean;
  repos?: string[];
}

export type RunServe = (request: ServeRequest) => Promise<string>;

export interface Runners {
  metric: RunMetric;
  explain: RunExplain;
  serve: RunServe;
}

const MAX_PORT = 65535;
export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_DATA = 2;

function familyHelp(family: string): string {
  const lines = listMetricsOf(family).map((metric) => `  ${metric.id.padEnd(14)} ${metric.description} (statistics: ${metric.statistics.join(', ')})`);
  return `\nMetrics:\n${lines.join('\n')}\n`;
}

function allMetricsHelp(): string {
  return listFamilies().map((family) => `\nFamily "${family}":${familyHelp(family)}`).join('');
}

function parsePullRequestNumber(text: string): number {
  if (!/^[1-9]\d*$/.test(text)) throw new UsageError(`Invalid pull request number "${text}"`);
  return Number(text);
}

function repositoryPaths(repos: string[] | undefined): string[] {
  return (repos ?? []).flatMap((value) => value.split(',')).map((path) => path.trim()).filter((path) => path !== '');
}

function withRepos<T extends object>(request: T, repos: string[] | undefined): T & { repos?: string[] } {
  const paths = repositoryPaths(repos);
  return paths.length === 0 ? request : { ...request, repos: paths };
}

function singleRepository(repos: string[] | undefined): string[] | undefined {
  const paths = repositoryPaths(repos);
  if (paths.length > 1) throw new UsageError(`explain works on exactly one repository, got ${paths.length}: ${paths.join(', ')}`);
  return paths;
}

function parsePort(text: string): number {
  const port = Number(text);
  if (!/^\d+$/.test(text) || port > MAX_PORT) throw new UsageError(`Invalid port "${text}". Use a number from 0 to ${MAX_PORT}`);
  return port;
}

function workScheduleOf(options: { workDays?: string | undefined; workHours?: string | undefined; timezone?: string | undefined }): WorkSchedule | undefined {
  const { workDays, workHours, timezone } = options;
  if (workDays === undefined && workHours === undefined && timezone === undefined) return undefined;
  return parseWorkSchedule({ days: workDays, hours: workHours, timeZone: timezone });
}

function addDashboard(program: Command, run: RunServe, io: CliIo): void {
  program
    .option('--port <n>', 'port for the dashboard (default: any free port)')
    .option('--no-open', 'do not open the browser')
    .option('--repos <paths...>', 'repositories to show, as comma-separated relative paths (default: this repository, or all found below)')
    .action(async (options) => {
      const request = { open: options.open, ...(options.port === undefined ? {} : { port: parsePort(options.port) }) };
      const url = await run(withRepos(request, options.repos));
      io.stdout(`Fluxion dashboard: ${url}\n`);
    });
}

function addExplain(family: Command, run: RunExplain, io: CliIo): void {
  family
    .command('explain')
    .description('Print every metric value of one pull request with the facts behind it')
    .argument('<number>', 'pull request number')
    .option('--json', 'print JSON instead of text')
    .option('--repos <paths...>', 'the one repository to use, as a relative path')
    .action(async (number, options) => {
      const paths = singleRepository(options.repos);
      const explanation = await run(withRepos({ number: parsePullRequestNumber(number) }, paths));
      io.stdout(options.json ? formatExplanationJson(explanation) : formatExplanation(explanation));
    });
}

function addFamily(program: Command, family: string, runners: Runners, io: CliIo): void {
  const command = program
    .command(family)
    .description(`Metrics of the "${family}" family`)
    .addHelpText('after', familyHelp(family));
  command
    .command('query <metric> <statistic> <period>', { isDefault: true, hidden: true })
    .option('--since <date>', 'first merge date, YYYY-MM-DD (default depends on the period)')
    .option('--json', 'print JSON instead of a table')
    .option('--until <date>', 'last merge date, YYYY-MM-DD (default: today)')
    .option('--repos <paths...>', 'repositories to pool, as comma-separated relative paths (default: this repository, or all found below)')
    .option('--work-days <days>', 'measure review times in working time on these days, e.g. mon-fri or mon,wed,fri (default with any work flag: mon-fri)')
    .option('--work-hours <hours>', 'working hours as HH:MM-HH:MM (default with any work flag: 09:00-17:00)')
    .option('--timezone <zone>', 'IANA time zone of the working hours (default with any work flag: this machine)')
    .action(async (metric, statistic, period, options) => {
      const workSchedule = workScheduleOf(options);
      const request = { family, metric, statistic, period, since: options.since, until: options.until, ...(workSchedule ? { workSchedule } : {}) };
      const result = await runners.metric(withRepos(request, options.repos));
      io.stdout(options.json ? formatJson({ metric, statistic, period }, result) : formatTable(metric, result.rows, result.unit, result.workSchedule));
    });
  if (family === 'pr') addExplain(command, runners.explain, io);
}

function buildProgram(runners: Runners, io: CliIo): Command {
  const program = new Command('fluxion')
    .description('Trends in how pull requests move through review')
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride()
    .enablePositionalOptions()
    .addHelpText('after', allMetricsHelp());
  addDashboard(program, runners.serve, io);
  listFamilies().forEach((family) => addFamily(program, family, runners, io));
  return program;
}

function exitCodeOf(error: unknown, io: CliIo): number {
  if (error instanceof CommanderError) return error.exitCode === 0 ? EXIT_OK : EXIT_USAGE;
  if (!(error instanceof UsageError || error instanceof DataError)) throw error;
  io.stderr(`error: ${error.message}\n`);
  return error instanceof UsageError ? EXIT_USAGE : EXIT_DATA;
}

export async function runCli(args: string[], runners: Runners, io: CliIo): Promise<number> {
  try {
    await buildProgram(runners, io).parseAsync(args, { from: 'user' });
    return EXIT_OK;
  } catch (error) {
    return exitCodeOf(error, io);
  }
}
