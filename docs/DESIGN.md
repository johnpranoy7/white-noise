# Whitenoise: design

A browser app that plays one calming sound at a time, for focus or for sleep. It is a static site with no backend, served from a small nginx container.

## Goals

- **Calm, not busy.** One sound at a time, nothing starts on its own, and every change in volume is gradual.
- **Works for sleep on a phone.** Keeps playing with the screen locked and fades out on a timer instead of cutting off.
- **Tiny and easy to host.** No audio files are needed, so the whole app is a few hundred kilobytes and runs in one container.

## Architecture

```mermaid
flowchart LR
  UI[React UI<br/>tiles, player, timers] --> Store[Zustand store]
  Store --> Engine[Audio engine]
  Engine --> Layer[Current sound<br/>worklet noise or recording]
  Layer --> Graph[master → duck → sleep fade → limiter]
  Graph --> Out[MediaStream → audio element]
  Out --> Speakers((Speakers /<br/>lock screen))
```

| Part | File | Role |
| --- | --- | --- |
| Noise generator | `src/audio/noise-processor.js` | AudioWorklet producing stereo white, pink, brown and blue noise and the rain texture |
| Sound builders | `src/audio/layers.ts` | Shapes each sound from noise with filters and slow LFOs, or loads a recording |
| Engine | `src/audio/engine.ts` | Owns the Web Audio graph, fades, timers and the Media Session |
| Store | `src/state/store.ts` | App state: current sound, playing, volume, timers |
| UI | `src/App.tsx`, `src/components/` | Stage, sound grid and player |

### Audio graph

```
current sound ─▶ master (volume) ─▶ duck (focus breaks) ─▶ sleep (fade/timer) ─▶ limiter ─▶ MediaStream ─▶ <audio>
```

- **One layer at a time.** Selecting a sound creates its layer; the previous one fades out and is disconnected so it stops using CPU.
- **Fades** use a raised-cosine S-curve that starts from the parameter's current value, so a sound swells in (about 1.6 s), the old one fades out (1.2 s), and quick switches never jump.
- **Duck** lowers everything to 25% during focus-timer breaks.
- **Sleep** holds full volume, then ramps to silence over the last half of the timer (up to 20 minutes). The ramp is scheduled on the audio clock, so it still finishes when the browser throttles the page's timers.
- **Limiter** (a fast compressor at −6 dB) catches peaks.
- **Output through an `<audio>` element.** iOS pauses plain Web Audio when the screen locks; routing the mix through a MediaStream into a media element keeps it playing and gives lock-screen controls. If the element can't play, the engine falls back to connecting straight to the speakers.

## Sound design

### Noise (generated)

Listed brightest to darkest, the order they appear in the grid:

| Sound | How it's made |
| --- | --- |
| Blue | First difference of pink noise: differencing adds +6 dB/octave, so −3 becomes +3 dB/octave |
| White | Uniform random samples |
| Grey | White noise shaped by an inverted equal-loudness curve (lows and highs lifted, 2–5 kHz dipped) |
| Pink | White noise through Paul Kellet's filter (−3 dB/octave) |
| Green | Pink noise band-limited to about 120 Hz–1.8 kHz with a gentle lift near 500 Hz |
| Brown | Leaky integration of white noise (−6 dB/octave) |
| Deep brown | Brown noise low-passed at 160 Hz |

Each stereo channel has its own generator, so the sound is wide rather than centred.

Left out on purpose: **violet** (+6 dB/octave) is harsh and mostly used for tinnitus masking; **black** usually means silence; **orange** has no agreed definition.

### Nature (generated, replaceable by recordings)

These are tuned for relaxation: dark (most energy below ~2.5 kHz), slow movement (LFOs of 0.03–0.4 Hz), no sharp transients and no resonant whistles.

