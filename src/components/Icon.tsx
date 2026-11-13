import type { SoundId } from '../audio/sounds';

const PATHS: Record<SoundId | 'play' | 'pause' | 'moon' | 'timer' | 'volume' | 'close', string> = {
  // Noise colors share a waveform drawn with decreasing "roughness".
  white: 'M2 12h2l1-6 2 12 2-9 2 7 2-11 2 13 2-8 1 4 2-2h2',
  pink: 'M2 12h2l2-5 3 10 3-8 3 7 3-6 2 2h2',
  brown: 'M2 12c3-6 5-6 8 0s5 6 8 0 3-3 4-2',
  grey: 'M2 12h3l2-4 3 8 3-8 3 8 2-4h4',
  deep: 'M2 13c4-5 7-5 10 0s6 5 10 0',
  rain: 'M8 3.5S4 9 4 12a4 4 0 0 0 8 0c0-3-4-8.5-4-8.5ZM17 9s-2.5 3.4-2.5 5.2a2.5 2.5 0 0 0 5 0C19.5 12.4 17 9 17 9Z',
  stream: 'M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
  ocean: 'M2 16c2.5 0 3.5-2 5-2s2.5 2 5 2 3.5-2 5-2 2.5 2 5 2M3 11c2-5 8-7 12-4-3 0-4 2-3 4',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  play: 'M8 5.5v13l11-6.5Z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  volume: 'M4 9h4l5-4v14l-5-4H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  close: 'M6 6l12 12M18 6 6 18',
};

const FILLED = new Set(['play', 'pause']);

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS; size?: number }) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
