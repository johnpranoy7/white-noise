import type { SoundId } from './sounds';

/** One playing sound: everything it creates ends in `output`, and `stop()` tears it down. */
export interface Source {
  output: AudioNode;
  stop(): void;
}

type NoiseColor =
  | 'white'
  | 'pink'
  | 'brown'
  | 'blue'
  | 'rain'
  | 'crackle'
  | 'bubbles'
  | 'crickets';

function noise(ctx: AudioContext, color: NoiseColor, extra: Record<string, number> = {}) {
  return new AudioWorkletNode(ctx, 'noise-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { color, ...extra },
  });
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, Q = 0.707, gain = 0) {
  return new BiquadFilterNode(ctx, { type, frequency, Q, gain });
}

function gain(ctx: AudioContext, value: number) {
  return new GainNode(ctx, { gain: value });
}

/**
 * A sine LFO that adds `depth` × sin to `param` (the param's own value is the centre).
 * `jitter` detunes the rate a little so layers and sessions don't move in lockstep.
 */
function lfo(ctx: AudioContext, hz: number, depth: number, param: AudioParam, jitter = 0) {
  const rate = hz * (1 + (Math.random() * 2 - 1) * jitter);
  const osc = new OscillatorNode(ctx, { frequency: rate });
  osc.connect(gain(ctx, depth)).connect(param);
  osc.start();
  return osc;
}

