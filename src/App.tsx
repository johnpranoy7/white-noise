import { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { Mixer } from './components/Mixer';
import { Mixes } from './components/Mixes';
import { Slider } from './components/Slider';
import { Timers } from './components/Timers';
import { useStore } from './state/store';

export default function App() {
  const playing = useStore((s) => s.playing);
  const togglePlay = useStore((s) => s.togglePlay);
  const master = useStore((s) => s.master);
  const setMaster = useStore((s) => s.setMaster);
  const tick = useStore((s) => s.tick);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tick(t);
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Space toggles playback unless the user is typing or on a slider.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || el.closest('input, textarea, button')) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  return (
    <div className={`app${playing ? ' playing' : ''}`}>
      <div className="glow" aria-hidden="true" />
      <header className="hero">
        <h1>Whitenoise</h1>
        <p className="muted">Noise and nature sounds for focus and sleep, generated in your browser.</p>
        <button
          className="play"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
        >
          <Icon name={playing ? 'pause' : 'play'} size={34} />
        </button>
        <div className="master">
          <Icon name="volume" size={18} />
          <Slider label="Master volume" value={master} onChange={setMaster} />
        </div>
      </header>

      <main>
        <Mixes />
        <Mixer />
        <Timers now={now} />
      </main>

      <footer className="muted">
        Noise is synthesised live with the Web Audio API · Press Space to play or pause
      </footer>
    </div>
  );
}
