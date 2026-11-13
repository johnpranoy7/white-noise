const PATHS = {
  rain: 'M12 3.5S7 10 7 13.5a5 5 0 0 0 10 0C17 10 12 3.5 12 3.5Z',
  stream: 'M3 9c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 3.3-1.5 5-1M3 15c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 3.3-1.5 5-1',
  ocean: 'M2 17c2.5 0 3.5-2 5-2s2.5 2 5 2 3.5-2 5-2 2.5 2 5 2M4 12c1.5-4.5 7-6.5 11-3.5-2.5-.3-3.8 1.5-3 3.5',
  wind: 'M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12h15a3 3 0 1 1-3 3M3 16h6',
  underwater:
    'M8 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 11a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM16.5 19a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4ZM10.5 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  fire: 'M12 21c3.3 0 6-2.5 6-5.8 0-3.7-3-5.7-4-9.2-1.6 1.5-2.4 3.3-2.3 5.1-1.3-.6-2.1-1.7-2.4-3C7.6 9.6 6 11.8 6 15.2 6 18.5 8.7 21 12 21Z',
  crickets: 'M17.5 14.5A6.5 6.5 0 0 1 9.5 6.5 6.5 6.5 0 1 0 17.5 14.5ZM17.5 3.5v3M16 5h3',
  play: 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2Z',
  pause: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z',
  volume: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4ZM15.5 9a4 4 0 0 1 0 6',
  timer: 'M12 8.5V13l2.5 1.5M9.5 2.5h5M12 21.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
} as const;

export type IconName = keyof typeof PATHS;

const FILLED = new Set<IconName>(['play', 'pause']);

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
