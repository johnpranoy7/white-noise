import type { SoundId } from './sounds';

/** One playing sound: everything it creates ends in `output`, and `stop()` tears it down. */
export interface Source {
  output: AudioNode;
  stop(): void;
}

type NoiseColor = 'white' | 'pink' | 'brown' | 'rain';

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
 * Output trim per sound, measured so each one sits near -16 dB RMS at full volume.
 * Deep brown and wind are left a little hotter/softer by ear.
 */
const LEVEL: Record<SoundId, number> = {
  white: 0.8,
  pink: 1.13,
  brown: 1.5,
  grey: 1.45,
  deep: 1,
  rain: 1.35,
  stream: 2.9,
  ocean: 1.15,
  wind: 2.3,
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
    case 'rain':
      output = chain(
        keep(noise(ctx, 'rain', { dropsPerSecond: 70 })),
        keep(filter(ctx, 'highpass', 450)),
        keep(filter(ctx, 'lowpass', 9000)),
        keep(gain(ctx, 0.9)),
      );
      break;
    case 'stream': {
      // Several resonances drifting at unrelated rates give the "babble" of water.
      const src = keep(noise(ctx, 'white'));
      const mix = keep(gain(ctx, 0.6));
      const bands: [number, number, number][] = [
        [450, 4, 0.31],
        [900, 5, 0.53],
        [1700, 6, 0.83],
        [3100, 5, 1.27],
      ];
      for (const [freq, q, rate] of bands) {
        const bp = keep(filter(ctx, 'bandpass', freq, q));
        nodes.push(lfo(ctx, rate, freq * 0.25, bp.frequency, 0.2));
        nodes.push(lfo(ctx, rate * 2.7, freq * 0.12, bp.frequency, 0.2));
        src.connect(bp).connect(mix);
      }
      const bed = chain(keep(noise(ctx, 'brown')), keep(filter(ctx, 'lowpass', 600)), keep(gain(ctx, 0.5)));
      bed.connect(mix);
      output = mix;
      break;
    }
    case 'ocean': {
      // One slow LFO opens the filter and raises the level together: a wave every ~12 s.
      const lp = keep(filter(ctx, 'lowpass', 700, 0.6));
      const amp = keep(gain(ctx, 0.55));
      chain(keep(noise(ctx, 'pink')), lp, amp);
      const brown = keep(noise(ctx, 'brown'));
      brown.connect(lp);
      nodes.push(lfo(ctx, 0.083, 550, lp.frequency));
      nodes.push(lfo(ctx, 0.083, 0.4, amp.gain));
      output = amp;
      break;
    }
    case 'wind': {
      const bp = keep(filter(ctx, 'bandpass', 520, 1.4));
      const amp = keep(gain(ctx, 1.1));
      chain(keep(noise(ctx, 'pink')), bp, amp);
      nodes.push(lfo(ctx, 0.05, 220, bp.frequency, 0.3));
      nodes.push(lfo(ctx, 0.13, 120, bp.frequency, 0.3));
      nodes.push(lfo(ctx, 0.07, 0.45, amp.gain, 0.3));
      output = amp;
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
