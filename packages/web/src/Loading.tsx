import { useEffect, useState, type CSSProperties } from 'react';

export const SKELETON_DELAY_MS = 150;
const MESSAGE_INTERVAL_MS = 1800;
const MESSAGES = ['Loading all six metrics…', 'Fetching pull requests…', 'Computing medians…', 'Building charts…'];
const SIX = [0, 1, 2, 3, 4, 5];
const FOUR = [0, 1, 2, 3];
const TABLE_ROWS = [0, 1, 2, 3, 4];
const LAYER_STYLE = { '--delay': `${SKELETON_DELAY_MS}ms` } as CSSProperties;

function useCyclingMessage(): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % MESSAGES.length), MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return MESSAGES[index] ?? '';
}

export function RailSkeleton() {
  return (
    <div className="metric-list loading-layer" style={LAYER_STYLE} aria-hidden="true">
      {SIX.map((slot) => (
        <div key={slot} className="row skel">
          <span className="row-top">
            <span className="sk t sk-name" />
            <span className="sk v sk-value" />
          </span>
          <span className="sk t sk-change" />
          <span className="sk sk-spark" />
        </div>
      ))}
    </div>
  );
}

function StatusLine() {
  const message = useCyclingMessage();
  return (
    <div className="loading-status" role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <span key={message} className="msg">
        {message}
      </span>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <main className="detail" aria-busy="true">
      <div className="progress-bar loading-layer" style={LAYER_STYLE} aria-hidden="true" />
      <div className="loading-layer" style={LAYER_STYLE} data-testid="loading-layer">
        <StatusLine />
        <div className="skeleton-body" aria-hidden="true">
          <span className="sk sk-title" />
          <div className="tiles">
            {FOUR.map((slot) => (
              <div key={slot} className="tile skel">
                <span className="sk t sk-tile-label" />
                <span className="sk sk-tile-value" />
                <span className="sk t sk-tile-change" />
              </div>
            ))}
          </div>
          <div className="chart skel" />
          <div className="table-skel">
            {TABLE_ROWS.map((slot) => (
              <span key={slot} className="sk sk-table-row" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
