import workletUrl from './noise-processor.js?url';
import { createProcedural, createRecording, loadManifest, type Source } from './layers';
import type { SoundId, Volumes } from './sounds';

interface Layer {
  gain: GainNode;
  source?: Source;
  disposeTimer?: number;
}

/** Slider position (0–1) → gain. Squaring makes the slider feel even to the ear. */
const toGain = (v: number) => v * v;

const SMOOTH = 0.08; // seconds, time constant for volume changes

/**
 * Owns the Web Audio graph:
 *
 *   layers → mix → master (user volume) → duck (focus breaks) → sleep (sleep timer)
 *          → limiter → MediaStream → <audio>
 *
 * The final hop through an <audio> element is what keeps iOS playing with the screen
 * locked and what gives the lock screen its controls. If the element can't play, the
 * limiter is connected straight to the speakers instead.
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
  private volumes: Partial<Volumes> = {};
  private masterVolume = 0.8;
  private playing = false;

  /** Called when the lock screen or a headset button asks to play or pause. */
  onRemoteToggle: (play: boolean) => void = () => {};

  /** Must run inside a user gesture (click/tap): browsers only allow audio to start there. */
  start() {
    const ctx = this.ensureContext();
    this.playing = true;
    // Both calls happen synchronously in the gesture; the worklet loads afterwards.
    void ctx.resume();
    this.element.play().catch(() => this.useDirectOutput());
    this.sleep.gain.cancelScheduledValues(ctx.currentTime);
    this.sleep.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    this.updateMediaSession();
    return this.ready!.then(() => this.syncLayers());
  }

  async pause() {
    const ctx = this.ctx;
    this.playing = false;
    this.updateMediaSession();
    if (!ctx) return;
    // Short fade so pausing doesn't click.
    this.sleep.gain.cancelScheduledValues(ctx.currentTime);
    this.sleep.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    await new Promise((r) => setTimeout(r, 250));
    if (this.playing) return;
    this.element.pause();
    await ctx.suspend();
  }

  get isPlaying() {
    return this.playing;
  }

  setVolumes(volumes: Volumes) {
    this.volumes = { ...volumes };
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
    g.cancelScheduledValues(now);
    g.setValueAtTime(1, now);
    g.setValueAtTime(1, now + Math.max(0, totalSeconds - fadeSeconds));
    g.linearRampToValueAtTime(0, now + totalSeconds);
  }

  cancelSleepFade() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sleep.gain.cancelScheduledValues(now);
    this.sleep.gain.setTargetAtTime(this.playing ? 1 : 0, now, 0.3);
  }

  /** A soft two-note bell for timer transitions. Bypasses the duck so it is always heard. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const t = now + i * 0.35;
      const osc = new OscillatorNode(ctx, { frequency: freq });
      const env = new GainNode(ctx, { gain: 0 });
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.02);
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

    if ('MediaStreamAudioDestinationNode' in window) {
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
        void this.element.play().catch(() => {});
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
    for (const [id, v] of Object.entries(this.volumes) as [SoundId, number][]) {
      const layer = this.layers.get(id);
      if (v > 0) {
        const target = layer ?? this.createLayer(id);
        clearTimeout(target.disposeTimer);
        target.disposeTimer = undefined;
        target.gain.gain.setTargetAtTime(toGain(v), ctx.currentTime, SMOOTH);
      } else if (layer && layer.disposeTimer === undefined) {
        layer.gain.gain.setTargetAtTime(0, ctx.currentTime, SMOOTH);
        // Free the nodes once the fade has finished; a silent layer still costs CPU.
        layer.disposeTimer = window.setTimeout(() => this.disposeLayer(id), 600);
      }
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
      artwork: [{ src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }],
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
