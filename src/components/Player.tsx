import { CHILD_SAFE_MAX_VOLUME, useStore } from '../state/store';
import { Icon } from './Icon';
import { Slider } from './Slider';

const SLEEP_OPTIONS = [15, 30, 60, 90];
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

function closeMenu() {
  document.getElementById('timer-menu')?.hidePopover();
}

/** Play/pause, volume and timers. Sits under the title on wide screens, docked to the bottom on phones. */
export function Player({ now }: { now: number }) {
  const current = useStore((s) => s.current);
  const playing = useStore((s) => s.playing);
  const togglePlay = useStore((s) => s.togglePlay);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const childSafe = useStore((s) => s.settings.childSafe);
  const cap = childSafe ? CHILD_SAFE_MAX_VOLUME : 1;
  const sleep = useStore((s) => s.sleepTimer);
  const focus = useStore((s) => s.focusTimer);
  const startSleep = useStore((s) => s.startSleepTimer);
  const cancelSleep = useStore((s) => s.cancelSleepTimer);
  const startFocus = useStore((s) => s.startFocusTimer);
  const cancelFocus = useStore((s) => s.cancelFocusTimer);

  return (
    <div className="player">
      <button
        className="play"
        onClick={togglePlay}
        disabled={!current}
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
      >
        <Icon name={playing ? 'pause' : 'play'} size={26} />
      </button>

      <label className="volume" data-capped={childSafe || undefined}>
        <Icon name="volume" size={18} />
        <Slider
          label={childSafe ? `Volume, child-safe limit ${Math.round(cap * 100)}%` : 'Volume'}
          value={Math.min(volume, cap)}
          max={cap}
          onChange={setVolume}
        />
        {/* Shown while hovering or adjusting; the slider itself announces the value. */}
        <span className="volume-value" aria-hidden="true">
          {Math.round(Math.min(volume, cap) * 100)}%
        </span>
        {childSafe && <span className="cap-note">max {Math.round(cap * 100)}%</span>}
      </label>

      <div className="timer-slot">
        {sleep && (
          <button className="pill live" onClick={cancelSleep} aria-label="Cancel sleep timer">
            <span>Sleep</span>
            <span className="num">{formatRemaining(sleep.endsAt - now)}</span>
            <Icon name="close" size={14} />
          </button>
        )}
        {focus && (
          <button className="pill live" onClick={cancelFocus} aria-label="Stop focus timer">
            <span>{focus.phase === 'focus' ? `Focus ${focus.round}` : 'Break'}</span>
            <span className="num">{formatRemaining(focus.endsAt - now)}</span>
            <Icon name="close" size={14} />
          </button>
        )}
        <button className="pill" popoverTarget="timer-menu" disabled={!playing} aria-label="Timers">
          <Icon name="timer" size={18} />
          <span className="pill-text">Timer</span>
        </button>
      </div>

      <div id="timer-menu" className="menu" popover="auto">
        <div className="menu-group">
          <h3>Sleep</h3>
          <p>Fades out slowly, then stops.</p>
          <div className="seg">
            {SLEEP_OPTIONS.map((m) => (
              <button
                key={m}
                aria-pressed={sleep?.minutes === m}
                onClick={() => {
                  startSleep(m);
                  closeMenu();
                }}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="menu-group">
          <h3>Focus</h3>
          <p>Focus for a set time, then take a short break with the sound turned down. It repeats until you stop it.</p>
          <div className="seg seg-two-line">
            {FOCUS_OPTIONS.map(([f, b]) => (
              <button
                key={f}
                aria-label={`${f} minutes focus, ${b} minutes break`}
                aria-pressed={focus?.focusMin === f}
                onClick={() => {
                  startFocus(f, b);
                  closeMenu();
                }}
              >
                <span className="seg-main">{f} min</span>
                <span className="seg-sub">+ {b} min break</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
