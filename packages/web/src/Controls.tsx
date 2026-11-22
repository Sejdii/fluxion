import type { RepositoryOption } from '@fluxion/core';
import { useState } from 'react';
import { Settings } from './Settings.js';
import { applyChoice, isDayPeriodAllowed, isValidSchedule, scheduleKey, snapToYears, yearChoices, yearRange, yearsOf, type Period, type Query, type Range } from './query.js';

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
  today: Date;
  onApply(query: Query): void;
  disabled: boolean;
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

function Years({ draft, today, onChange }: { draft: Query; today: Date; onChange(range: Range): void }) {
  const years = yearChoices(today);
  const { from, to } = yearsOf(draft);
  const select = (label: string, value: number, rangeFor: (year: number) => Range) => (
    <label>
      <span className="label">{label}</span>
      <select value={value} onChange={(event) => onChange(rangeFor(Number(event.target.value)))}>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="field dates">
      {select('From', from, (year) => yearRange(year, to, today))}
      {select('To', to, (year) => yearRange(from, year, today))}
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
  const changed = draft.repos.join() !== applied.repos.join() || draft.since !== applied.since || draft.until !== applied.until || scheduleKey(draft.workSchedule) !== scheduleKey(applied.workSchedule);
  return changed && draft.repos.length > 0 && draft.since !== '' && draft.until !== '' && draft.since <= draft.until && isValidSchedule(draft.workSchedule);
}

export function Controls({ options, applied, dayPeriodMaxMonths, today, onApply, disabled }: ControlsProps) {
  const [draft, setDraft] = useState<Query>(applied);
  const change = (partial: Partial<Query>) => setDraft((previous) => ({ ...previous, ...partial }));
  const dayAllowed = isDayPeriodAllowed(draft, dayPeriodMaxMonths) && isDayPeriodAllowed(applied, dayPeriodMaxMonths);
  const apply = () => onApply(applyChoice({ ...draft, period: applied.period }, dayPeriodMaxMonths));
  const pickPeriod = (period: Period) => {
    if (period === 'yearly') {
      const snapped = snapToYears(applied, today);
      change(snapped);
      onApply({ ...applied, ...snapped, period });
    } else {
      onApply({ ...applied, period });
    }
  };
  return (
    <section className="controls" aria-label="Controls">
      <fieldset className="controls-body" disabled={disabled}>
        <Repositories options={options} repos={draft.repos} onChange={(repos) => change({ repos })} />
        {applied.period === 'yearly' ? <Years draft={draft} today={today} onChange={change} /> : <Dates draft={draft} onChange={change} />}
        <Settings schedule={draft.workSchedule ?? null} onChange={(workSchedule) => change({ workSchedule })} />
        <button className="apply" disabled={!isApplicable(draft, applied)} onClick={apply}>
          Apply
        </button>
        <Periods applied={applied} dayAllowed={dayAllowed} maxMonths={dayPeriodMaxMonths} onPick={pickPeriod} />
      </fieldset>
    </section>
  );
}
