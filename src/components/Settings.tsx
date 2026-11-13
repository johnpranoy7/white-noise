import { CHILD_SAFE_MAX_VOLUME, CHILD_SAFE_TIMER_MIN, useStore, type Settings as SettingsState } from '../state/store';
import { Icon } from './Icon';

const OPTIONS: { key: keyof SettingsState; title: string; detail: string }[] = [
  {
    key: 'childSafe',
    title: 'Child-safe mode',
    detail: `Caps the volume at ${Math.round(CHILD_SAFE_MAX_VOLUME * 100)}% and starts a ${CHILD_SAFE_TIMER_MIN}-minute sleep timer whenever a sound plays.`,
  },
  {
    key: 'calmVisuals',
    title: 'Calm visuals',
    detail: 'Stops the moving textures and other animations.',
  },
  {
    key: 'chime',
    title: 'Timer chime',
    detail: 'A soft bell when the focus timer switches between work and break.',
  },
];

export function Settings() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);

  return (
    <>
      <button className="pill settings-button" popoverTarget="settings-menu" aria-label="Settings">
        <Icon name="settings" size={18} />
        <span className="pill-text">Settings</span>
      </button>
      <div id="settings-menu" className="menu settings-menu" popover="auto">
        {OPTIONS.map(({ key, title, detail }) => (
          <div key={key} className="switch-row">
            <div>
              <h3 id={`setting-${key}`}>{title}</h3>
              <p id={`setting-${key}-detail`}>{detail}</p>
            </div>
            <button
              role="switch"
              className="switch"
              aria-checked={settings[key]}
              aria-labelledby={`setting-${key}`}
              aria-describedby={`setting-${key}-detail`}
              onClick={() => setSetting(key, !settings[key])}
            />
          </div>
        ))}
      </div>
    </>
  );
}
