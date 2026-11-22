import type { RepositoryOption } from '@fluxion/core';
import { useState } from 'react';
import { applyChoice, isDayPeriodAllowed, type Period, type Query } from './query.js';

const PERIOD_CHOICES: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
];

interface ControlsProps {
  options: RepositoryOption[];
  applied: Query;
  dayPeriodMaxMonths: number;
  onApply(query: Query): void;
}

function toggled(repos: string[], path: string): string[] {
  return repos.includes(path) ? repos.filter((repo) => repo !== path) : [...repos, path];
}

function Repositories({ options, repos, onChange }: { options: RepositoryOption[]; repos: string[]; onChange(repos: string[]): void }) {
  return (
    <fieldset className="field">
      <legend className="label">Repositories</legend>
      {options.map((option) => (
        <label key={option.path} className="check">
          <input type="checkbox" checked={repos.includes(option.path)} onChange={() => onChange(toggled(repos, option.path))} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

function Dates({ draft, onChange }: { draft: Query; onChange(change: Partial<Query>): void }) {
  return (
    <div className="field dates">
      <label>
        <span className="label">From</span>
        <input type="date" value={draft.since} onChange={(event) => onChange({ since: event.target.value })} />
      </label>
      <label>
        <span className="label">To</span>
        <input type="date" value={draft.until} onChange={(event) => onChange({ until: event.target.value })} />
      </label>
    </div>
  );
}

function Periods({ applied, dayAllowed, maxMonths, onPick }: { applied: Query; dayAllowed: boolean; maxMonths: number; onPick(period: Period): void }) {
  return (
    <div className="field">
      <span className="label">Period</span>
      <div role="group" aria-label="Period" className="periods">
        {PERIOD_CHOICES.map(({ value, label }) => (
          <button key={value} aria-pressed={applied.period === value} disabled={value === 'daily' && !dayAllowed} onClick={() => onPick(value)}>
            {label}
          </button>
        ))}
      </div>
      {dayAllowed ? null : <span className="muted">Day needs a range of {maxMonths} months or less</span>}
    </div>
  );
}

function isApplicable(draft: Query, applied: Query): boolean {
  const changed = draft.repos.join() !== applied.repos.join() || draft.since !== applied.since || draft.until !== applied.until;
  return changed && draft.repos.length > 0 && draft.since !== '' && draft.until !== '' && draft.since <= draft.until;
}

export function Controls({ options, applied, dayPeriodMaxMonths, onApply }: ControlsProps) {
  const [draft, setDraft] = useState<Query>(applied);
  const change = (partial: Partial<Query>) => setDraft((previous) => ({ ...previous, ...partial }));
  const dayAllowed = isDayPeriodAllowed(draft, dayPeriodMaxMonths) && isDayPeriodAllowed(applied, dayPeriodMaxMonths);
  const apply = () => onApply(applyChoice({ ...draft, period: applied.period }, dayPeriodMaxMonths));
  return (
    <section className="controls" aria-label="Controls">
      <Repositories options={options} repos={draft.repos} onChange={(repos) => change({ repos })} />
      <Dates draft={draft} onChange={change} />
      <button className="apply" disabled={!isApplicable(draft, applied)} onClick={apply}>
        Apply
      </button>
      <Periods applied={applied} dayAllowed={dayAllowed} maxMonths={dayPeriodMaxMonths} onPick={(period) => onApply({ ...applied, period })} />
    </section>
  );
}
