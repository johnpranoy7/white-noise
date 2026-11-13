// AudioWorklet that generates colored noise (and a rain texture) sample by sample.
// Each output channel has its own generator state, so stereo output is decorrelated
// and sounds wide instead of sitting in the middle of the head.
//
// Plain JS on purpose: Vite ships it as-is via `?url` and loads it with
// audioWorklet.addModule().

const PINK_SCALE = 0.11;
const MAX_DROPS = 48;
const BROWN_SCALE = 3.5;

class ChannelState {
  constructor() {
    // Paul Kellet's pink-noise filter state
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.b3 = 0; this.b4 = 0; this.b5 = 0; this.b6 = 0;
    // Brown-noise integrator
    this.last = 0;
    // Previous pink sample, for blue noise
    this.prevPink = 0;
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

  // First difference of pink noise: differencing tilts the spectrum up 6 dB/octave,
  // turning pink's -3 dB/octave into blue's +3.
  blue(white) {
    const p = this.pink(white);
    const out = p - this.prevPink;
    this.prevPink = p;
    return out;
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
    // Drops live in fixed typed arrays so the audio thread never allocates (and
    // never pauses for garbage collection) while playing.
    this.dropsPerSecond = opts.dropsPerSecond || 60;
    this.dropGain = opts.dropGain ?? 1;
    this.dropCount = 0;
    this.dropStart = new Int32Array(MAX_DROPS);
    this.dropEnv = new Float32Array(MAX_DROPS);
    this.dropDecay = new Float32Array(MAX_DROPS);
    this.dropLeft = new Float32Array(MAX_DROPS);
    this.dropRight = new Float32Array(MAX_DROPS);
  }

  spawnDrops(frames) {
    const chance = this.dropsPerSecond / sampleRate;
    for (let i = 0; i < frames; i++) {
      if (Math.random() < chance && this.dropCount < MAX_DROPS) {
        const n = this.dropCount++;
        const size = Math.random();
        const pan = Math.random() * Math.PI * 0.5;
        this.dropStart[n] = i;
        this.dropEnv[n] = (0.15 + 0.85 * size * size) * this.dropGain;
        // decay per sample: bigger drops ring a little longer (≈6–30 ms)
        this.dropDecay[n] = Math.exp(-1 / (sampleRate * (0.006 + 0.024 * size)));
        this.dropLeft[n] = Math.cos(pan);
        this.dropRight[n] = Math.sin(pan);
      }
    }
  }

  // Removes drop n by moving the last drop into its slot.
  removeDrop(n) {
    const last = --this.dropCount;
    this.dropStart[n] = this.dropStart[last];
    this.dropEnv[n] = this.dropEnv[last];
    this.dropDecay[n] = this.dropDecay[last];
    this.dropLeft[n] = this.dropLeft[last];
    this.dropRight[n] = this.dropRight[last];
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
        case 'blue':
          for (let i = 0; i < frames; i++) data[i] = s.blue(Math.random() * 2 - 1);
          break;
        case 'rain':
          for (let i = 0; i < frames; i++) data[i] = s.pink(Math.random() * 2 - 1) * 0.55;
          break;
        default:
          for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }

    if (rain && this.dropCount) {
      const stereo = output.length > 1;
      const outL = output[0];
      const outR = stereo ? output[1] : null;
      let n = 0;
      while (n < this.dropCount) {
        let env = this.dropEnv[n];
        const decay = this.dropDecay[n];
        const left = stereo ? this.dropLeft[n] : 1;
        const right = this.dropRight[n];
        for (let i = this.dropStart[n]; i < frames; i++) {
          const v = (Math.random() * 2 - 1) * env;
          outL[i] += v * left;
          if (outR) outR[i] += v * right;
          env *= decay;
        }
        if (env > 0.001) {
          this.dropEnv[n] = env;
          this.dropStart[n] = 0;
          n++;
        } else {
          this.removeDrop(n); // the swapped-in drop is processed next, at the same n
        }
      }
    }
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
