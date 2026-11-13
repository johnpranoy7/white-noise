import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/geist/wght.css';
import App from './App';
import { engine } from './audio/engine';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Get audio ready before the first sound is chosen: fetch the worklet once the page is
// idle, and create the audio context on the first press (a pointerdown or keydown comes
// just before the click, and counts as a user gesture).
const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
idle(() => engine.prefetch());
const warm = () => engine.warm();
window.addEventListener('pointerdown', warm, { once: true, capture: true });
window.addEventListener('keydown', warm, { once: true, capture: true });
