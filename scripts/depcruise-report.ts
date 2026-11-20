export interface Violation {
  rule: { name: string };
  from: string;
  to: string;
}

export interface DepcruiseReport {
  summary: { totalCruised: number; violations: Violation[] };
}

export function checkDepcruiseOutput(raw: string): string[] {
  const problems: string[] = [];
  if (raw.includes('missing-tsc-transpiler')) {
    problems.push('dependency-cruiser reported missing-tsc-transpiler');
  }
  const start = raw.indexOf('{');
  if (start === -1) return [...problems, 'dependency-cruiser produced no JSON report'];
  const end = raw.lastIndexOf('}');
  const report = JSON.parse(raw.slice(start, end + 1)) as DepcruiseReport;
  if (report.summary.totalCruised === 0) problems.push('dependency-cruiser cruised zero modules');
  for (const v of report.summary.violations) {
    problems.push(`${v.rule.name}: ${v.from} -> ${v.to}`);
  }
  return problems;
}
