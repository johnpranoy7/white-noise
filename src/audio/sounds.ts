export type SoundId =
  | 'white'
  | 'pink'
  | 'brown'
  | 'grey'
  | 'deep'
  | 'rain'
  | 'stream'
  | 'ocean'
  | 'wind';

export type SoundGroup = 'noise' | 'nature';

export interface SoundDef {
  id: SoundId;
  name: string;
  group: SoundGroup;
  hint: string;
}

export const SOUNDS: SoundDef[] = [
  { id: 'white', name: 'White', group: 'noise', hint: 'Bright, even hiss. Masks speech well.' },
  { id: 'pink', name: 'Pink', group: 'noise', hint: 'Softer highs, like steady rainfall.' },
  { id: 'brown', name: 'Brown', group: 'noise', hint: 'Deep rumble, like a distant waterfall.' },
  { id: 'grey', name: 'Grey', group: 'noise', hint: 'Tuned so every pitch sounds equally loud.' },
  { id: 'deep', name: 'Deep brown', group: 'noise', hint: 'Brown noise with the highs removed.' },
  { id: 'rain', name: 'Rain', group: 'nature', hint: 'Steady rain with individual drops.' },
  { id: 'stream', name: 'Stream', group: 'nature', hint: 'Water running over stones.' },
  { id: 'ocean', name: 'Ocean', group: 'nature', hint: 'Slow waves rolling in.' },
  { id: 'wind', name: 'Wind', group: 'nature', hint: 'Gusts that rise and fall.' },
];

export const SOUND_IDS = SOUNDS.map((s) => s.id);

export type Volumes = Record<SoundId, number>;

export const silentVolumes = (): Volumes =>
  Object.fromEntries(SOUND_IDS.map((id) => [id, 0])) as Volumes;
