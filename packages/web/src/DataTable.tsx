import type { DashboardMetric, DashboardRow } from '@fluxion/core';
import { formatValue } from './format.js';
import { isTotal } from './metrics.js';

function periodOf(row: DashboardRow): string {
  return row.inProgress ? `${row.period} (in progress)` : row.period;
}

function TotalRow({ row }: { row: DashboardRow }) {
  return (
    <tr>
      <td>{periodOf(row)}</td>
      <td>{row.n}</td>
    </tr>
  );
}

function DistributionRow({ row, unit }: { row: DashboardRow; unit: string | undefined }) {
  return (
    <tr>
      <td>{periodOf(row)}</td>
      <td>{row.n}</td>
      <td>{formatValue(unit, row.values['median'])}</td>
      <td>{formatValue(unit, row.values['p90'])}</td>
    </tr>
  );
}

export function DataTable({ metric }: { metric: DashboardMetric }) {
  const total = isTotal(metric);
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Period</th>
          <th>n</th>
          {total ? null : <th>Median</th>}
          {total ? null : <th>p90</th>}
        </tr>
      </thead>
      <tbody>
        {metric.rows.map((row) => (total ? <TotalRow key={row.period} row={row} /> : <DistributionRow key={row.period} row={row} unit={metric.unit} />))}
      </tbody>
    </table>
  );
}
