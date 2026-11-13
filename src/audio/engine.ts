import workletUrl from './noise-processor.js?url';
import { createProcedural, createRecording, loadManifest, type Source } from './layers';
import type { SoundId } from './sounds';

interface Layer {
  gain: GainNode;
  source?: Source;
  disposeTimer?: number;
}

/** Slider position (0–1) → gain. Squaring makes the slider feel even to the ear. */
const toGain = (v: number) => v * v;

const SMOOTH = 0.08; // seconds, time constant for volume slider changes
const FADE_IN = 1.6; // seconds for a sound to rise to full volume
const FADE_OUT = 1.2; // seconds for the previous sound to fade when switching
const PAUSE_FADE = 0.4;
/**
 * Fade-ins wait this long before rising, so any hiccup while a new sound spins up
 * (first worklet calls, layout work on the page) happens while it is still silent.
 */
const FADE_IN_DELAY = 0.15;

/**
 * Phones and tablets need the MediaStream → <audio> route to keep playing with the
 * screen locked. Desktops don't, and that route can stutter while its buffer settles,
 * so they go straight to the speakers. iPadOS reports itself as a Mac, hence the
 * touch-point check.
 */
const HANDHELD =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * Freezes `param` at its current value and drops anything scheduled after now, so new
 * automation can start from where it actually is (even mid-curve).
 */
function hold(param: AudioParam, now: number) {
  const value = param.value;
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(now);
  } else {
    // Firefox has no cancelAndHoldAtTime
    param.cancelScheduledValues(0);
    param.setValueAtTime(value, now);
  }
  return value;
}

/**
 * Glides `param` to `target` along a raised-cosine S-curve: it starts gently, so a
 * sound swells in rather than arriving at full level.
 */
function ease(ctx: BaseAudioContext, param: AudioParam, target: number, seconds: number, delay = 0) {
  const now = ctx.currentTime;
  const from = hold(param, now);
  const curve = new Float32Array(64);
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    curve[i] = from + (target - from) * (0.5 - 0.5 * Math.cos(Math.PI * t));
  }
  // A tiny offset keeps the curve from touching the held point (overlap throws).
  param.setValueCurveAtTime(curve, now + 0.005 + delay, seconds);
}

/**
 * Owns the Web Audio graph. Only one sound plays at a time; switching sounds
 * fades the old layer out and swells the new one in over about a second and a half.
 *
 *   layer → mix → master (user volume) → duck (focus breaks) → sleep (sleep timer)
 *          → limiter → speakers                    (desktop)
 *          → limiter → MediaStream → <audio>       (phones and tablets)
 *
 * On handhelds the hop through an <audio> element is what keeps playback going with
 * the screen locked and gives the lock screen its controls. If the element can't play,
 * the limiter is connected straight to the speakers instead.
 */
class AudioEngine {
  private ctx?: AudioContext;
  private mix!: GainNode;
  private master!: GainNode;
  private duck!: GainNode;
  private sleep!: GainNode;
  private limiter!: DynamicsCompressorNode;
  private element = new Audio();
  private ready?: Promise<void>;
  private layers = new Map<SoundId, Layer>();
  private current: SoundId | null = null;
  private masterVolume = 0.8;
  private playing = false;

  /** Called when the lock screen or a headset button asks to play or pause. */
  onRemoteToggle: (play: boolean) => void = () => {};

  /**
   * Fetches the worklet and the recordings manifest ahead of time so they are cached
   * by the first click. Needs no user gesture.
   */
  prefetch() {
    void fetch(workletUrl).catch(() => {});
    void loadManifest();
  }

  /**
   * Creates the audio context and starts loading the worklet. Call it from the first
   * pointerdown or keydown: that counts as a user gesture, and it lands a moment
   * before the click that actually starts a sound.
   */
  warm() {
    this.ensureContext();
  }

  /** Must run inside a user gesture (click/tap): browsers only allow audio to start there. */
  start() {
    const ctx = this.ensureContext();
    this.playing = true;
    // Both calls happen synchronously in the gesture; the worklet loads afterwards.
    void ctx.resume();
    if (!this.directOutput) this.element.play().catch(() => this.useDirectOutput());
    const resuming = this.current && this.layers.get(this.current)?.source;
    if (resuming) {
      // The layer is still at full level from before the pause; swell the output instead.
      ease(ctx, this.sleep.gain, 1, FADE_IN, FADE_IN_DELAY);
    } else {
      // A new layer swells itself in once its source is ready (see createLayer).
      hold(this.sleep.gain, ctx.currentTime);
      this.sleep.gain.setValueAtTime(1, ctx.currentTime + 0.005);
    }
    this.updateMediaSession();
    return this.ready!.then(() => this.syncLayers());
  }

  async pause() {
    const ctx = this.ctx;
    this.playing = false;
    this.updateMediaSession();
    if (!ctx) return;
    ease(ctx, this.sleep.gain, 0, PAUSE_FADE);
    await new Promise((r) => setTimeout(r, PAUSE_FADE * 1000 + 50));
    if (this.playing) return;
    if (!this.directOutput) this.element.pause();
    await ctx.suspend();
  }

  get isPlaying() {
    return this.playing;
  }

  setSound(id: SoundId | null) {
    this.current = id;
    if (this.playing) this.syncLayers();
  }

  setMaster(v: number) {
    this.masterVolume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(toGain(v), this.ctx.currentTime, SMOOTH);
  }

