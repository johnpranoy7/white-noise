// Lock-screen test page: plays the same soft noise four different ways so we can see
// which one iOS shows title and artwork for, and which keeps playing when locked.
// Not part of the app; served at /lab/lockscreen.html.

const logEl = document.getElementById('log');
const log = (msg) => {
  logEl.textContent += `${new Date().toLocaleTimeString()}  ${msg}\n`;
};

let ctx = null;
let elements = [];
let blobUrl = null;

function stop() {
  for (const el of elements) {
    el.pause();
    el.srcObject = null;
    el.removeAttribute('src');
    el.load();
  }
  elements = [];
  if (ctx) {
    void ctx.close();
    ctx = null;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
}

function setMetadata(variant) {
  if (!('mediaSession' in navigator)) {
    log('Media Session not supported in this browser');
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `Test ${variant}`,
    artist: 'Whitenoise lab',
    album: 'Lock-screen test',
    artwork: [{ src: '/artwork/pink.jpg', sizes: '512x512', type: 'image/jpeg' }],
  });
  navigator.mediaSession.playbackState = 'playing';
}

function registerHandlers() {
  if (!('mediaSession' in navigator)) return;
  const actions = {
    play: () => {
      log('lock screen: play');
      for (const el of elements) void el.play();
      void ctx?.resume();
    },
    pause: () => {
      log('lock screen: pause');
      for (const el of elements) el.pause();
      void ctx?.suspend();
    },
    nexttrack: () => log('lock screen: next'),
    previoustrack: () => log('lock screen: previous'),
  };
  for (const [action, handler] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* unsupported action */
    }
  }
}

// A soft, steady noise: white noise through a gentle low-pass, quiet.
function noiseGraph(context) {
  const seconds = 4;
  const buffer = context.createBuffer(2, context.sampleRate * seconds, context.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = new AudioBufferSourceNode(context, { buffer, loop: true });
  const lp = new BiquadFilterNode(context, { type: 'lowpass', frequency: 900 });
  const gain = new GainNode(context, { gain: 0.12 });
  src.connect(lp).connect(gain);
  src.start();
  return gain;
}

// Variant D: render the noise into a 16-bit WAV file in memory.
function noiseWavUrl() {
  const rate = 22050;
  const seconds = 10;
  const frames = rate * seconds;
  const bytes = new ArrayBuffer(44 + frames * 4);
  const v = new DataView(bytes);
  const text = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + frames * 4, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, frames * 4, true);
  // one-pole low-pass per channel to soften it like the other variants
  const state = [0, 0];
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < 2; c++) {
      state[c] += 0.12 * (Math.random() * 2 - 1 - state[c]);
      v.setInt16(44 + (i * 2 + c) * 2, Math.max(-1, Math.min(1, state[c] * 1.2)) * 32767, true);
    }
  }
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

function playElement(el, label) {
  el.addEventListener('playing', () => log(`${label}: playing`));
  el.play().then(
    () => log(`${label}: play() ok`),
    (err) => log(`${label}: play() failed: ${err.name}`),
  );
  elements.push(el);
}

// Everything that starts audio runs synchronously inside the tap, as iOS requires.
function start(variant) {
  stop();
  registerHandlers();
  const useStream = variant === 'A' || variant === 'C';
  const useSilent = variant === 'B' || variant === 'C';

  if (variant === 'D') {
    blobUrl = noiseWavUrl();
    const el = new Audio(blobUrl);
    el.loop = true;
    playElement(el, 'audio file');
  } else {
    ctx = new AudioContext();
    void ctx.resume();
    const out = noiseGraph(ctx);
    if (useStream) {
      const dest = new MediaStreamAudioDestinationNode(ctx);
      out.connect(dest);
      const el = new Audio();
      el.srcObject = dest.stream;
      playElement(el, 'stream element');
    } else {
      out.connect(ctx.destination);
    }
    if (useSilent) {
      const silent = new Audio('/lab/silence.wav');
      silent.loop = true;
      playElement(silent, 'silent file');
    }
  }

  setMetadata(variant);
  // iOS may only accept the details once playback is running, so send them again.
  setTimeout(() => setMetadata(variant), 800);
  log(`started variant ${variant}`);
}

for (const button of document.querySelectorAll('[data-variant]')) {
  button.addEventListener('click', () => start(button.dataset.variant));
}
document.getElementById('stop').addEventListener('click', () => {
  stop();
  log('stopped');
});
document.addEventListener('visibilitychange', () => log(`page ${document.visibilityState}`));
