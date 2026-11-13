import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { engine } from '../audio/engine';
import { silentVolumes, type SoundId, type Volumes } from '../audio/sounds';

export interface Mix {
  name: string;
  volumes: Partial<Volumes>;
}

export const BUILT_IN_MIXES: Mix[] = [
  { name: 'Study', volumes: { pink: 0.45, rain: 0.35 } },
  { name: 'Deep focus', volumes: { brown: 0.55, grey: 0.15 } },
  { name: 'Sleep', volumes: { deep: 0.6, rain: 0.4 } },
  { name: 'Seaside', volumes: { ocean: 0.6, wind: 0.2 } },
  { name: 'Forest creek', volumes: { stream: 0.5, wind: 0.25, pink: 0.15 } },
];

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
  playing: boolean;
  volumes: Volumes;
  master: number;
  savedMixes: Mix[];
  activeMix: string | null;
  sleepTimer: SleepTimer | null;
  focusTimer: FocusTimer | null;

  togglePlay(): void;
  play(): void;
  pause(): void;
  setVolume(id: SoundId, v: number): void;
  setMaster(v: number): void;
  applyMix(mix: Mix): void;
  saveMix(name: string): void;
  deleteMix(name: string): void;
  startSleepTimer(minutes: number): void;
  cancelSleepTimer(): void;
  startFocusTimer(focusMin: number, breakMin: number): void;
  cancelFocusTimer(): void;
  /** Called once a second to advance timers. */
  tick(now: number): void;
}

const isSilent = (v: Volumes) => Object.values(v).every((x) => x === 0);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      playing: false,
      volumes: { ...silentVolumes(), ...BUILT_IN_MIXES[0].volumes },
      master: 0.8,
      savedMixes: [],
      activeMix: BUILT_IN_MIXES[0].name,
      sleepTimer: null,
      focusTimer: null,

      togglePlay: () => (get().playing ? get().pause() : get().play()),

      play: () => {
        if (get().playing) return;
        // Pressing play on an empty mix would be silent and confusing.
        if (isSilent(get().volumes)) get().applyMix(BUILT_IN_MIXES[0]);
        engine.setMaster(get().master);
        engine.setVolumes(get().volumes);
        void engine.start();
        const focus = get().focusTimer;
        if (focus?.phase === 'break') engine.setDuck(BREAK_LEVEL, 0.1);
        set({ playing: true });
      },

      pause: () => {
        if (!get().playing) return;
        void engine.pause();
        // A paused sleep timer has nothing left to fade.
        set({ playing: false, sleepTimer: null });
      },

      setVolume: (id, v) => {
        const volumes = { ...get().volumes, [id]: v };
        engine.setVolumes(volumes);
        set({ volumes, activeMix: null });
      },

      setMaster: (v) => {
        engine.setMaster(v);
        set({ master: v });
      },

      applyMix: (mix) => {
        const volumes = { ...silentVolumes(), ...mix.volumes };
        engine.setVolumes(volumes);
        set({ volumes, activeMix: mix.name });
      },

      saveMix: (name) => {
        const trimmed = name.trim().slice(0, 32);
        if (!trimmed) return;
        const volumes = Object.fromEntries(
          Object.entries(get().volumes).filter(([, v]) => v > 0),
        ) as Partial<Volumes>;
        const others = get().savedMixes.filter((m) => m.name !== trimmed);
        set({ savedMixes: [...others, { name: trimmed, volumes }], activeMix: trimmed });
      },

      deleteMix: (name) =>
        set((s) => ({
          savedMixes: s.savedMixes.filter((m) => m.name !== name),
          activeMix: s.activeMix === name ? null : s.activeMix,
        })),

      startSleepTimer: (minutes) => {
        if (!get().playing) get().play();
        engine.scheduleSleepFade(minutes * 60, sleepFadeSeconds(minutes));
        set({ sleepTimer: { minutes, endsAt: Date.now() + minutes * 60_000 } });
      },

      cancelSleepTimer: () => {
        engine.cancelSleepFade();
        set({ sleepTimer: null });
      },

      startFocusTimer: (focusMin, breakMin) => {
        if (!get().playing) get().play();
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
      version: 1,
      partialize: (s) => ({
        volumes: s.volumes,
        master: s.master,
        savedMixes: s.savedMixes,
        activeMix: s.activeMix,
      }),
      // Sounds added in later versions start silent instead of undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, volumes: { ...current.volumes, ...p.volumes } };
      },
    },
  ),
);

// Lock-screen / headset buttons.
engine.onRemoteToggle = (play) => (play ? useStore.getState().play() : useStore.getState().pause());
