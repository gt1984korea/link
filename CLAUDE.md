# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- **절대 사용자 허락 없이 `git commit` 하지 말 것.** 커밋은 사용자가 명시적으로 요청할 때만 수행한다. (push도 동일)

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
- **Firestore + Storage are the backend.** `index.html` subscribes (`onSnapshot`) to
  `site/memoryVerse` for real-time verse updates; `admin.html` writes to it (`setDoc ... merge`).
  The doc holds a **`verses` array** — each entry `{ id, text, reference, voiceId, startDate,
  endDate ("YYYY-MM-DD"), createdAt }` — plus shared recording fields `audioUrl` / `audioPath` /
  `audioName` and `updatedAt` at the top level. Path is defined once in `firebase-config.js` as
  `VERSE_DOC_PATH`. Everything stays in this **single doc** (no subcollection) so the existing
  `/site/{docId}` rules suffice. Note: array entries use `Date.now()` for `createdAt` because
  Firestore rejects `serverTimestamp()` inside arrays.
- **Date-gated verse display.** `index.html` shows the verse whose `startDate ≤ today ≤ endDate`
  (inclusive, local date; newest `startDate` wins) as "이번 주 암송 구절", and **hides the card** if
  none match. Verses whose `endDate < today` are listed (text only) under the "지난 암송 구절"
  toggle (`classify()` in `index.html`). `admin.html` manages the list with native `<input
  type="date">` From~To pickers. Back-compat: a legacy doc with only a top-level `text` field is
  treated as an always-active verse, and admin pre-fills it for one-click migration into `verses`.
- **Read-aloud audio source priority:** if `audioUrl` is set (an admin-uploaded recording in
  Firebase Storage at `audio/memoryVerse`, rules in `storage.rules`), the "읽어주기" button plays
  that recording instead of ElevenLabs TTS. The recording is played via a plain `Audio` element
  (NOT routed through the Web Audio chain) deliberately — routing cross-origin Storage media
  through `createMediaElementSource` causes silent playback without CORS config, and a human
  recording shouldn't get the synthetic-voice reverb/EQ. BGM (same-origin `bgm.mp3`) still plays
  underneath. See `playRecording()` in `index.html` and `MEMORY_VERSE_SETUP.md`.
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
- **"이미지로 공유" (구절 카드 이미지 생성)**: `#shareBtn` 클릭 시 이미지 공유 모달
  (`#imageShareModal`)이 바로 열린다. 이미지 생성은 1080×1920
  `<canvas id="shareCanvas">`에 배경(그라디언트 4종 또는 사용자 업로드 사진 +
  하단 스크림)과 구절 텍스트를 그려서 만든다. 텍스트는 `verse.text`의 `\n`
  줄바꿈을 그대로 사용하고, 'Gowun Dodum' 폰트는 `document.fonts.ready` 이후에
  그려야 폴백 폰트로 깨지지 않는다.
  출력은 `canvas.toBlob('image/png')` → `navigator.canShare({ files })`가
  true면 "공유하기"(파일 공유), 아니면 "공유하기" 버튼을 숨기고 "저장"
  (다운로드)만 노출한다. 전부 클라이언트 로컬 처리이며 Firestore/Storage에는
  아무것도 쓰지 않는다.

## Files to keep in sync

`index.html`, `admin.html`, and `firebase-config.js` historically had to be copied into both the
root and `public/`. Since `firebase.json` now serves the root, edits should go to the **root**
files; `public/` is legacy and excluded from hosting.
