import { useEffect, useState } from 'react';
import { soundById, soundByKey } from './audio/sounds';
import { About } from './components/About';
import { Player } from './components/Player';
import { Settings } from './components/Settings';
import { SoundGrid } from './components/SoundGrid';
import { useStore } from './state/store';

export default function App() {
  const current = useStore((s) => s.current);
  const playing = useStore((s) => s.playing);
  const tick = useStore((s) => s.tick);
  const calmVisuals = useStore((s) => s.settings.calmVisuals);
  const [now, setNow] = useState(Date.now());
  const sound = current ? soundById(current) : null;

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tick(t);
    }, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Space plays/pauses; 1–7 pick a noise, Q W E R a nature sound. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [popover], [role="switch"]')) return;
      const { togglePlay, select } = useStore.getState();
      if (e.code === 'Space' && !el.closest('button')) {
        e.preventDefault();
        togglePlay();
      } else {
        const target = soundByKey(e.key);
        if (target) select(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Calm visuals switches off animations everywhere (see [data-calm] in styles.css).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-calm', calmVisuals);
  }, [calmVisuals]);

  useEffect(() => {
    document.title = sound && playing ? `${sound.name} · Whitenoise` : 'Whitenoise';
  }, [sound, playing]);

  return (
    <div
      className="shell"
      data-playing={playing || undefined}
      style={{ '--tone': sound?.tone ?? 'var(--neutral-tone)' } as React.CSSProperties}
    >
      <header className="topbar">
        <h1 className="wordmark">whitenoise</h1>
        <div className="topbar-end">
          <span className="topbar-note">
            <kbd>Space</kbd> play · <kbd>1</kbd>–<kbd>7</kbd> noise · <kbd>Q</kbd>–<kbd>R</kbd> nature
          </span>
          <Settings />
        </div>
      </header>

      <main className="layout">
        <section className="stage" aria-live="polite">
          <p className="eyebrow">
            <span className="dot" />
            {sound ? (playing ? 'Now playing' : 'Paused') : 'Nothing playing'}
          </p>
          <h2 key={current ?? 'none'} className="title">
            {sound ? sound.name : <>Choose a&nbsp;sound.</>}
          </h2>
          <p className="lede">
            {sound
              ? sound.hint
              : 'One sound at a time, for focus or for sleep. Nothing plays until you pick one.'}
          </p>
          <Player now={now} />
        </section>

        <SoundGrid />
      </main>

      <About />

      <footer className="footer">
        <span>Generated in your browser with the Web Audio API.</span>
        <span>Keeps playing with your phone locked.</span>
      </footer>
    </div>
  );
}