| Sound | Approach |
| --- | --- |
| Rain | Many quiet drops blurred into a soft patter, low-passed at 2.6 kHz, with a low brown-noise body and slowly drifting intensity |
| Stream | Two broad, gently drifting bands over a low bed |
| Ocean | One slow LFO opens the filter and raises the level together (a wave every ~12 s); a slower one varies wave size |
| Breeze | A wide, low band drifting very slowly, with a soft low bed |
| Underwater | A deep, muffled rush that swells slowly, with occasional soft bubbles (short sines that rise in pitch as they fade) |
| Campfire | A flickering, airy low roar, a faint hiss, and sparse soft crackles kept near the centre and low-passed so none are sharp |
| Crickets | Five crickets at different distances, each chirping 3–4 smooth pulses of a 4–5 kHz tone at its own rhythm, over quiet night air; kept about 5 dB under the other sounds |

Left out on purpose: **lake shore** (tried, but Crickets was preferred), **cat purr** (tried; the synthesised pulses sounded like helicopter blades), **thunder** (sudden rumbles), **cave drips** (random and startling), **waterfall** and **heavy rain** (too close to brown noise and Rain), and **birdsong / forest** (only convincing as real recordings).

A recording listed in `public/sounds/manifest.json` replaces the synthesised version. Recordings get a 2 s equal-power crossfade baked into the loop point (no seam) and are normalised to the same loudness.

### Levels

Every sound is trimmed to about −16 dB RMS at full volume, measured by rendering each one offline. Deep brown sits about 2 dB higher because low sounds feel quieter to the ear, and blue about 1.5 dB lower because its energy sits where the ear is most sensitive. The volume slider is squared before it reaches the gain, so it feels even.

## Interaction design

- **Nothing plays on load.** No sound is preselected, and the play button is disabled until a sound is chosen. Only the volume is remembered between visits.
- **The tile is the control.** Tapping a tile plays it; tapping the playing tile pauses it; tapping another switches. Each tile shows its key: `1`–`7` for noise and `Q`–`U` for nature.
- **No mixing.** Generated noise and recorded nature sounds don't blend well, and choosing one sound is calmer than balancing several.
- **Timers live in a popover**, anchored to the Timer button on desktop and shown as a sheet above the dock on phones. Running timers appear as countdown pills that cancel when tapped.

## Visual design

- **Type:** Instrument Serif for display (the sound's name, set very large) and Geist for UI text. Both are self-hosted.
- **Color:** a warm near-black (dark mode) or paper off-white (light mode). The page background takes on a faint tint of the selected sound, animated through a registered `@property`.
- **Noise tiles** are swatches in each noise's color, textured with fine vertical lines made from SVG turbulence (high horizontal, near-zero vertical frequency) and a light film grain. The lines drift slowly while the sound plays.
- **Nature tiles** are soft gradients with a line icon.
- **Layout:** two columns on desktop (a sticky stage on the left, the sound grid on the right). Noise tiles sit four over three, sized from the grid's width with container query units so both rows are the same height. On phones the player becomes a floating dock at the bottom.
- **Motion** is slow and optional: everything respects `prefers-reduced-motion`.

## Deployment

- **Image:** multi-stage Dockerfile. Node builds the static site; `nginxinc/nginx-unprivileged` serves it on port 8080 as a non-root user, with a `/healthz` health check.
- **nginx:** long-lived caching for hashed assets, no-cache for the app shell and service worker, correct audio MIME types, gzip, and a strict Content-Security-Policy. `FRAME_ANCESTORS` controls which sites may embed the app.
- **CI:** GitHub Actions builds amd64 and arm64 images on every push to `main` and pushes `latest`, `sha-<commit>` and branch tags to Docker Hub (`johnpranoy7/white-noise`, when its secrets are set) and GHCR. An optional `DEPLOY_WEBHOOK` secret triggers a redeploy.
- **Hosting:** any container host; put it behind HTTPS (reverse proxy, tunnel or CDN), which the service worker and background playback need.

## Known limits and next steps

- **Background playback on iOS** needs a real-device test over HTTPS.
- **Nature sounds** are synthesised stand-ins; CC0 field recordings would sound more natural and can be dropped in without code changes.
- **PWA offline install** has only been verified at the server level (correct headers); confirm it in Chrome once deployed.
