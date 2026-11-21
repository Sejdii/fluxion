import { Command, CommanderError } from '@commander-js/extra-typings';
import { DataError, UsageError, listFamilies, listMetricsOf, type MetricRequest, type MetricResult } from '@fluxion/core';
import { formatTable } from './format-table.js';

export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export type RunMetric = (request: MetricRequest) => Promise<MetricResult>;

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

function addFamily(program: Command, family: string, run: RunMetric, io: CliIo): void {
  program
    .command(family)
    .description(`Metrics of the "${family}" family`)
    .argument('<metric>', 'metric id')
    .argument('<statistic>', 'statistic to compute')
    .argument('<period>', 'period to group by')
    .option('--since <date>', 'first merge date, YYYY-MM-DD (default: 90 days ago)')
    .option('--until <date>', 'last merge date, YYYY-MM-DD (default: today)')
    .addHelpText('after', familyHelp(family))
    .action(async (metric, statistic, period, options) => {
      const result = await run({ family, metric, statistic, period, since: options.since, until: options.until });
      io.stdout(formatTable(metric, result.rows));
    });
}

function buildProgram(run: RunMetric, io: CliIo): Command {
  const program = new Command('fluxion')
    .description('Trends in how pull requests move through review')
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride()
    .addHelpText('after', allMetricsHelp());
  listFamilies().forEach((family) => addFamily(program, family, run, io));
  return program;
}

function exitCodeOf(error: unknown, io: CliIo): number {
  if (error instanceof CommanderError) return error.exitCode === 0 ? EXIT_OK : EXIT_USAGE;
  if (!(error instanceof UsageError || error instanceof DataError)) throw error;
  io.stderr(`error: ${error.message}\n`);
  return error instanceof UsageError ? EXIT_USAGE : EXIT_DATA;
}

/** Runs the command line and returns the process exit code. */
export async function runCli(args: string[], run: RunMetric, io: CliIo): Promise<number> {
  try {
    await buildProgram(run, io).parseAsync(args, { from: 'user' });
    return EXIT_OK;
  } catch (error) {
    return exitCodeOf(error, io);
  }
}
