# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-page PWA "link hub" for **Victory Church (뉴질랜드 빅토리처치)**. It shows the weekly
memory verse (live from Firestore), shortcut buttons to church links, an "Add to Home Screen"
installer, a TTS "읽어주기" (read-aloud) feature, and background music. UI text is Korean.

There is **no build step and no framework** — plain HTML/CSS/vanilla JS. Firebase SDK is loaded
via ESM CDN imports inside `<script type="module">`. The bulk of the app lives inline in `index.html`.

## Commands

```bash
# Local preview (any static server works)
firebase emulators:start --only hosting     # or: npx serve .

# Deploy hosting (manual)
firebase deploy --only hosting              # project: victorychurch-665a9

# Playwright iOS screenshot/smoke check (from tests/)
cd tests && npm run test:ios                # runs node ios-screenshots.js
cd tests && npm run install:browsers        # first-time: install webkit + chromium
```

Deployment is normally automatic: pushing to `main` triggers `.github/workflows/deploy.yml`
(`FirebaseExtended/action-hosting-deploy`, channel `live`).

## Architecture & gotchas

- **`firebase.json` hosts the repo root (`"public": "."`)**, not the `public/` directory. The
  `ignore` list excludes `public/`, `tests/`, `docs/`, `*.md`, `_*` scratch files, and `*.bak.*`.
  The `public/` folder is a stale duplicate of the served files — treat root files as the source
  of truth and ignore `public/` unless deliberately cleaning it up.
- **Firestore is the only backend.** `index.html` subscribes (`onSnapshot`) to `site/memoryVerse`
  for real-time verse updates; `admin.html` writes to it (`setDoc ... merge`). Doc fields:
  `text`, `reference`, `voiceId`, `updatedAt`. Path is defined once in `firebase-config.js`
  as `VERSE_DOC_PATH`.
- **`admin.html` (served at `/admin` via `cleanUrls`)** is gated only by `ADMIN_PASSCODE` in
  `firebase-config.js` — this is screen-level UX, NOT security. Real write protection must come
  from `firestore.rules`. Currently the rules `allow write: if true` on `/site/{docId}`; the file
  contains commented options to lock it down with Firebase Auth. See `MEMORY_VERSE_SETUP.md`.
- **`firebase-config.js` is intentionally public** (client config + apiKey). Security relies on
  Firestore rules, not on hiding these values.
- **`a2hs.js`** is a standalone "Add to Home Screen" widget (documented in `README.md`),
  configured via `data-*` attributes on its `<script>` tag. It handles native install prompts
  (Android), iOS Safari share-sheet instructions, and in-app-browser (KakaoTalk/Instagram/etc.)
  "open in external browser" guidance. `index.html` coordinates install button loading state via
  the `appinstalled` and custom `a2hs:result` events.
- **`sw.js` is a no-op service worker** (no caching) — it exists only to satisfy Android's PWA
  installability criteria. It is served with `no-store` headers.
- **Audio is built with the Web Audio API** inside `index.html`: TTS uses an EQ/convolver chain
  for a deeper, cathedral-reverb voice, and BGM (`bgm.mp3`) plays through a gain node with
  fade-in/out, starting at the 48s highlight. AudioContext must be resumed inside a user-gesture
  handler (browser autoplay policy) — note the click-to-resume fallbacks.

## Files to keep in sync

`index.html`, `admin.html`, and `firebase-config.js` historically had to be copied into both the
root and `public/`. Since `firebase.json` now serves the root, edits should go to the **root**
files; `public/` is legacy and excluded from hosting.
