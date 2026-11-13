import { useStore } from '../state/store';
import { Icon } from './Icon';

const SLEEP_OPTIONS = [15, 30, 45, 60, 90];
const FOCUS_OPTIONS: [number, number][] = [
  [25, 5],
  [50, 10],
];

export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function Timers({ now }: { now: number }) {
  const sleep = useStore((s) => s.sleepTimer);
  const focus = useStore((s) => s.focusTimer);
  const startSleep = useStore((s) => s.startSleepTimer);
  const cancelSleep = useStore((s) => s.cancelSleepTimer);
  const startFocus = useStore((s) => s.startFocusTimer);
  const cancelFocus = useStore((s) => s.cancelFocusTimer);

  return (
    <div className="timers">
      <section className="timer" aria-labelledby="sleep-title">
        <h2 id="sleep-title" className="section-title">
          <Icon name="moon" size={16} /> Sleep timer
        </h2>
        {sleep ? (
          <div className="timer-running">
            <div>
              <div className="countdown">{formatRemaining(sleep.endsAt - now)}</div>
              <div className="muted">Fades out gently, then stops</div>
            </div>
            <button className="chip" onClick={cancelSleep}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="chips">
            {SLEEP_OPTIONS.map((m) => (
              <button key={m} className="chip" onClick={() => startSleep(m)}>
                {m} min
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="timer" aria-labelledby="focus-title">
        <h2 id="focus-title" className="section-title">
          <Icon name="timer" size={16} /> Focus timer
        </h2>
        {focus ? (
          <div className="timer-running">
            <div>
              <div className="countdown">{formatRemaining(focus.endsAt - now)}</div>
              <div className="muted">
                {focus.phase === 'focus' ? `Focus · round ${focus.round}` : 'Break · sound lowered'}
              </div>
            </div>
            <button className="chip" onClick={cancelFocus}>
              Stop
            </button>
          </div>
        ) : (
          <div className="chips">
            {FOCUS_OPTIONS.map(([f, b]) => (
              <button key={f} className="chip" onClick={() => startFocus(f, b)}>
                {f} / {b}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
