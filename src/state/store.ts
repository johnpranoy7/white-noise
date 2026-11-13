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

/** Volume while on a focus-timer break. */
const BREAK_LEVEL = 0.25;

/** The sleep timer fades over its last half, capped at 20 minutes. */
const sleepFadeSeconds = (minutes: number) => Math.min(minutes * 30, 20 * 60);

interface State {
  /** Nothing is selected until the user picks a sound; nothing plays on load. */
  current: SoundId | null;
  playing: boolean;
  volume: number;
  sleepTimer: SleepTimer | null;
  focusTimer: FocusTimer | null;

  /** Picking the playing sound pauses it; picking any other sound switches to it and plays. */
  select(id: SoundId): void;
  togglePlay(): void;
  play(): void;
  pause(): void;
  setVolume(v: number): void;
  startSleepTimer(minutes: number): void;
  cancelSleepTimer(): void;
  startFocusTimer(focusMin: number, breakMin: number): void;
  cancelFocusTimer(): void;
  /** Called once a second to advance timers. */
  tick(now: number): void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      current: null,
      playing: false,
      volume: 0.7,
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
        const { playing, current, volume, focusTimer } = get();
        if (playing || !current) return;
        engine.setMaster(volume);
        engine.setSound(current);
        void engine.start();
        if (focusTimer?.phase === 'break') engine.setDuck(BREAK_LEVEL, 0.1);
        set({ playing: true });
      },

      pause: () => {
        if (!get().playing) return;
        void engine.pause();
        // A paused sleep timer has nothing left to fade.
        set({ playing: false, sleepTimer: null });
      },

      setVolume: (v) => {
        engine.setMaster(v);
        set({ volume: v });
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
          engine.chime();
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
      version: 2,
      // Only the volume is remembered; the sound is always chosen fresh.
      partialize: (s) => ({ volume: s.volume }),
      migrate: (persisted) => {
        const p = persisted as { volume?: number; master?: number } | undefined;
        return { volume: p?.volume ?? p?.master ?? 0.7 };
      },
    },
  ),
);

// Lock-screen / headset buttons.
engine.onRemoteToggle = (play) => (play ? useStore.getState().play() : useStore.getState().pause());
