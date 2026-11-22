export interface ChartPeriod {
  period: string;
  n: number;
  median: number | null;
  p90: number | null;
  lowSample: boolean;
  inProgress: boolean;
}

export type ChartKind = 'line' | 'bars';

export interface ChartProps {
  kind: ChartKind;
  periods: ChartPeriod[];
  label: string;
  format(value: number | null): string;
}

export interface SparklineProps {
  kind: ChartKind;
  periods: ChartPeriod[];
}
