# Whitenoise

Noise and nature sounds for focus and sleep, generated live in the browser.

- **Noise:** blue, white, grey, pink, green, brown and deep brown, synthesised in an AudioWorklet. No audio files, and it never repeats.
- **Nature:** rain, stream, ocean, breeze, underwater, campfire and crickets, tuned to be soft and slow for sleep. Synthesised by default; drop in a CC0 recording to replace any of them.
- **One sound at a time.** Nothing plays until you pick one. Sounds swell in over about 1.6 s, switching crossfades, and picking the playing sound pauses it.
- **Keyboard:** `Space` plays/pauses, `1`–`7` pick a noise, `Q`–`U` pick a nature sound.
- **Sleep timer** that fades out over its last stretch instead of cutting off, and a **focus timer** (25/5 or 50/10) that lowers the sound during breaks.
- Keeps playing with the phone locked, with lock-screen controls (Media Session). Installable as a PWA.

Stack: React + TypeScript + Vite, the raw Web Audio API, Zustand, vite-plugin-pwa. It's a static site with no backend, shipped as a small non-root nginx container (amd64 + arm64).

## Documentation

| Document | What's in it |
| --- | --- |
| [docs/DESIGN.md](docs/DESIGN.md) | Architecture, audio engine, sound recipes, playback and timers, lock screen, interface, install, SEO, deployment, decisions and known limits, with diagrams |
| [docs/HEALTH.md](docs/HEALTH.md) | Health and safety: research, what the app does about volume, children, sudden sounds and flicker, and what it doesn't claim |
| [SECURITY.md](SECURITY.md) | Privacy, threat model, HTTP headers, container and pipeline hardening, how to report a vulnerability |
| [docs/LICENSING.md](docs/LICENSING.md) | Licenses of the code, fonts and libraries, rules for adding recordings, name and claims |

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
    noise-processor.js   AudioWorklet: stereo noise colors plus rain drops, fire crackle, bubbles and crickets
    layers.ts            Builds each sound from noise (filters, slow LFOs) or loads a recording
    engine.ts            Owns the Web Audio graph, fades, timers and lock-screen controls
    sounds.ts            The list of sounds: names, keys, colors, descriptions
  state/store.ts         App state (Zustand): current sound, playback, volume, settings, timers
  components/            Sound grid, player, settings, install button, about, icons
  App.tsx, styles.css    Layout and styling
public/sounds/           Optional recordings and their manifest
public/artwork/          Lock-screen artwork, one per sound
deploy/                  nginx config template and startup script used by the container
scripts/notices.mjs      Regenerates public/third-party-notices.txt (npm run notices)
docs/                    Design, health and licensing notes
```

## How the audio works

```
current sound ─▶ master ─▶ duck (focus breaks) ─▶ sleep fade ─▶ limiter ─┬─▶ speakers                    (desktop)
                                                                          └─▶ MediaStream ─▶ <audio>       (phones, tablets)
```

- Each sound is built from noise generated in an AudioWorklet, shaped with filters and slow LFOs, or played from a recording if one is listed.
- Fades use an S-curve that starts from the current level, so switching sounds never jumps.
- On phones and tablets the last hop goes through an `<audio>` element, which keeps iOS playing with the screen locked and shows the lock-screen controls, title and artwork. Desktops connect straight to the speakers.
- The sleep fade is scheduled on the audio clock, so it finishes even while the browser throttles the page's timers.

## Adding nature recordings

1. Put the loop files in `public/sounds/` (`.m4a`/AAC works in every browser; `.opus` and `.mp3` work too).
2. List them in `public/sounds/manifest.json`:

   ```json
   { "rain": "rain.m4a", "ocean": "ocean.m4a" }
   ```

   Valid ids: `rain`, `stream`, `ocean`, `wind` (shown as Breeze), `underwater`, `fire`, `crickets`. Noise ids work too, but generated noise is better.
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

A prebuilt multi-arch image is published to Docker Hub (and mirrored to GitHub Container Registry as `ghcr.io/johnpranoy7/white-noise`):

```bash
docker run --rm -p 8080:8080 johnpranoy7/white-noise:latest
```

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRAME_ANCESTORS` | `'self'` | Value of the CSP `frame-ancestors` directive: which sites may embed the app in an `<iframe>`. Example: `'self' https://example.com` |
| `SITE_URL` | empty | The site's public address, such as `https://whitenoise.example.com`. Fills in the canonical link, the social-card URLs and the structured data, and generates `robots.txt` and `sitemap.xml`. When empty, those tags are left out. |

The server also provides:

- `GET /healthz`, which returns `ok` and is used as the container health check.
- Long-lived caching for hashed assets and no-cache for the app shell and service worker, so new deploys reach users straight away.
- A strict Content-Security-Policy and correct MIME types for audio files.

It is a static site, so it can sit behind any reverse proxy, tunnel or CDN. Serve it over HTTPS: the service worker, and background playback on phones, need a secure context.

Embedding in an iframe works on desktop, but phones won't keep playing in the background from inside an iframe; link to the app directly for sleep use.

## Continuous integration

`.github/workflows/docker.yml` builds amd64 and arm64 images on every push to `main` and tags them `latest`, `sha-<commit>` and the branch name. Pull requests are built but not pushed.

- **GitHub Container Registry:** always, using the built-in `GITHUB_TOKEN`.
- **Docker Hub:** when the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets are set. The token is a Docker Hub access token with Read & Write permission. Without them, the workflow pushes to GHCR only and logs a warning.

Optional: set a `DEPLOY_WEBHOOK` repository secret to a URL that accepts a POST (for example a redeploy webhook from your container platform), and the workflow will call it after each push to `main`.

## License

The code is released under the [MIT License](LICENSE). The bundled fonts, Instrument Serif and Geist, are under the SIL Open Font License.

The license texts of everything that ships to the browser (React, Zustand, the fonts, and the Workbox service-worker runtime) are in [`public/third-party-notices.txt`](public/third-party-notices.txt), served at `/third-party-notices.txt` and linked from the app's footer. Regenerate it with `npm run notices` after adding or updating a dependency that reaches the browser.

All sounds are generated by the code in this repository; no recordings are included. If you add recordings to `public/sounds/`, check each file's license and credit its author in `public/sounds/CREDITS.md` where required.

Made by [John Pranoy Yalla](https://johnpranoy7.dev). See [more projects](https://johnpranoy7.dev/projects).
