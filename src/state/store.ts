import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { engine } from '../audio/engine';
import type { SoundId } from '../audio/sounds';

export interface SleepTimer {
  endsAt: number;
  minutes: number;
}

export interface FocusTimer {
  phase: 'focus' | 'break';
  endsAt: number;
  focusMin: number;
  breakMin: number;
  round: number;
}

export interface Settings {
  /** Caps the volume and starts a sleep timer whenever a sound plays. */
  childSafe: boolean;
  /** Stops the moving textures and other animations. */
  calmVisuals: boolean;
  /** A soft bell when the focus timer switches between work and break. */
  chime: boolean;
}

const DEFAULT_SETTINGS: Settings = { childSafe: false, calmVisuals: false, chime: false };

/** Starting volume on a first visit; after that the user's own setting is remembered. */
const DEFAULT_VOLUME = 0.4;

/** Child-safe mode: highest volume allowed, and the sleep timer it starts. */
export const CHILD_SAFE_MAX_VOLUME = 0.4;
export const CHILD_SAFE_TIMER_MIN = 30;

/** Volume while on a focus-timer break. */
const BREAK_LEVEL = 0.25;

/** The sleep timer fades over its last half, capped at 20 minutes. */
const sleepFadeSeconds = (minutes: number) => Math.min(minutes * 30, 20 * 60);

interface State {
  /** Nothing is selected until the user picks a sound; nothing plays on load. */
  current: SoundId | null;
  playing: boolean;
  /** The user's chosen volume. Child-safe mode caps what is played, not this value. */
  volume: number;
  settings: Settings;
  sleepTimer: SleepTimer | null;
  focusTimer: FocusTimer | null;

  /** Picking the playing sound pauses it; picking any other sound switches to it and plays. */
  select(id: SoundId): void;
  togglePlay(): void;
  play(): void;
  pause(): void;
  setVolume(v: number): void;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  startSleepTimer(minutes: number): void;
  cancelSleepTimer(): void;
  startFocusTimer(focusMin: number, breakMin: number): void;
  cancelFocusTimer(): void;
  /** Called once a second to advance timers. */
  tick(now: number): void;
}

/** The volume actually sent to the speakers, after the child-safe cap. */
export const playedVolume = (s: Pick<State, 'volume' | 'settings'>) =>
  s.settings.childSafe ? Math.min(s.volume, CHILD_SAFE_MAX_VOLUME) : s.volume;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      current: null,
      playing: false,
      volume: DEFAULT_VOLUME,
      settings: DEFAULT_SETTINGS,
      sleepTimer: null,
      focusTimer: null,

      select: (id) => {
        const { current, playing } = get();
        if (id === current && playing) return get().pause();
        engine.setSound(id);
        set({ current: id });
        if (!playing) get().play();
      },

      togglePlay: () => (get().playing ? get().pause() : get().play()),

      play: () => {
        const { playing, current, focusTimer, settings, sleepTimer } = get();
        if (playing || !current) return;
        engine.setMaster(playedVolume(get()));
        engine.setSound(current);
        void engine.start();
        if (focusTimer?.phase === 'break') engine.setDuck(BREAK_LEVEL, 0.1);
        set({ playing: true });
        if (settings.childSafe && !sleepTimer) get().startSleepTimer(CHILD_SAFE_TIMER_MIN);
      },

      pause: () => {
        if (!get().playing) return;
        void engine.pause();
        // A paused sleep timer has nothing left to fade.
        set({ playing: false, sleepTimer: null });
      },

      setVolume: (v) => {
        set({ volume: v });
        engine.setMaster(playedVolume(get()));
      },

      setSetting: (key, value) => {
        set({ settings: { ...get().settings, [key]: value } });
        if (key === 'childSafe') {
          engine.setMaster(playedVolume(get()));
          if (value && get().playing && !get().sleepTimer) get().startSleepTimer(CHILD_SAFE_TIMER_MIN);
        }
      },

      startSleepTimer: (minutes) => {
        engine.scheduleSleepFade(minutes * 60, sleepFadeSeconds(minutes));
        set({ sleepTimer: { minutes, endsAt: Date.now() + minutes * 60_000 } });
      },

      cancelSleepTimer: () => {
        engine.cancelSleepFade();
        set({ sleepTimer: null });
      },

      startFocusTimer: (focusMin, breakMin) => {
        engine.setDuck(1, 0.5);
        set({
          focusTimer: { phase: 'focus', endsAt: Date.now() + focusMin * 60_000, focusMin, breakMin, round: 1 },
        });
      },

      cancelFocusTimer: () => {
        engine.setDuck(1, 1);
        set({ focusTimer: null });
      },

      tick: (now) => {
        const { sleepTimer, focusTimer } = get();
        if (sleepTimer && now >= sleepTimer.endsAt) {
          set({ sleepTimer: null });
          get().pause();
        }
        if (focusTimer && now >= focusTimer.endsAt) {
          const toBreak = focusTimer.phase === 'focus';
          if (get().settings.chime) engine.chime();
          engine.setDuck(toBreak ? BREAK_LEVEL : 1);
          set({
            focusTimer: {
              ...focusTimer,
              phase: toBreak ? 'break' : 'focus',
              endsAt: now + (toBreak ? focusTimer.breakMin : focusTimer.focusMin) * 60_000,
              round: toBreak ? focusTimer.round : focusTimer.round + 1,
            },
          });
        }
      },
    }),
    {
      name: 'whitenoise',
      version: 3,
      // Volume and settings are remembered; the sound is always chosen fresh.
      partialize: (s) => ({ volume: s.volume, settings: s.settings }),
      migrate: (persisted) => {
        const p = persisted as { volume?: number; master?: number; settings?: Partial<Settings> } | undefined;
        return {
          volume: p?.volume ?? p?.master ?? DEFAULT_VOLUME,
          settings: { ...DEFAULT_SETTINGS, ...p?.settings },
        };
      },
      // Settings added in later versions get their defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
      },
    },
  ),
);

// Lock-screen / headset buttons.
engine.onRemoteToggle = (play) => (play ? useStore.getState().play() : useStore.getState().pause());