  /** Lower everything to `level` (0–1) over `seconds`, e.g. during focus-timer breaks. */
  setDuck(level: number, seconds = 3) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(level, now, seconds / 3);
  }

  /**
   * Holds full volume, then fades linearly to silence so the fade ends after
   * `totalSeconds`. The ramp runs on the audio clock, so it still completes when
   * the page is in the background and its timers are throttled.
   */
  scheduleSleepFade(totalSeconds: number, fadeSeconds: number) {
    if (!this.ctx) return;
    const g = this.sleep.gain;
    const now = this.ctx.currentTime;
    hold(g, now);
    // Rise to full (or stay there) at the usual fade-in pace, so starting a timer
    // together with a sound doesn't cut its swell short.
    g.linearRampToValueAtTime(1, now + FADE_IN);
    g.setValueAtTime(1, now + Math.max(FADE_IN, totalSeconds - fadeSeconds));
    g.linearRampToValueAtTime(0, now + totalSeconds);
  }

  cancelSleepFade() {
    if (!this.ctx) return;
    ease(this.ctx, this.sleep.gain, this.playing ? 1 : 0, 1);
  }

  /**
   * A soft two-note bell for timer transitions. It follows the volume setting (so it is
   * never louder than the sound itself) but skips the break duck so it is still heard.
   */
  chime() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const peak = 0.18 * toGain(this.masterVolume);
    if (peak <= 0) return;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const t = now + i * 0.35;
      const osc = new OscillatorNode(ctx, { frequency: freq });
      const env = new GainNode(ctx, { gain: 0 });
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(env).connect(this.limiter);
      osc.start(t);
      osc.stop(t + 1.7);
    });
  }

  // ---------- internals ----------

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    this.ctx = ctx;

    this.mix = new GainNode(ctx);
    this.master = new GainNode(ctx, { gain: toGain(this.masterVolume) });
    this.duck = new GainNode(ctx);
    this.sleep = new GainNode(ctx, { gain: 0 });
    this.limiter = new DynamicsCompressorNode(ctx, {
      threshold: -6,
      knee: 6,
      ratio: 12,
      attack: 0.005,
      release: 0.25,
    });
    this.mix.connect(this.master).connect(this.duck).connect(this.sleep).connect(this.limiter);

    if (HANDHELD && 'MediaStreamAudioDestinationNode' in window) {
      const dest = new MediaStreamAudioDestinationNode(ctx);
      this.limiter.connect(dest);
      this.element.srcObject = dest.stream;
    } else {
      this.useDirectOutput();
    }

    // iOS 17+: ask for the "playback" session so the mute switch doesn't silence us.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';

    this.setupMediaSession();
    this.ready = ctx.audioWorklet.addModule(workletUrl);
    void loadManifest();

    // Some browsers suspend or "interrupt" the context (a phone call, another app).
    // Try to come back when the page is visible again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.playing && ctx.state !== 'running') {
        void ctx.resume();
        if (!this.directOutput) void this.element.play().catch(() => {});
      }
    });
    return ctx;
  }

  private directOutput = false;
  private useDirectOutput() {
    if (this.directOutput || !this.ctx) return;
    this.directOutput = true;
    this.limiter.disconnect();
    this.limiter.connect(this.ctx.destination);
  }

  private syncLayers() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.current) {
      const existing = this.layers.get(this.current);
      if (!existing) {
        this.createLayer(this.current);
      } else {
        clearTimeout(existing.disposeTimer);
        existing.disposeTimer = undefined;
        // Coming back to a sound that was fading out: swell it back up from where it is.
        if (existing.source) ease(ctx, existing.gain.gain, 1, FADE_IN, FADE_IN_DELAY);
      }
    }
    for (const [id, layer] of this.layers) {
      if (id === this.current || layer.disposeTimer !== undefined) continue;
      ease(ctx, layer.gain.gain, 0, FADE_OUT);
      // Free the nodes once the fade has finished; a silent layer still costs CPU.
      layer.disposeTimer = window.setTimeout(() => this.disposeLayer(id), FADE_OUT * 1000 + 200);
    }
  }

  private createLayer(id: SoundId): Layer {
    const ctx = this.ctx!;
    const layer: Layer = { gain: new GainNode(ctx, { gain: 0 }) };
    layer.gain.connect(this.mix);
    this.layers.set(id, layer);

    void this.ready!.then(() => createRecording(ctx, id)).then((recorded) => {
      if (this.layers.get(id) !== layer) {
        recorded?.stop();
        return;
      }
      layer.source = recorded ?? createProcedural(ctx, id);
      layer.source.output.connect(layer.gain);
      if (this.current === id) ease(ctx, layer.gain.gain, 1, FADE_IN, FADE_IN_DELAY);
    });
    return layer;
  }

  private disposeLayer(id: SoundId) {
    const layer = this.layers.get(id);
    if (!layer) return;
    this.layers.delete(id);
    layer.source?.stop();
    layer.gain.disconnect();
  }

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Whitenoise',
      artist: 'Focus & sleep sounds',
      artwork: [
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
    });
    navigator.mediaSession.setActionHandler('play', () => this.onRemoteToggle(true));
    navigator.mediaSession.setActionHandler('pause', () => this.onRemoteToggle(false));
    navigator.mediaSession.setActionHandler('stop', () => this.onRemoteToggle(false));
  }

  private updateMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
    }
  }
}

export const engine = new AudioEngine();
