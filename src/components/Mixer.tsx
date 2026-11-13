import { SOUNDS, type SoundGroup } from '../audio/sounds';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { Slider } from './Slider';

const GROUPS: { id: SoundGroup; title: string }[] = [
  { id: 'noise', title: 'Noise' },
  { id: 'nature', title: 'Nature' },
];

export function Mixer() {
  const volumes = useStore((s) => s.volumes);
  const setVolume = useStore((s) => s.setVolume);

  return (
    <div className="mixer">
      {GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`}>
          <h2 id={`group-${group.id}`} className="section-title">
            {group.title}
          </h2>
          <div className="cards">
            {SOUNDS.filter((s) => s.group === group.id).map((sound) => {
              const v = volumes[sound.id];
              const on = v > 0;
              return (
                <div key={sound.id} className={`card${on ? ' on' : ''}`} data-sound={sound.id}>
                  <button
                    className="card-head"
                    aria-pressed={on}
                    title={sound.hint}
                    onClick={() => setVolume(sound.id, on ? 0 : 0.5)}
                  >
                    <span className="card-icon">
                      <Icon name={sound.id} />
                    </span>
                    <span className="card-name">{sound.name}</span>
                  </button>
                  <Slider label={`${sound.name} volume`} value={v} onChange={(x) => setVolume(sound.id, x)} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
