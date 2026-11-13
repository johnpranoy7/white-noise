# Whitenoise

Noise and nature sounds for focus and sleep, generated live in the browser.

- **Noise:** white, pink, brown, grey and deep brown, synthesised in an AudioWorklet. No audio files, and it never repeats.
- **Nature:** rain, stream, ocean and breeze, tuned to be soft and slow for sleep. Synthesised by default; drop in a CC0 recording to replace any of them.
- **One sound at a time.** Nothing plays until you pick one. Sounds swell in over about 1.6 s, switching crossfades, and picking the playing sound pauses it.
- **Keyboard:** `Space` plays/pauses, `1`–`9` pick a sound.
- **Sleep timer** that fades out over its last stretch instead of cutting off, and a **focus timer** (25/5 or 50/10) that lowers the sound during breaks.
- Keeps playing with the phone locked, with lock-screen controls (Media Session). Installable as a PWA.

Stack: React + TypeScript + Vite, the raw Web Audio API, Zustand, vite-plugin-pwa. It's a static site with no backend, shipped as a small non-root nginx container (amd64 + arm64).

The design and the reasoning behind it are in [docs/DESIGN.md](docs/DESIGN.md).

## Getting started

Requires Node.js 20.19+ or 22.12+ (needed by Vite 8).

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload at http://localhost:5173 |
| `npm run build` | Type-checks, then builds the static site into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | Type-checks only |

## Project layout

```
src/
  audio/
    noise-processor.js   AudioWorklet: stereo white/pink/brown noise and the rain texture
    layers.ts            Builds each sound from noise (filters, slow LFOs) or loads a recording
    engine.ts            Owns the Web Audio graph, fades, timers and lock-screen controls
    sounds.ts            The list of sounds: names, colors, descriptions
  state/store.ts         App state (Zustand): current sound, playback, volume, timers
  components/            Sound grid, player, slider, icons
  App.tsx, styles.css    Layout and styling
public/sounds/           Optional recordings and their manifest
deploy/                  nginx config template used by the container
docs/DESIGN.md           Design notes
```

## How the audio works

```
current sound ─▶ master ─▶ duck (focus breaks) ─▶ sleep fade ─▶ limiter ─▶ MediaStream ─▶ <audio>
```

- Each sound is built from noise generated in an AudioWorklet, shaped with filters and slow LFOs, or played from a recording if one is listed.
- Fades use an S-curve that starts from the current level, so switching sounds never jumps.
- The last hop goes through an `<audio>` element because that is what keeps iOS playing in the background and shows lock-screen controls.
- The sleep fade is scheduled on the audio clock, so it finishes even while the browser throttles the page's timers.

## Adding nature recordings

1. Put the loop files in `public/sounds/` (`.m4a`/AAC works in every browser; `.opus` and `.mp3` work too).
2. List them in `public/sounds/manifest.json`:

   ```json
   { "rain": "rain.m4a", "ocean": "ocean.m4a" }
   ```

   Valid ids: `rain`, `stream`, `ocean`, `wind` (shown as Breeze). Noise ids work too, but generated noise is better.
3. Loops don't need to be trimmed: the app crossfades the last 2 s into the start so there's no seam, and matches the recording's loudness to the other sounds.

Use sounds whose license allows public reuse (for example CC0 on Freesound or Pixabay), and credit them in `public/sounds/CREDITS.md`. Anything without a recording falls back to the synthesised version.

## Running with Docker

The image builds the site with Node and serves it from `nginx-unprivileged` on port **8080**, as a non-root user.

```bash
docker build -t whitenoise .
docker run --rm -p 8080:8080 whitenoise
```

Or with Compose:

```bash
docker compose up -d
```

A prebuilt multi-arch image is published to GitHub Container Registry:

```bash
docker run --rm -p 8080:8080 ghcr.io/johnpranoy7/white-noise:latest
```

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRAME_ANCESTORS` | `'self'` | Value of the CSP `frame-ancestors` directive: which sites may embed the app in an `<iframe>`. Example: `'self' https://example.com` |

The server also provides:

- `GET /healthz`, which returns `ok` and is used as the container health check.
- Long-lived caching for hashed assets and no-cache for the app shell and service worker, so new deploys reach users straight away.
- A strict Content-Security-Policy and correct MIME types for audio files.

It is a static site, so it can sit behind any reverse proxy, tunnel or CDN. Serve it over HTTPS: the service worker, and background playback on phones, need a secure context.

Embedding in an iframe works on desktop, but phones won't keep playing in the background from inside an iframe; link to the app directly for sleep use.

## Continuous integration

`.github/workflows/docker.yml` builds amd64 and arm64 images on every push to `main` and pushes them to GHCR as `latest` and `sha-<commit>`. Pull requests are built but not pushed.

Optional: set a `DEPLOY_WEBHOOK` repository secret to a URL that accepts a POST (for example a redeploy webhook from your container platform), and the workflow will call it after each push to `main`.
