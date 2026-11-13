import { useState } from 'react';
import { BUILT_IN_MIXES, useStore } from '../state/store';
import { Icon } from './Icon';

export function Mixes() {
  const saved = useStore((s) => s.savedMixes);
  const active = useStore((s) => s.activeMix);
  const applyMix = useStore((s) => s.applyMix);
  const saveMix = useStore((s) => s.saveMix);
  const deleteMix = useStore((s) => s.deleteMix);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMix(name);
    setName('');
    setNaming(false);
  };

  return (
    <section aria-labelledby="mixes-title">
      <h2 id="mixes-title" className="section-title">
        Mixes
      </h2>
      <div className="chips">
        {BUILT_IN_MIXES.map((mix) => (
          <button
            key={mix.name}
            className={`chip${active === mix.name ? ' active' : ''}`}
            onClick={() => applyMix(mix)}
          >
            {mix.name}
          </button>
        ))}
        {saved.map((mix) => (
          <span key={mix.name} className={`chip saved${active === mix.name ? ' active' : ''}`}>
            <button className="chip-label" onClick={() => applyMix(mix)}>
              {mix.name}
            </button>
            <button className="chip-remove" aria-label={`Delete ${mix.name}`} onClick={() => deleteMix(mix.name)}>
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        {naming ? (
          <form className="save-form" onSubmit={submit}>
            <input
              autoFocus
              value={name}
              maxLength={32}
              placeholder="Name this mix"
              aria-label="Mix name"
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Escape' && setNaming(false)}
            />
            <button className="chip active" type="submit" disabled={!name.trim()}>
              Save
            </button>
          </form>
        ) : (
          <button className="chip dashed" onClick={() => setNaming(true)}>
            + Save current
          </button>
        )}
      </div>
    </section>
  );
}
