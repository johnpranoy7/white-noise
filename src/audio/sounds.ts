export type SoundId =
  | 'blue'
  | 'white'
  | 'grey'
  | 'pink'
  | 'green'
  | 'brown'
  | 'deep'
  | 'rain'
  | 'stream'
  | 'ocean'
  | 'wind'
  | 'underwater'
  | 'fire'
  | 'crickets';

export type SoundGroup = 'noise' | 'nature';

export interface SoundDef {
  id: SoundId;
  name: string;
  group: SoundGroup;
  /** Keyboard shortcut, shown on the tile: digits for noise, the Q row for nature. */
  key: string;
  hint: string;
  /** Swatch fill: the noise's own color, or a gradient for nature sounds. */
  swatch: string;
  /** Accent the page takes on while this sound is selected. */
  tone: string;
}

/** Noise is ordered brightest to darkest, so the grid reads like a spectrum. */
export const SOUNDS: SoundDef[] = [
  {
    id: 'blue',
    name: 'Blue',
    group: 'noise',
    key: '1',
    hint: 'Tilted toward the highs. A bright, airy hiss for focus.',
    swatch: '#7d9bd6',
    tone: '#8fabe0',
  },
  {
    id: 'white',
    name: 'White',
    group: 'noise',
    key: '2',
    hint: 'Every frequency at equal power. Bright, and best at masking speech.',
    swatch: '#f3f1ec',
    tone: '#e9e6df',
  },
  {
    id: 'grey',
    name: 'Grey',
    group: 'noise',
    key: '3',
    hint: 'Shaped so every pitch sounds equally loud to the ear.',
    swatch: '#a3a29d',
    tone: '#b9b8b2',
  },
  {
    id: 'pink',
    name: 'Pink',
    group: 'noise',
    key: '4',
    hint: 'Highs roll off gently. Sounds like steady rainfall on a roof.',
    swatch: '#f0a6b6',
    tone: '#f0a6b6',
  },
  {
    id: 'green',
    name: 'Green',
    group: 'noise',
    key: '5',
    hint: 'Centred on the midrange, like the soft hum of the outdoors.',
    swatch: '#6f9a6c',
    tone: '#8db58a',
  },
  {
    id: 'brown',
    name: 'Brown',
    group: 'noise',
    key: '6',
    hint: 'Deep and rounded, like a distant waterfall.',
    swatch: '#8a5634',
    tone: '#c08458',
  },
  {
    id: 'deep',
    name: 'Deep brown',
    group: 'noise',
    key: '7',
    hint: 'Brown noise with the highs taken out. A low, heavy rumble.',
    swatch: '#3d261a',
    tone: '#9a6a4c',
  },
  {
    id: 'rain',
    name: 'Rain',
    group: 'nature',
    key: 'Q',
    hint: 'Soft rain on a window, heard from indoors.',
    swatch: 'linear-gradient(160deg, #8496ab 0%, #3e4c5e 100%)',
    tone: '#8fa3bb',
  },
  {
    id: 'stream',
    name: 'Stream',
    group: 'nature',
    key: 'W',
    hint: 'A gentle brook somewhere in the distance.',
    swatch: 'linear-gradient(160deg, #6fb3a4 0%, #1f5a52 100%)',
    tone: '#7cc2b2',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    group: 'nature',
    key: 'E',
    hint: 'Slow waves on a quiet shore, about one every twelve seconds.',
    swatch: 'linear-gradient(160deg, #4b7fae 0%, #0f2c4a 100%)',
    tone: '#6b9dcc',
  },
  {
    id: 'wind',
    name: 'Breeze',
    group: 'nature',
    key: 'R',
    hint: 'Soft air moving through the trees.',
    swatch: 'linear-gradient(160deg, #ccd3c2 0%, #7f8c78 100%)',
    tone: '#bcc7b0',
  },
  {
    id: 'underwater',
    name: 'Underwater',
    group: 'nature',
    key: 'T',
    hint: 'A deep, muffled rush with the occasional soft bubble.',
    swatch: 'linear-gradient(160deg, #3b9bb5 0%, #0a2c3d 100%)',
    tone: '#5fb3c9',
  },
  {
    id: 'fire',
    name: 'Campfire',
    group: 'nature',
    key: 'Y',
    hint: 'A crackling campfire outdoors, with the night air moving around it.',
    swatch: 'linear-gradient(160deg, #e0894a 0%, #5a2410 100%)',
    tone: '#e39a62',
  },
  {
    id: 'crickets',
    name: 'Crickets',
    group: 'nature',
    key: 'U',
    hint: 'Crickets on a warm summer night.',
    swatch: 'linear-gradient(160deg, #6b6a9e 0%, #1b1a33 100%)',
    tone: '#8f8ec0',
  },
];

export const soundById = (id: SoundId) => SOUNDS.find((s) => s.id === id)!;

export const soundByKey = (key: string) => SOUNDS.find((s) => s.key === key.toUpperCase());
