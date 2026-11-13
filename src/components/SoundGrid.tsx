import { SOUNDS, type SoundDef, type SoundGroup } from '../audio/sounds';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const GROUPS: { id: SoundGroup; title: string; note: string }[] = [
  { id: 'noise', title: 'Noise', note: 'Synthesised live, never loops' },
  { id: 'nature', title: 'Nature', note: 'Ambient textures' },
];

/**
 * Fine vertical lines: fractal noise with a high horizontal and near-zero vertical
 * frequency, stretched to fill the tile. Rendered by the browser, no image files.
 */
function streakTexture(seed: number) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300' preserveAspectRatio='none'>` +
    `<filter id='s' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.9 0.002' numOctaves='2' seed='${seed}'/>` +
    `<feColorMatrix values='1.8 0 0 0 -0.4 1.8 0 0 0 -0.4 1.8 0 0 0 -0.4 0 0 0 0 1'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#s)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function Tile({ sound, index }: { sound: SoundDef; index: number }) {
  const selected = useStore((s) => s.current === sound.id);
  const playing = useStore((s) => s.playing && s.current === sound.id);
  const select = useStore((s) => s.select);

  return (
    <button
      className="tile"
      data-group={sound.group}
      data-sound={sound.id}
      data-playing={playing || undefined}
      aria-pressed={selected}
      aria-label={`${sound.name}${playing ? ', playing' : ''}`}
      title={sound.hint}
      style={
        {
          '--swatch': sound.swatch,
          '--streaks': sound.group === 'noise' ? streakTexture(index + 3) : undefined,
        } as React.CSSProperties
      }
      onClick={() => select(sound.id)}
    >
      <span className="tile-swatch">
        <span className="tile-fill" aria-hidden="true" />
        {sound.group === 'nature' && (
          <span className="tile-glyph">
            <Icon name={sound.id as 'rain' | 'stream' | 'ocean' | 'wind' | 'underwater' | 'fire' | 'crickets'} size={28} />
          </span>
        )}
        <span className="eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="tile-meta">
        <span className="tile-name">{sound.name}</span>
        <kbd className="tile-key">{sound.key}</kbd>
      </span>
    </button>
  );
}

export function SoundGrid() {
  return (
    <div className="library">
      {GROUPS.map((group) => (
        <section key={group.id} className="group" aria-labelledby={`g-${group.id}`}>
          <header className="group-head">
            <h2 id={`g-${group.id}`}>{group.title}</h2>
            <span>{group.note}</span>
          </header>
          <div className={`grid grid-${group.id}`}>
            {SOUNDS.map((sound, i) =>
              sound.group === group.id ? <Tile key={sound.id} sound={sound} index={i} /> : null,
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
