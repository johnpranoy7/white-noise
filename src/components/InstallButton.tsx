import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/** Chromium's install prompt event (not yet in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | null;

/**
 * How the app can be installed here: 'prompt' when the browser offers an install
 * dialog (Android, Chrome/Edge on desktop), 'ios' on iPhone/iPad where it must be
 * added from the Share menu, or null when it's already installed or not possible.
 */
export function installMode(ua: string, touchPoints: number, standalone: boolean, hasPrompt: boolean): InstallMode {
  if (standalone) return null;
  if (hasPrompt) return 'prompt';
  // iPadOS reports itself as a Mac, so check for touch as well.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  return ios ? 'ios' : null;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// The browser can fire beforeinstallprompt before React renders, so it is caught
// here when the module loads and handed to the button when it mounts.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // show our own button instead of the browser's mini-bar
  deferredPrompt = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  notify();
});

export function InstallButton() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const update = () => rerender((n) => n + 1);
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);

  const mode = installMode(navigator.userAgent, navigator.maxTouchPoints, isStandalone(), deferredPrompt !== null);
  if (!mode) return null;

  if (mode === 'prompt') {
    const install = async () => {
      const prompt = deferredPrompt;
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      // A prompt can only be used once; the browser offers a new one if still installable.
      deferredPrompt = null;
      notify();
    };
    return (
      <button className="pill install-button" onClick={install} aria-label="Install app">
        <Icon name="install" size={18} />
        <span className="pill-text">Install app</span>
      </button>
    );
  }

  return (
    <>
      <button className="pill install-button" popoverTarget="install-help" aria-label="Install app">
        <Icon name="install" size={18} />
        <span className="pill-text">Install app</span>
      </button>
      <div id="install-help" className="menu install-menu" popover="auto">
        <div className="menu-group">
          <h3>Add to Home Screen</h3>
          <p>Whitenoise opens full-screen from its own icon, like an app.</p>
          <ol className="install-steps">
            <li>
              Tap <span className="inline-icon"><Icon name="share" size={16} /></span> <strong>Share</strong> in
              your browser's toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
