// AudioWorklet that generates colored noise (and a rain texture) sample by sample.
// Each output channel has its own generator state, so stereo output is decorrelated
// and sounds wide instead of sitting in the middle of the head.
//
// Plain JS on purpose: Vite ships it as-is via `?url` and loads it with
// audioWorklet.addModule().

const PINK_SCALE = 0.11;
const BROWN_SCALE = 3.5;

class ChannelState {
  constructor() {
    // Paul Kellet's pink-noise filter state
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.b3 = 0; this.b4 = 0; this.b5 = 0; this.b6 = 0;
    // Brown-noise integrator
    this.last = 0;
  }

  pink(white) {
    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
    this.b2 = 0.969 * this.b2 + white * 0.153852;
    this.b3 = 0.8665 * this.b3 + white * 0.3104856;
    this.b4 = 0.55 * this.b4 + white * 0.5329522;
    this.b5 = -0.7616 * this.b5 - white * 0.016898;
    const out = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
    this.b6 = white * 0.115926;
    return out * PINK_SCALE;
  }

  // Leaky integration of white noise: -6 dB/octave without drifting off to DC.
  brown(white) {
    this.last = (this.last + 0.02 * white) / 1.02;
    return this.last * BROWN_SCALE;
  }
}

class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.color = opts.color || 'white';
    this.state = [new ChannelState(), new ChannelState()];

    // Rain: a soft pink bed plus individual drops, each a short burst of noise
    // with a fast exponential decay and a random position in the stereo field.
    this.dropsPerSecond = opts.dropsPerSecond || 60;
    this.drops = [];
  }

  spawnDrops(frames) {
    const chance = this.dropsPerSecond / sampleRate;
    for (let i = 0; i < frames; i++) {
      if (Math.random() < chance && this.drops.length < 48) {
        const size = Math.random();
        this.drops.push({
          start: i,
          env: 0.15 + 0.85 * size * size,
          // decay per sample: bigger drops ring a little longer (≈4–25 ms)
          decay: Math.exp(-1 / (sampleRate * (0.004 + 0.021 * size))),
          pan: Math.random(),
        });
      }
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0].length;
    const rain = this.color === 'rain';
    if (rain) this.spawnDrops(frames);

    for (let c = 0; c < output.length; c++) {
      const data = output[c];
      const s = this.state[c & 1];
      switch (this.color) {
        case 'pink':
          for (let i = 0; i < frames; i++) data[i] = s.pink(Math.random() * 2 - 1);
          break;
        case 'brown':
          for (let i = 0; i < frames; i++) data[i] = s.brown(Math.random() * 2 - 1);
          break;
        case 'rain':
          for (let i = 0; i < frames; i++) data[i] = s.pink(Math.random() * 2 - 1) * 0.55;
          break;
        default:
          for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }

    if (rain && this.drops.length) {
      const stereo = output.length > 1;
      for (const drop of this.drops) {
        const left = stereo ? Math.cos(drop.pan * Math.PI * 0.5) : 1;
        const right = Math.sin(drop.pan * Math.PI * 0.5);
        for (let i = drop.start; i < frames; i++) {
          const v = (Math.random() * 2 - 1) * drop.env;
          output[0][i] += v * left;
          if (stereo) output[1][i] += v * right;
          drop.env *= drop.decay;
        }
        drop.start = 0;
      }
      this.drops = this.drops.filter((d) => d.env > 0.001);
    }
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