function chain(...nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

function stopAll(nodes: AudioNode[]) {
  return () => {
    for (const n of nodes) {
      if (n instanceof AudioScheduledSourceNode) n.stop();
      if (n instanceof AudioWorkletNode) n.port.close();
      n.disconnect();
    }
  };
}

/**
 * Output trim per sound so each sits near -16 dB RMS at full volume (measured by
 * rendering each one offline). Deep brown is left ~2 dB hotter because low sounds
 * read quieter to the ear; blue ~1.5 dB softer because its energy sits where the
 * ear is most sensitive.
 */
const LEVEL: Record<SoundId, number> = {
  blue: 1.2,
  green: 1.05,
  white: 0.55,
  pink: 0.82,
  brown: 0.79,
  grey: 0.99,
  deep: 0.65,
  rain: 1.6,
  stream: 1.37,
  ocean: 1.05,
  wind: 1.76,
  underwater: 0.85,
  fire: 1,
  // ~5 dB under the rest: steady 4–5 kHz tones sit where the ear is most sensitive.
  crickets: 2,
};

/**
 * Sounds synthesised from noise. Colored noise is exact; the nature sounds are
 * stand-ins that are used whenever no recording is listed in public/sounds/manifest.json.
 */
export function createProcedural(ctx: AudioContext, id: SoundId): Source {
  const nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(n: T) => (nodes.push(n), n);
  let output: AudioNode;

  switch (id) {
    case 'blue':
      output = keep(noise(ctx, 'blue'));
      break;
    case 'green':
      // Pink noise kept to roughly 120 Hz–1.8 kHz with a gentle lift around 500 Hz:
      // the broad middle hum of the outdoors, without deep rumble or hiss.
      output = chain(
        keep(noise(ctx, 'pink')),
        keep(filter(ctx, 'highpass', 120, 0.5)),
        keep(filter(ctx, 'lowpass', 1800, 0.5)),
        keep(filter(ctx, 'peaking', 500, 0.7, 3)),
      );
      break;
    case 'white':
      output = keep(noise(ctx, 'white'));
      break;
    case 'pink':
      output = keep(noise(ctx, 'pink'));
      break;
    case 'brown':
      output = keep(noise(ctx, 'brown'));
      break;
    case 'grey':
      // Roughly an inverted equal-loudness curve: lift lows and highs, dip 2–5 kHz.
      output = chain(
        keep(noise(ctx, 'white')),
        keep(filter(ctx, 'lowshelf', 250, 0.707, 12)),
        keep(filter(ctx, 'peaking', 3500, 0.7, -9)),
        keep(filter(ctx, 'highshelf', 11000, 0.707, 4)),
        keep(gain(ctx, 0.45)),
      );
      break;
    case 'deep':
      output = chain(
        keep(noise(ctx, 'brown')),
        keep(filter(ctx, 'lowpass', 160, 0.5)),
        keep(gain(ctx, 1.8)),
      );
      break;
    case 'rain': {
      // Rain heard from indoors: many quiet drops blurred into a soft patter, the
      // highs rolled off (no hiss), a low body underneath, and intensity drifting slowly.
      const amp = keep(gain(ctx, 0.85));
      chain(
        keep(noise(ctx, 'rain', { dropsPerSecond: 160, dropGain: 0.3 })),
        keep(filter(ctx, 'highpass', 150)),
        keep(filter(ctx, 'lowpass', 2600, 0.5)),
        amp,
      );
      chain(keep(noise(ctx, 'brown')), keep(filter(ctx, 'lowpass', 400)), keep(gain(ctx, 0.35)), amp);
      nodes.push(lfo(ctx, 0.035, 0.12, amp.gain, 0.3));
      output = amp;
      break;
    }
    case 'stream': {
      // A distant brook: broad, gently drifting bands over a low bed. Low Q and slow
      // movement keep it from sounding bubbly or busy.
      const src = keep(noise(ctx, 'pink'));
      const mix = keep(gain(ctx, 0.7));
      const bands: [number, number, number][] = [
        [650, 1.1, 0.23],
        [1500, 1.3, 0.37],
      ];
      for (const [freq, q, rate] of bands) {
        const bp = keep(filter(ctx, 'bandpass', freq, q));
        nodes.push(lfo(ctx, rate, freq * 0.12, bp.frequency, 0.2));
        src.connect(bp).connect(mix);
      }
      chain(keep(noise(ctx, 'brown')), keep(filter(ctx, 'lowpass', 900)), keep(gain(ctx, 0.6)), mix);
      output = chain(mix, keep(filter(ctx, 'lowpass', 3500, 0.5)));
      break;
    }
    case 'ocean': {
      // A slow LFO opens the filter and raises the level together: a wave every ~12 s.
      // A second, slower one varies wave size so the rhythm doesn't feel mechanical.
      const lp = keep(filter(ctx, 'lowpass', 550, 0.5));
      const amp = keep(gain(ctx, 0.55));
      chain(keep(noise(ctx, 'pink')), keep(gain(ctx, 0.7)), lp, amp);
      chain(keep(noise(ctx, 'brown')), lp);
      nodes.push(lfo(ctx, 0.083, 380, lp.frequency));
      nodes.push(lfo(ctx, 0.083, 0.33, amp.gain));
      nodes.push(lfo(ctx, 0.029, 120, lp.frequency));
      nodes.push(lfo(ctx, 0.029, 0.1, amp.gain));
      output = amp;
      break;
    }
    case 'wind': {
      // A breeze through trees: a wide, low band that drifts very slowly. Low Q keeps
      // out the whistle that makes synthetic wind sound eerie.
      const bp = keep(filter(ctx, 'bandpass', 380, 0.6));
      const amp = keep(gain(ctx, 0.8));
      chain(keep(noise(ctx, 'pink')), keep(filter(ctx, 'lowpass', 1100, 0.5)), bp, amp);
      chain(keep(noise(ctx, 'brown')), keep(gain(ctx, 0.25)), amp);
      nodes.push(lfo(ctx, 0.03, 120, bp.frequency, 0.3));
      nodes.push(lfo(ctx, 0.071, 60, bp.frequency, 0.3));
      nodes.push(lfo(ctx, 0.045, 0.3, amp.gain, 0.3));
      output = amp;
      break;
    }
    case 'underwater': {
      // Heard from below the surface: a deep, muffled rush that swells slowly, with
      // the occasional soft bubble drifting past.
      const amp = keep(gain(ctx, 0.9));
      const lp = keep(filter(ctx, 'lowpass', 320, 0.7));
      chain(keep(noise(ctx, 'brown')), lp, amp);
      nodes.push(lfo(ctx, 0.05, 80, lp.frequency, 0.3));
      nodes.push(lfo(ctx, 0.037, 0.15, amp.gain, 0.3));
      chain(
        keep(noise(ctx, 'bubbles', { bubblesPerSecond: 1.6 })),
        keep(filter(ctx, 'lowpass', 1400, 0.5)),
        keep(gain(ctx, 0.35)),
        amp,
      );
      output = amp;
      break;
    }
    case 'fire': {
      // A campfire outdoors: a low, airy roar that flickers, a faint hiss, and soft
      // crackles kept near the middle. The crackles are low-passed so none are sharp.
      const mix = keep(gain(ctx, 1));
      const roar = keep(gain(ctx, 0.8));
      chain(keep(noise(ctx, 'brown')), keep(filter(ctx, 'lowpass', 600, 0.5)), roar, mix);
      nodes.push(lfo(ctx, 0.11, 0.12, roar.gain, 0.3));
      nodes.push(lfo(ctx, 0.37, 0.06, roar.gain, 0.3));
      chain(keep(noise(ctx, 'pink')), keep(filter(ctx, 'bandpass', 2500, 0.6)), keep(gain(ctx, 0.06)), mix);
      chain(
        keep(
          noise(ctx, 'crackle', {
            dropsPerSecond: 9,
            dropGain: 0.9,
            bedLevel: 0,
            decayMin: 0.0015,
            decayRange: 0.006,
            panWidth: 0.35,
          }),
        ),
        keep(filter(ctx, 'lowpass', 3800, 0.5)),
        keep(gain(ctx, 0.5)),
        mix,
      );
      output = mix;
      break;
    }
    case 'crickets': {
      // A few crickets at different distances over a quiet night-air bed. Their
      // tones are kept soft; high steady pitches can bother some listeners.
      const mix = keep(gain(ctx, 1));
      chain(keep(noise(ctx, 'crickets', { count: 5 })), keep(filter(ctx, 'lowpass', 6500, 0.5)), mix);
      chain(keep(noise(ctx, 'pink')), keep(filter(ctx, 'lowpass', 500, 0.5)), keep(gain(ctx, 0.15)), mix);
      output = mix;
      break;
    }
    default:
      throw new Error(`Unknown sound: ${id satisfies never}`);
  }

  output = output.connect(keep(gain(ctx, LEVEL[id])));
  return { output, stop: stopAll(nodes) };
}

// ---------- Recorded loops ----------

let manifest: Promise<Partial<Record<SoundId, string>>> | undefined;

/** public/sounds/manifest.json maps a sound id to a file in public/sounds/. */
export function loadManifest() {
  manifest ??= fetch('/sounds/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifest;
}

const buffers = new Map<string, Promise<AudioBuffer>>();

/**
 * Bakes a crossfade into the buffer: the last `fade` seconds are blended into the
 * first `fade` seconds and then cut off, so a plain looping source has no seam.
 */
function makeSeamless(ctx: AudioContext, src: AudioBuffer, fade = 2): AudioBuffer {
  const fadeLen = Math.min(Math.floor(fade * src.sampleRate), Math.floor(src.length / 3));
  const len = src.length - fadeLen;
  const out = ctx.createBuffer(src.numberOfChannels, len, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const input = src.getChannelData(c);
    const data = out.getChannelData(c);
    data.set(input.subarray(0, len));
    for (let i = 0; i < fadeLen; i++) {
      // equal-power crossfade
      const t = i / fadeLen;
      data[i] = input[i] * Math.sin(t * Math.PI * 0.5) + input[len + i] * Math.cos(t * Math.PI * 0.5);
    }
  }
  return out;
}

/** Scales a recording in place to about -16 dB RMS so it sits level with the generated sounds. */
function normalize(buf: AudioBuffer, targetDb = -16): AudioBuffer {
  let sum = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    for (const x of buf.getChannelData(c)) sum += x * x;
  }
  const rms = Math.sqrt(sum / (buf.length * buf.numberOfChannels));
  if (rms > 0) {
    const scale = Math.min(10 ** (targetDb / 20) / rms, 8);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
  }
  return buf;
}

function loadBuffer(ctx: AudioContext, file: string) {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(`/sounds/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => normalize(makeSeamless(ctx, buf)));
    p.catch(() => buffers.delete(file));
    buffers.set(file, p);
  }
  return p;
}

export async function createRecording(ctx: AudioContext, id: SoundId): Promise<Source | null> {
  const file = (await loadManifest())[id];
  if (!file) return null;
  try {
    const buffer = await loadBuffer(ctx, file);
    const node = new AudioBufferSourceNode(ctx, { buffer, loop: true });
    // Start at a random point so two sessions don't sound identical.
    node.start(0, Math.random() * buffer.duration);
    return { output: node, stop: () => (node.stop(), node.disconnect()) };
  } catch (err) {
    console.warn(`Falling back to synthesised ${id}:`, err);
    return null;
  }
}
