import { useEffect, useState } from 'react';
import { SOUNDS, soundById } from './audio/sounds';
import { Player } from './components/Player';
import { SoundGrid } from './components/SoundGrid';
import { useStore } from './state/store';

export default function App() {
  const current = useStore((s) => s.current);
  const playing = useStore((s) => s.playing);
  const tick = useStore((s) => s.tick);
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

  // Space plays/pauses, 1–9 pick a sound. Ignored while typing or on a focused control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [popover]')) return;
      const { togglePlay, select } = useStore.getState();
      if (e.code === 'Space' && !el.closest('button')) {
        e.preventDefault();
        togglePlay();
      } else if (/^[1-9]$/.test(e.key)) {
        const target = SOUNDS[Number(e.key) - 1];
        if (target) select(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <span className="wordmark">whitenoise</span>
        <span className="topbar-note">
          <kbd>Space</kbd> play · <kbd>1</kbd>–<kbd>9</kbd> choose
        </span>
      </header>

      <main className="layout">
        <section className="stage" aria-live="polite">
          <p className="eyebrow">
            <span className="dot" />
            {sound ? (playing ? 'Now playing' : 'Paused') : 'Nothing playing'}
          </p>
          <h1 key={current ?? 'none'} className="title">
            {sound ? sound.name : <>Choose a&nbsp;sound.</>}
          </h1>
          <p className="lede">
            {sound
              ? sound.hint
              : 'One sound at a time, for focus or for sleep. Nothing plays until you pick one.'}
          </p>
          <Player now={now} />
        </section>

        <SoundGrid />
      </main>

      <footer className="footer">
        <span>Generated in your browser with the Web Audio API.</span>
        <span>Keeps playing with your phone locked.</span>
      </footer>
    </div>
  );
}
