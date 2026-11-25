import type { ComparisonMode, Weekday, WorkSchedule } from '@fluxion/core';
import { COMPARISON_CHOICES, defaultSchedule, WEEKDAYS } from './query.js';

const DAY_LABELS: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

interface SettingsProps {
  schedule: WorkSchedule | null;
  onChange(schedule: WorkSchedule | null): void;
  compare: ComparisonMode;
  onCompareChange(compare: ComparisonMode): void;
}

export function describeSchedule(schedule: WorkSchedule): string {
  const days = WEEKDAYS.filter((day) => schedule.days.includes(day));
  const first = days[0];
  const last = days[days.length - 1];
  const contiguous = first !== undefined && last !== undefined && WEEKDAYS.indexOf(last) - WEEKDAYS.indexOf(first) + 1 === days.length;
  const label = contiguous && days.length > 2 && first && last ? `${DAY_LABELS[first]}–${DAY_LABELS[last]}` : days.map((day) => DAY_LABELS[day]).join(', ');
  return `${label} ${schedule.start}–${schedule.end} (${schedule.timeZone})`;
}

function timeZonesWith(current: string): string[] {
  const known = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return known.includes(current) ? known : [current, ...known];
}

function Days({ schedule, onChange }: { schedule: WorkSchedule; onChange(schedule: WorkSchedule): void }) {
  const toggle = (day: Weekday) => onChange({ ...schedule, days: WEEKDAYS.filter((each) => (each === day ? !schedule.days.includes(day) : schedule.days.includes(each))) });
  return (
    <fieldset className="field days">
      <legend className="label">Work days</legend>
      {WEEKDAYS.map((day) => (
        <label key={day} className="check">
          <input type="checkbox" checked={schedule.days.includes(day)} onChange={() => toggle(day)} />
          {DAY_LABELS[day]}
        </label>
      ))}
    </fieldset>
  );
}

function Hours({ schedule, onChange }: { schedule: WorkSchedule; onChange(schedule: WorkSchedule): void }) {
  return (
    <div className="field dates">
      <label>
        <span className="label">Start</span>
        <input type="time" value={schedule.start} onChange={(event) => onChange({ ...schedule, start: event.target.value })} />
      </label>
      <label>
        <span className="label">End</span>
        <input type="time" value={schedule.end} onChange={(event) => onChange({ ...schedule, end: event.target.value })} />
      </label>
    </div>
  );
}

function Comparison({ compare, onChange }: { compare: ComparisonMode; onChange(compare: ComparisonMode): void }) {
  return (
    <fieldset className="field">
      <legend className="label">Compare with previous range</legend>
      {COMPARISON_CHOICES.map(({ value, label }) => (
        <label key={value} className="check">
          <input type="radio" name="compare" checked={compare === value} onChange={() => onChange(value)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function Settings({ schedule, onChange, compare, onCompareChange }: SettingsProps) {
  return (
    <fieldset className="field settings" aria-label="Settings">
      <legend className="label">Settings</legend>
      <Comparison compare={compare} onChange={onCompareChange} />
      <label className="check">
        <input type="checkbox" checked={schedule !== null} onChange={(event) => onChange(event.target.checked ? defaultSchedule() : null)} />
        Measure in working time
      </label>
      {schedule ? (
        <>
          <Days schedule={schedule} onChange={onChange} />
          <Hours schedule={schedule} onChange={onChange} />
          <label className="field">
            <span className="label">Time zone</span>
            <select value={schedule.timeZone} onChange={(event) => onChange({ ...schedule, timeZone: event.target.value })}>
              {timeZonesWith(schedule.timeZone).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </fieldset>
  );
}
