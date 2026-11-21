import { Command, CommanderError } from '@commander-js/extra-typings';
import { DataError, UsageError, listFamilies, listMetricsOf, type Explanation, type MetricRequest, type MetricResult } from '@fluxion/core';
import { formatExplanation, formatExplanationJson } from './format-explanation.js';
import { formatJson } from './format-json.js';
import { formatTable } from './format-table.js';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export type RunMetric = (request: MetricRequest) => Promise<MetricResult>;

export interface ExplainRequest {
  number: number;
  repository?: string;
}

export type RunExplain = (request: ExplainRequest) => Promise<Explanation>;

export interface Runners {
  metric: RunMetric;
  explain: RunExplain;
}

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

function singleRepository(repos: string[] | undefined): string | undefined {
  const paths = (repos ?? []).flatMap((value) => value.split(',')).map((path) => path.trim()).filter((path) => path !== '');
  if (paths.length > 1) throw new UsageError(`explain works on exactly one repository, got ${paths.length}: ${paths.join(', ')}`);
  return paths[0];
}

function addExplain(family: Command, run: RunExplain, io: CliIo): void {
  family
    .command('explain')
    .description('Print every metric value of one pull request with the facts behind it')
    .argument('<number>', 'pull request number')
    .option('--json', 'print JSON instead of text')
    .option('--repos <paths...>', 'the one repository to use, as a relative path')
    .action(async (number, options) => {
      const repository = singleRepository(options.repos);
      const request: ExplainRequest = { number: parsePullRequestNumber(number), ...(repository === undefined ? {} : { repository }) };
      const explanation = await run(request);
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
    .action(async (metric, statistic, period, options) => {
      const result = await runners.metric({ family, metric, statistic, period, since: options.since, until: options.until });
      io.stdout(options.json ? formatJson({ metric, statistic, period }, result) : formatTable(metric, result.rows, result.unit));
    });
  if (family === 'pr') addExplain(command, runners.explain, io);
}

function buildProgram(runners: Runners, io: CliIo): Command {
  const program = new Command('fluxion')
    .description('Trends in how pull requests move through review')
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride()
    .addHelpText('after', allMetricsHelp());
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
