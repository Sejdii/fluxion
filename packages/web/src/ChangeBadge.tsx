import type { Change } from './change.js';

export function ChangeBadge({ change }: { change: Change }) {
  const tone = change.available ? change.tone : 'none';
  return (
    <button type="button" className={`change change-${tone}`} aria-label={change.sentence}>
      <span aria-hidden="true">{change.available ? change.text : '—'}</span>
      <span className="change-tip" aria-hidden="true">
        {change.sentence}
      </span>
    </button>
  );
}
