# AGENTS.md — synemar-web

Web port of 0xRavenBlack/synemar (Electron music visualizer, MIT). Static site:
`index.html` + `renderer/*.js` + `vendor/jsmediatags.min.js`. No bundler, no backend,
no build step. Deploy by serving the folder as-is (GitHub Pages friendly).

## Architecture

- `renderer/web-api.js` — the ONLY web-specific module. Defines `window.api` with the
  same surface the old Electron preload exposed, so the rest of the renderer runs
  unchanged: file picking via hidden `<input type=file>`, audio/video files served as
  blob URLs, tags via bundled jsmediatags, recording/playlist saved as downloads,
  fullscreen via the Fullscreen API, canvas presets mapped to recording output size
  (persisted in `localStorage` as `synemar-web.recSize`). Also exposes
  `window.webApi` for debugging.
- Everything else in `renderer/` is the upstream engine (UMD modules on `window`):
  audio graph + beat detection (`audio.js`), draw layers (`effects.js`,
  `particles.js`, `smoke.js`), playlist state (`playlistManager.js`, persisted in
  `localStorage` under `neoneq.playlist`), recording (`recording.js`).
- Web-specific adaptations (kept minimal, all in the fork):
  - `playlist.js` `mediaUrl()` passes `blob:` URLs through untouched.
  - `playlistManager.js` `addAudioTrack/addVideoTrack` take an optional `fileName`
    (blob URLs have no readable name).
  - `renderer.js` threads `fileName` through `playAudioFile`/`addVideoFile`,
    passes `getOutputSize` into the Recorder, and prunes dead `blob:` tracks after
    `manager.load()` (blob URLs die on reload).
  - `recording.js` `captureComposite()` renders at the chosen recording size
    (default: screen), scaling the DOM overlay layer to match; capture DPR capped at 2.
  - `ui.js` canvas presets set the recording size; size note reflects it.
  - `styles.css` ends with a touch/small-screen block (`@media (max-width: 720px)`,
    `@media (pointer: coarse)`).

## Conventions

- Plain JS, no ESM, no bundler; 2-space indent; comment-free code.
- `node --check` every touched JS file before finishing.
- `vendor/jsmediatags.min.js` was bundled from the jsmediatags npm package with
  esbuild (`--format=iife --global-name=jsmediatags`, node-only readers external).
  Re-bundle the same way if it ever needs updating.
- Keep the diff to upstream small and explicit so future upstream merges stay easy.

## Testing

- `node --check` on all renderer files.
- Serve locally (`python3 -m http.server`) and load in Chromium; the console must be
  error-free on boot.
- End-to-end: drop an MP3 (with ID3 tags) onto the page → title/artist appear and
  playback starts; drop an MP4 → `body.has-vid` and background crossfade runs;
  press R → recording starts; press R again → a video file downloads and is
  non-empty. `test-media/` (gitignored) holds generated fixtures; see below.
- Mobile check: emulate a 390×844 viewport, confirm no horizontal overflow and the
  dock wraps without overlapping the transport controls.
