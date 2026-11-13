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

const MAX_BUBBLES = 16;
const MAX_CRICKETS = 8;
const TAU = Math.PI * 2;

class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.color = opts.color || 'white';
    this.state = [new ChannelState(), new ChannelState()];

    // Drops ('rain' and 'crackle'): short bursts of noise with a fast exponential
    // decay at a random position in the stereo field. Rain lays them over a soft
    // pink bed; campfire crackle uses shorter, sparser bursts with no bed.
    // Everything lives in fixed typed arrays so the audio thread never allocates
    // (and never pauses for garbage collection) while playing.
    this.dropsPerSecond = opts.dropsPerSecond || 60;
    this.dropGain = opts.dropGain ?? 1;
    this.bedLevel = opts.bedLevel ?? 0.55;
    this.decayMin = opts.decayMin ?? 0.006;
    this.decayRange = opts.decayRange ?? 0.024;
    this.panWidth = opts.panWidth ?? 1;
    this.dropCount = 0;
    this.dropStart = new Int32Array(MAX_DROPS);
    this.dropEnv = new Float32Array(MAX_DROPS);
    this.dropDecay = new Float32Array(MAX_DROPS);
    this.dropLeft = new Float32Array(MAX_DROPS);
    this.dropRight = new Float32Array(MAX_DROPS);

    // Bubbles ('bubbles'): a short sine whose pitch rises as it fades, like a
    // small air bubble.
    this.bubblesPerSecond = opts.bubblesPerSecond || 1.5;
    this.bubbleCount = 0;
    this.bubbleStart = new Int32Array(MAX_BUBBLES);
    this.bubblePhase = new Float32Array(MAX_BUBBLES);
    this.bubbleFreq = new Float32Array(MAX_BUBBLES);
    this.bubbleRise = new Float32Array(MAX_BUBBLES);
    this.bubbleEnv = new Float32Array(MAX_BUBBLES);
    this.bubbleDecay = new Float32Array(MAX_BUBBLES);
    this.bubbleLeft = new Float32Array(MAX_BUBBLES);
    this.bubbleRight = new Float32Array(MAX_BUBBLES);

    // Crickets ('crickets'): each one chirps a few soft pulses of a high tone, then
    // rests, at its own steady rhythm and place in the stereo field.
    if (this.color === 'crickets') this.setupCrickets(Math.min(opts.count || 5, MAX_CRICKETS));
  }

  // ---------- drops ----------

  spawnDrops(frames) {
    const chance = this.dropsPerSecond / sampleRate;
    const half = (1 - this.panWidth) / 2;
    for (let i = 0; i < frames; i++) {
      if (Math.random() < chance && this.dropCount < MAX_DROPS) {
        const n = this.dropCount++;
        const size = Math.random();
        const pan = (half + Math.random() * this.panWidth) * Math.PI * 0.5;
        this.dropStart[n] = i;
        this.dropEnv[n] = (0.15 + 0.85 * size * size) * this.dropGain;
        // decay per sample: bigger drops ring a little longer (rain ≈6–30 ms)
        this.dropDecay[n] = Math.exp(-1 / (sampleRate * (this.decayMin + this.decayRange * size)));
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

  renderDrops(outL, outR, frames) {
    let n = 0;
    while (n < this.dropCount) {
      let env = this.dropEnv[n];
      const decay = this.dropDecay[n];
      const left = outR ? this.dropLeft[n] : 1;
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

  // ---------- bubbles ----------

  spawnBubbles(frames) {
    const chance = this.bubblesPerSecond / sampleRate;
    for (let i = 0; i < frames; i++) {
      if (Math.random() < chance && this.bubbleCount < MAX_BUBBLES) {
        const n = this.bubbleCount++;
        const size = Math.random();
        const pan = (0.2 + Math.random() * 0.6) * Math.PI * 0.5;
        const life = 0.04 + 0.08 * size; // seconds to fade
        this.bubbleStart[n] = i;
        this.bubblePhase[n] = 0;
        // bigger bubbles are lower; each rises about 40% in pitch over its life
        this.bubbleFreq[n] = 900 - 600 * size;
        this.bubbleRise[n] = Math.pow(1.4, 1 / (sampleRate * life));
        this.bubbleEnv[n] = 0.25 + 0.5 * Math.random();
        this.bubbleDecay[n] = Math.exp(-1 / (sampleRate * life * 0.35));
        this.bubbleLeft[n] = Math.cos(pan);
        this.bubbleRight[n] = Math.sin(pan);
      }
    }
  }

  removeBubble(n) {
    const last = --this.bubbleCount;
    this.bubbleStart[n] = this.bubbleStart[last];
    this.bubblePhase[n] = this.bubblePhase[last];
    this.bubbleFreq[n] = this.bubbleFreq[last];
    this.bubbleRise[n] = this.bubbleRise[last];
    this.bubbleEnv[n] = this.bubbleEnv[last];
    this.bubbleDecay[n] = this.bubbleDecay[last];
    this.bubbleLeft[n] = this.bubbleLeft[last];
    this.bubbleRight[n] = this.bubbleRight[last];
  }

  renderBubbles(outL, outR, frames) {
    let n = 0;
    while (n < this.bubbleCount) {
      let phase = this.bubblePhase[n];
      let freq = this.bubbleFreq[n];
      let env = this.bubbleEnv[n];
      const rise = this.bubbleRise[n];
      const decay = this.bubbleDecay[n];
      const left = outR ? this.bubbleLeft[n] : 1;
      const right = this.bubbleRight[n];
      for (let i = this.bubbleStart[n]; i < frames; i++) {
        const v = Math.sin(phase) * env;
        outL[i] += v * left;
        if (outR) outR[i] += v * right;
        phase += (TAU * freq) / sampleRate;
        if (phase > TAU) phase -= TAU;
        freq *= rise;
        env *= decay;
      }
      if (env > 0.001) {
        this.bubblePhase[n] = phase;
        this.bubbleFreq[n] = freq;
        this.bubbleEnv[n] = env;
        this.bubbleStart[n] = 0;
        n++;
      } else {
        this.removeBubble(n);
      }
    }
  }

  // ---------- crickets ----------

  setupCrickets(count) {
    this.cricketCount = count;
    this.cricketPhase = new Float32Array(count);
    this.cricketFreq = new Float32Array(count);
    this.cricketTime = new Float32Array(count); // samples into the current chirp cycle
    this.cricketPeriod = new Float32Array(count); // samples per chirp cycle
    this.cricketBasePeriod = new Float32Array(count);
    this.cricketPulse = new Float32Array(count); // samples per pulse
    this.cricketPulses = new Int32Array(count);
    this.cricketGain = new Float32Array(count);
    this.cricketLeft = new Float32Array(count);
    this.cricketRight = new Float32Array(count);
    for (let n = 0; n < count; n++) {
      const period = sampleRate * (0.5 + Math.random() * 0.45);
      const pan = (0.1 + (0.8 * (n + Math.random())) / count) * Math.PI * 0.5;
      this.cricketFreq[n] = 3900 + Math.random() * 1100;
      this.cricketBasePeriod[n] = period;
      this.cricketPeriod[n] = period;
      this.cricketTime[n] = Math.random() * period; // so they don't start in unison
      this.cricketPulse[n] = sampleRate / (26 + Math.random() * 8);
      this.cricketPulses[n] = 3 + Math.floor(Math.random() * 2);
      // nearer and farther crickets
      this.cricketGain[n] = 0.05 + 0.1 * Math.random();
      this.cricketLeft[n] = Math.cos(pan);
      this.cricketRight[n] = Math.sin(pan);
    }
  }

  renderCrickets(outL, outR, frames) {
    for (let n = 0; n < this.cricketCount; n++) {
      let phase = this.cricketPhase[n];
      let t = this.cricketTime[n];
      let period = this.cricketPeriod[n];
      const step = (TAU * this.cricketFreq[n]) / sampleRate;
      const pulse = this.cricketPulse[n];
      const chirpLength = pulse * this.cricketPulses[n];
      const gain = this.cricketGain[n];
      const left = outR ? this.cricketLeft[n] : 1;
      const right = this.cricketRight[n];
      for (let i = 0; i < frames; i++) {
        if (t < chirpLength) {
          // each pulse is a smooth sin² swell, so there are no clicks
          const s = Math.sin((Math.PI * (t % pulse)) / pulse);
          const v = Math.sin(phase) * s * s * gain;
          outL[i] += v * left;
          if (outR) outR[i] += v * right;
        }
        phase += step;
        if (phase > TAU) phase -= TAU;
        if (++t >= period) {
          t = 0;
          // a little variation in the rhythm keeps it from sounding mechanical
          period = this.cricketBasePeriod[n] * (0.92 + Math.random() * 0.16);
        }
      }
      this.cricketPhase[n] = phase;
      this.cricketTime[n] = t;
      this.cricketPeriod[n] = period;
    }
  }

  // ---------- main ----------

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0].length;
    const color = this.color;
    const drops = color === 'rain' || color === 'crackle';
    if (drops) this.spawnDrops(frames);
    if (color === 'bubbles') this.spawnBubbles(frames);

    for (let c = 0; c < output.length; c++) {
      const data = output[c];
      const s = this.state[c & 1];
      switch (color) {
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
        case 'crackle': {
          const bed = this.bedLevel;
          if (bed > 0) for (let i = 0; i < frames; i++) data[i] = s.pink(Math.random() * 2 - 1) * bed;
          else data.fill(0);
          break;
        }
        case 'bubbles':
        case 'crickets':
          data.fill(0);
          break;
        default:
          for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;
    if (drops && this.dropCount) this.renderDrops(outL, outR, frames);
    if (color === 'bubbles' && this.bubbleCount) this.renderBubbles(outL, outR, frames);
    if (color === 'crickets') this.renderCrickets(outL, outR, frames);
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
