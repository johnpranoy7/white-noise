# Whitenoise

Noise and nature sounds for focus and sleep, generated live in the browser.

- **Noise:** white, pink, brown, grey and deep brown, synthesised in an AudioWorklet. No audio files, and it never repeats.
- **Nature:** rain, stream, ocean and breeze, tuned to be soft and slow for sleep. Synthesised by default; drop in a CC0 recording to replace any of them.
- **One sound at a time.** Nothing plays until you pick one. Sounds swell in over about 1.6 s, switching crossfades, and picking the playing sound pauses it.
- **Keyboard:** `Space` plays/pauses, `1`–`9` pick a sound.
- **Sleep timer** that fades out over its last stretch instead of cutting off, and a **focus timer** (25/5 or 50/10) that lowers the sound during breaks.
- Keeps playing with the phone locked, with lock-screen controls (Media Session). Installable as a PWA.

Stack: React + TypeScript + Vite, the raw Web Audio API, Zustand, vite-plugin-pwa. It ships as a small non-root nginx container (amd64 + arm64).

The design and the reasoning behind it are in [docs/DESIGN.md](docs/DESIGN.md).

## Develop

```bash
npm install
npm run dev
```

## How the audio works

```
current sound (crossfades on switch) ─▶ master ─▶ duck (focus breaks) ─▶ sleep fade ─▶ limiter ─▶ MediaStream ─▶ <audio>
```

- `src/audio/noise-processor.js` generates stereo white/pink/brown noise and the rain texture (a pink bed plus randomly placed drops).
- `src/audio/layers.ts` builds each sound from that noise with filters and slow LFOs, or plays a recording if one is listed.
- `src/audio/engine.ts` owns the graph. The last hop goes through an `<audio>` element because that's what keeps iOS playing in the background. The sleep fade is scheduled on the audio clock, so it finishes even while the page's timers are throttled.

## Adding nature recordings

1. Put the loop files in `public/sounds/` (`.m4a`/AAC works in every browser; `.opus` and `.mp3` work too).
2. List them in `public/sounds/manifest.json`:

   ```json
   { "rain": "rain.m4a", "ocean": "ocean.m4a" }
   ```

   Valid ids: `rain`, `stream`, `ocean`, `wind` (shown as Breeze). Noise ids work too, but generated noise is better.
3. Loops don't need to be trimmed: the app crossfades the last 2 s into the start so there's no seam.

Use sounds whose license allows public reuse (for example CC0 on Freesound or Pixabay), and credit them in `public/sounds/CREDITS.md`. Anything without a recording falls back to the synthesised version.

## Deploy (Docker + Portainer + Cloudflare Tunnel)

### 1. Image

Pushing to `main` runs `.github/workflows/docker.yml`, which builds an amd64 + arm64 image and pushes:

- `ghcr.io/johnpranoy7/white-noise:latest`
- `ghcr.io/johnpranoy7/white-noise:sha-<commit>` (for rollbacks)

GHCR packages start out private. Either make the package public (GitHub → your profile → Packages → white-noise → Package settings), or add a GHCR registry in Portainer with a personal access token that has `read:packages`.

Local test:

```bash
docker build -t whitenoise .
docker run --rm -p 8086:8080 whitenoise
```

### 2. Portainer stack

Stacks → Add stack → paste `docker-compose.yml`. The container listens on 8080 inside and is published on host port 8086.

To update by hand: open the stack → **Pull and redeploy**.
To update automatically: enable the stack's webhook in Portainer, copy its URL into a GitHub repository secret named `PORTAINER_WEBHOOK`, and the workflow will call it after each push to `main`.

### 3. Cloudflare Tunnel

In Cloudflare Zero Trust → Networks → Tunnels → your tunnel → Public hostname → Add:

| Field | Value |
| --- | --- |
| Subdomain | `whitenoise` |
| Domain | your domain |
| Service | `http://<server-ip>:8086` (or `http://whitenoise:8080` if cloudflared shares a Docker network with it) |

### 4. Portfolio

Link to `https://whitenoise.yourdomain.com`, or embed it:

```html
<iframe src="https://whitenoise.yourdomain.com" allow="autoplay" style="width:100%;height:900px;border:0"></iframe>
```

Embedding requires `FRAME_ANCESTORS: "'self' https://yourdomain.com"` in the compose file. Note that phones won't keep playing in the background from inside an iframe; linking to the subdomain works best for sleep use.

### Health check

`GET /healthz` returns `ok`. Docker uses it for the container health status.
