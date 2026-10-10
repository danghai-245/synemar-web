# Synemar Web

Fullscreen music visualizer that runs entirely in the browser — on desktop and on phones.
Pick a song, watch the spectrum dance to the beat, add background videos, then record
it all to a video file. No install, no server, no build step: it is a static site.

This is a web port of [synemar](https://github.com/0xRavenBlack/synemar) (MIT), the
Electron music visualizer by 0xRavenBlack. All of the visual engine, beat detection,
particles and recording logic is theirs; this fork replaces the Electron shell with a
small browser adapter (`renderer/web-api.js`) so the same app runs from any static
host (e.g. GitHub Pages).

## Run it

Serve the folder with any static file server and open `index.html`:

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

Or deploy the folder as-is to GitHub Pages / Netlify / Vercel.

## What it does

- Music visualizer driven by the Web Audio FFT: classic bars, radial sunburst, or off
- Beat detection: camera shake, pulsing rings, bass-reactive background videos
- Particles, smoke, aurora glow, golden spiral, CRT scanlines, film grain, VHS wobble
- Combined audio + background playlist (play independently; background videos and
  photos crossfade on their own loop, photos get a slow Ken Burns zoom + beat pump)
- Song title/artist/album read from audio tags (MP3/MP4/FLAC via bundled jsmediatags)
- One-press recording to MP4 (Chrome/Edge/Safari) or WebM (Firefox) via MediaRecorder
- Recording size presets: 1080p, 1440p, 4K, 1:1, 9:16 — recordings match the preset
  exactly, whatever the screen shape (handy for vertical video on desktop)
- Playlists and settings persist in `localStorage`

## Browser notes

- Audio and video files are read locally in your browser; nothing is uploaded.
- On phones, use the playlist button to add files (drag & drop is desktop-only).
- The recording format follows what the browser's MediaRecorder supports: MP4 with
  H.264+AAC where available, otherwise WebM. Safari records MP4.
- A fresh page load cannot re-open files from a previous session (browsers don't
  allow it), so saved playlists are pruned of stale entries on start.

## Files

- `index.html` — the app entry
- `renderer/` — the visual engine (plain JS, no bundler)
  - `web-api.js` — the browser adapter: file picking, tag reading, downloads,
    fullscreen, recording-size presets. This is the only web-specific module.
- `vendor/jsmediatags.min.js` — audio tag reader (bundled from the
  [jsmediatags](https://github.com/aadsm/jsmediatags) npm package, MIT)

## License

MIT — see `LICENSE`. Upstream project: https://github.com/0xRavenBlack/synemar
