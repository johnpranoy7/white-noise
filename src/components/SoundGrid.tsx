import { SOUNDS, type SoundDef, type SoundGroup } from '../audio/sounds';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const GROUPS: { id: SoundGroup; title: string; note: string }[] = [
  { id: 'noise', title: 'Noise', note: 'Synthesised live, never loops' },
  { id: 'nature', title: 'Nature', note: 'Ambient textures' },
];

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
      style={{ '--swatch': sound.swatch } as React.CSSProperties}
      onClick={() => select(sound.id)}
    >
      <span className="tile-swatch">
        {sound.group === 'nature' && (
          <span className="tile-glyph">
            <Icon name={sound.id as 'rain' | 'stream' | 'ocean' | 'wind'} size={28} />
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
        <kbd className="tile-key">{index + 1}</kbd>
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
