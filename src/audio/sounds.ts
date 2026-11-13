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
  /** Swatch fill: the noise's own color, or a gradient for nature sounds. */
  swatch: string;
  /** Accent the page takes on while this sound is selected. */
  tone: string;
}

export const SOUNDS: SoundDef[] = [
  {
    id: 'white',
    name: 'White',
    group: 'noise',
    hint: 'Every frequency at equal power. Bright, and best at masking speech.',
    swatch: '#f3f1ec',
    tone: '#e9e6df',
  },
  {
    id: 'pink',
    name: 'Pink',
    group: 'noise',
    hint: 'Highs roll off gently. Sounds like steady rainfall on a roof.',
    swatch: '#f0a6b6',
    tone: '#f0a6b6',
  },
  {
    id: 'brown',
    name: 'Brown',
    group: 'noise',
    hint: 'Deep and rounded, like a distant waterfall.',
    swatch: '#8a5634',
    tone: '#c08458',
  },
  {
    id: 'grey',
    name: 'Grey',
    group: 'noise',
    hint: 'Shaped so every pitch sounds equally loud to the ear.',
    swatch: '#a3a29d',
    tone: '#b9b8b2',
  },
  {
    id: 'deep',
    name: 'Deep brown',
    group: 'noise',
    hint: 'Brown noise with the highs taken out. A low, heavy rumble.',
    swatch: '#3d261a',
    tone: '#9a6a4c',
  },
  {
    id: 'rain',
    name: 'Rain',
    group: 'nature',
    hint: 'Soft rain on a window, heard from indoors.',
    swatch: 'linear-gradient(160deg, #8496ab 0%, #3e4c5e 100%)',
    tone: '#8fa3bb',
  },
  {
    id: 'stream',
    name: 'Stream',
    group: 'nature',
    hint: 'A gentle brook somewhere in the distance.',
    swatch: 'linear-gradient(160deg, #6fb3a4 0%, #1f5a52 100%)',
    tone: '#7cc2b2',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    group: 'nature',
    hint: 'Slow waves on a quiet shore, about one every twelve seconds.',
    swatch: 'linear-gradient(160deg, #4b7fae 0%, #0f2c4a 100%)',
    tone: '#6b9dcc',
  },
  {
    id: 'wind',
    name: 'Breeze',
    group: 'nature',
    hint: 'Soft air moving through the trees.',
    swatch: 'linear-gradient(160deg, #ccd3c2 0%, #7f8c78 100%)',
    tone: '#bcc7b0',
  },
];

export const soundById = (id: SoundId) => SOUNDS.find((s) => s.id === id)!;
