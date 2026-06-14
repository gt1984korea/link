# 구절 "이미지로 공유" 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "이번 주 구절" 카드의 공유 버튼을 확장해, 배경(그라디언트 4종 또는 사용자
사진)에 구절 텍스트를 입힌 9:16 이미지를 만들어 공유/저장할 수 있게 한다.

**Architecture:** 모든 변경은 `index.html` 한 파일 내에서 이루어진다. 기존
`#shareBtn` 클릭은 바텀시트("텍스트로 공유"/"이미지로 공유")를 열도록 바뀌고,
"이미지로 공유"는 새 모달을 연다. 모달은 1080×1920 `<canvas>`에 배경+텍스트를
그려 미리보기를 보여주고, `canvas.toBlob()` → `navigator.share`(파일) 또는
다운로드로 출력한다.

**Tech Stack:** Vanilla JS (`<script type="module">` 내부), Canvas 2D API,
Web Share API (`navigator.canShare`/`navigator.share` with files), 기존 CSS
변수(`--brand`, `--brand-dim`, `--line`, `--text`, `--text-2`).

**참고 설계 문서:** `docs/superpowers/specs/2026-06-15-verse-image-share-design.md`

---

## 커밋에 대한 주의사항

이 프로젝트 `CLAUDE.md` 규칙: **사용자의 명시적 허락 없이 `git commit`을 하지
않는다.** 아래 각 Task의 "커밋" 스텝은 작업 단위를 나타내기 위한 것이며,
실제로는 사용자가 커밋을 요청했을 때만 실행한다. (한 번에 모아서 커밋해도 됨)

---

## 파일 구조

- **Modify:** `index.html`
  - CSS: 공유 시트(바텀시트) + 이미지 공유 모달 스타일 2곳 추가
  - HTML: `#shareSheet`, `#imageShareModal` 마크업 추가 (기존 `#verseModal` 뒤)
  - JS (module script, `<script type="module">` 내부):
    - 기존 `shareBtn` 핸들러를 액션 시트 오픈으로 변경, 텍스트 공유 로직은
      `shareAsText()` 함수로 추출
    - 캔버스 렌더링(배경 스타일 정의, 그라디언트/사진 배경, 텍스트 레이아웃)
    - 스와치 선택 / 내 사진 업로드 / 공유·저장 버튼 핸들러
- **Create:** `tests/image-share.test.js` — 로컬 서버 대상 Playwright 테스트
  (`tests/bank-buttons.test.js` 패턴 따름)
- **Modify:** `tests/package.json` — `test:image-share` 스크립트 추가
- **Modify:** `CLAUDE.md` — 새 기능의 비자명한 구현 포인트 기록

---

### Task 1: CSS — 공유 액션 시트 & 이미지 공유 모달 스타일

**Files:**
- Modify: `index.html:709-718` (시트 스타일 삽입 위치), `index.html:1082-1090`
  (이미지 모달 스타일 삽입 위치)

- [ ] **Step 1: 공유 액션 시트(바텀시트) CSS 추가**

`index.html`에서 다음 블록을 찾는다 (약 709~718행):

```css
    @media (prefers-reduced-motion: reduce) {
      .va-btn.pop .va-ic { animation: none; }
    }

    /* Footer */
```

`@media (prefers-reduced-motion: reduce) { ... }` 블록과 `/* Footer */` 주석
사이에 아래 CSS를 삽입한다:

```css

    /* 공유 액션 시트 (바텀시트: 텍스트로 공유 / 이미지로 공유) */
    .sheet-overlay { align-items: flex-end; }
    .sheet-overlay .sheet-content {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: 20px 20px 0 0;
      padding: 10px 14px calc(18px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -8px 30px rgba(0, 0, 0, .15);
      transform: translateY(100%);
      transition: transform .25s ease;
    }
    .sheet-overlay.show .sheet-content {
      transform: translateY(0);
    }
    .sheet-handle {
      width: 36px;
      height: 4px;
      background: #d8dde6;
      border-radius: 2px;
      margin: 8px auto 12px;
    }
    .sheet-option {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 14px 8px;
      border-radius: 12px;
      border: none;
      background: none;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: background .15s ease;
    }
    .sheet-option:hover, .sheet-option:active { background: var(--brand-dim); }
    .sheet-ic {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--brand-dim);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
    }
    .sheet-ic.sheet-ic-active { background: var(--brand); }
    .sheet-body { display: flex; flex-direction: column; gap: 2px; }
    .sheet-title { font-weight: 700; font-size: 14px; color: var(--text); }
    .sheet-title.sheet-title-active { color: var(--brand); }
    .sheet-desc { font-size: 12px; color: var(--text-2); }
```

- [ ] **Step 2: 이미지 공유 모달 CSS 추가**

`index.html`에서 다음 블록을 찾는다 (약 1082~1092행):

```css
    .modal-body-ref {
      font-family: 'Gowun Dodum', sans-serif;
      display: block;
      font-size: 18px;
      color: var(--text-2);
      font-weight: 700;
      text-align: center;
      margin: 0;
    }

    /* 알림 차단 해제 안내 팝업 */
```

`.modal-body-ref { ... }` 블록과 `/* 알림 차단 해제 안내 팝업 */` 주석 사이에
아래 CSS를 삽입한다:

```css

    /* 이미지로 공유 모달 */
    .image-share-content {
      width: 92%;
      max-width: 360px;
      padding: 20px 16px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .image-share-preview {
      width: 100%;
      max-width: 240px;
      aspect-ratio: 9 / 16;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .2);
    }
    .image-share-preview canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .image-share-swatches {
      display: flex;
      gap: 10px;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .swatch {
      flex: 0 0 auto;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      border: 2px solid transparent;
      padding: 0;
      cursor: pointer;
      transition: border-color .15s ease, transform .1s ease;
    }
    .swatch:active { transform: scale(.95); }
    .swatch.active { border-color: var(--brand); }
    .swatch[data-style="brandBlue"]    { background: linear-gradient(160deg, #21428d 0%, #3a5fb8 55%, #6f8fd6 100%); }
    .swatch[data-style="pastelFloral"] { background: linear-gradient(165deg, #f6d9e3 0%, #fbeede 55%, #f3e6d8 100%); }
    .swatch[data-style="darkModern"]   { background: linear-gradient(160deg, #2b2b3a 0%, #4a4a63 100%); }
    .swatch[data-style="warmBeige"]    { background: linear-gradient(160deg, #fdf6ec 0%, #f1e3c8 100%); }
    .swatch.swatch-photo {
      background: #eef1f7;
      border: 1.5px dashed #9aa6c4;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .swatch.swatch-photo.active { border-style: solid; }
    .image-share-actions {
      display: flex;
      gap: 10px;
      width: 100%;
    }
    .img-share-btn {
      flex: 1;
      padding: 12px;
      border-radius: 50px;
      border: 1.5px solid var(--line);
      background: #f3f4f6;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
    }
    .img-share-btn:hover { background: #ebedf0; }
    .img-share-btn.primary {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
    }
```

- [ ] **Step 3: 브라우저로 확인**

`npx serve .`로 로컬 서버를 띄우고 `index.html`을 열어 콘솔 에러가 없는지
확인한다 (아직 새 HTML이 없으므로 화면 변화는 없음 — CSS만 추가된 상태).

---

### Task 2: HTML — 공유 액션 시트 & 이미지 공유 모달 마크업

**Files:**
- Modify: `index.html:1592-1594`

- [ ] **Step 1: 마크업 추가**

`index.html`에서 다음 부분을 찾는다 (약 1590~1594행, `#verseModal` 닫는 태그
직후):

```html
      </div>
    </div>
  </div>

  <!-- 알림 차단 해제 안내 팝업 -->
```

`</div>`(verseModal의 `.modal-overlay` 닫는 태그, 1592행)와
`<!-- 알림 차단 해제 안내 팝업 -->` 주석 사이에 아래 마크업을 삽입한다:

```html

  <!-- 공유 액션 시트: 텍스트로 공유 / 이미지로 공유 -->
  <div class="modal-overlay sheet-overlay" id="shareSheet" role="dialog" aria-modal="true" aria-label="공유 방법 선택">
    <div class="sheet-content">
      <div class="sheet-handle"></div>
      <button class="sheet-option" id="shareTextOption" type="button">
        <span class="sheet-ic">🔗</span>
        <span class="sheet-body">
          <span class="sheet-title">텍스트로 공유</span>
          <span class="sheet-desc">구절 내용 + 링크 공유</span>
        </span>
      </button>
      <button class="sheet-option" id="shareImageOption" type="button">
        <span class="sheet-ic sheet-ic-active">🖼️</span>
        <span class="sheet-body">
          <span class="sheet-title sheet-title-active">이미지로 공유</span>
          <span class="sheet-desc">배경 골라 카드 이미지 만들기</span>
        </span>
      </button>
    </div>
  </div>

  <!-- 이미지로 공유 모달 -->
  <div class="modal-overlay" id="imageShareModal" role="dialog" aria-modal="true" aria-label="이미지로 공유">
    <div class="modal-content image-share-content">
      <button class="modal-close" id="imageShareCloseBtn" aria-label="닫기">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="image-share-preview">
        <canvas id="shareCanvas" width="1080" height="1920" aria-label="구절 이미지 미리보기"></canvas>
      </div>
      <div class="image-share-swatches" id="shareSwatches">
        <button class="swatch" data-style="brandBlue" type="button" aria-label="브랜드 블루"></button>
        <button class="swatch" data-style="pastelFloral" type="button" aria-label="파스텔 플로럴"></button>
        <button class="swatch" data-style="darkModern" type="button" aria-label="다크 모던"></button>
        <button class="swatch" data-style="warmBeige" type="button" aria-label="웜 베이지"></button>
        <button class="swatch swatch-photo" data-style="photo" type="button" aria-label="내 사진 배경으로 사용">📷</button>
      </div>
      <input type="file" id="sharePhotoInput" accept="image/*" class="hidden">
      <div class="image-share-actions">
        <button class="img-share-btn primary" id="imgShareBtn" type="button">공유하기</button>
        <button class="img-share-btn" id="imgSaveBtn" type="button">저장</button>
      </div>
    </div>
  </div>
```

> `.hidden` 클래스는 이 프로젝트에서 이미 `display:none` 유틸리티로 쓰이고
> 있으므로(예: `#verseCard.hidden`, `#pastToggle.hidden`) 별도 정의가 필요 없다.

- [ ] **Step 2: 브라우저로 확인**

`npx serve .`로 로컬 서버를 띄우고 페이지를 열어:
- 콘솔 에러가 없는지 확인
- 페이지 맨 아래쪽에 시트/모달이 평소엔 보이지 않는지 확인 (`.modal-overlay`는
  기본적으로 `opacity:0; pointer-events:none`)

---

### Task 3: JS — 공유 액션 시트 동작 (텍스트 공유 로직 추출 + 시트 열기/닫기)

**Files:**
- Modify: `index.html:2268-2286`

- [ ] **Step 1: 기존 `shareBtn` 핸들러를 교체**

`index.html`에서 다음 블록을 찾는다 (약 2268~2286행):

```js
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const text = (window.currentFullVerseText || '').trim();
      const ref  = (window.currentFullVerseRef || '').trim();
      const body = ref ? (text + '\n\n' + ref) : text;
      const url  = location.href;
      if (navigator.share) {
        try {
          await navigator.share({ title: '빅토리처치 이번 주 성경 구절', text: body, url });
        } catch (e) { /* 사용자가 공유 취소 — 무시 */ }
      } else {
        // 공유 미지원(주로 데스크톱): 링크 복사 fallback
        try {
          await navigator.clipboard.writeText(body + '\n' + url);
          if (window.showToast) window.showToast('구절과 링크를 복사했어요');
        } catch (e) {
          if (window.showToast) window.showToast('공유를 지원하지 않는 브라우저예요');
        }
      }
    });
```

아래 코드로 교체한다:

```js
    // 구절 + 링크를 텍스트로 공유 (기존 동작)
    async function shareAsText() {
      const text = (window.currentFullVerseText || '').trim();
      const ref  = (window.currentFullVerseRef || '').trim();
      const body = ref ? (text + '\n\n' + ref) : text;
      const url  = location.href;
      if (navigator.share) {
        try {
          await navigator.share({ title: '빅토리처치 이번 주 성경 구절', text: body, url });
        } catch (e) { /* 사용자가 공유 취소 — 무시 */ }
      } else {
        // 공유 미지원(주로 데스크톱): 링크 복사 fallback
        try {
          await navigator.clipboard.writeText(body + '\n' + url);
          if (window.showToast) window.showToast('구절과 링크를 복사했어요');
        } catch (e) {
          if (window.showToast) window.showToast('공유를 지원하지 않는 브라우저예요');
        }
      }
    }

    // 공유 액션 시트: "텍스트로 공유" / "이미지로 공유" 선택
    const shareSheet = document.getElementById('shareSheet');
    const shareTextOption = document.getElementById('shareTextOption');
    const shareImageOption = document.getElementById('shareImageOption');

    function openShareSheet() {
      shareSheet.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeShareSheet() {
      shareSheet.classList.remove('show');
      document.body.style.overflow = '';
    }
    shareSheet.addEventListener('click', (e) => {
      if (e.target === shareSheet) closeShareSheet();
    });

    if (shareBtn) shareBtn.addEventListener('click', openShareSheet);

    shareTextOption.addEventListener('click', () => {
      closeShareSheet();
      shareAsText();
    });
    shareImageOption.addEventListener('click', () => {
      closeShareSheet();
      openImageShareModal();
    });
```

> `openImageShareModal`은 Task 4에서 정의되는 함수 선언(`function` 선언은
> 모듈 내에서 호이스팅됨)이므로, 클릭 시점(전체 스크립트 실행 이후)에는 정상
> 호출된다. Task 4 완료 전까지는 "이미지로 공유" 클릭 시 `ReferenceError`가
> 발생하지만, 이는 다음 Task에서 바로 해결된다.

- [ ] **Step 2: 브라우저로 "텍스트로 공유" 동작 확인**

`npx serve .` 로컬 서버에서 페이지를 열고:
1. 공유 버튼(`#shareBtn`) 클릭 → 하단에서 시트가 올라오며 2개 옵션이 보이는지 확인
2. "텍스트로 공유" 클릭 → 시트가 닫히고, 기존과 동일하게 공유 시트(모바일) 또는
   클립보드 복사 토스트(데스크톱)가 동작하는지 확인
3. 시트를 다시 열고 바깥 영역 클릭 → 시트가 닫히는지 확인

(이 단계에서 "이미지로 공유" 클릭 시 콘솔에 `openImageShareModal is not defined`
에러가 나는 것은 정상 — Task 4에서 해결됨)

---

### Task 4: JS — 캔버스 렌더링 (배경 스타일 + 텍스트) & 모달 열기/닫기

**Files:**
- Modify: `index.html` — Task 3에서 추가한 블록 바로 다음 (기존 `const
  PAST_PAGE_SIZE = 5;` 줄, 약 2288행, 바로 앞)

- [ ] **Step 1: 캔버스 렌더링 + 모달 제어 코드 추가**

`index.html`에서 다음 줄을 찾는다 (Task 3에서 추가한 블록 바로 다음, 약 2288행):

```js
    const PAST_PAGE_SIZE = 5; // 한 번에 보여줄 지난 구절 개수 (나머지는 "더 보기"로 펼침)
```

이 줄 **앞**에 아래 코드를 삽입한다:

```js
    /* ───────── 이미지로 공유: 캔버스 렌더링 ───────── */
    const SHARE_STYLES = {
      brandBlue:    { type: 'gradient', stops: ['#21428d', '#3a5fb8', '#6f8fd6'], textColor: '#ffffff' },
      pastelFloral: { type: 'gradient', stops: ['#f6d9e3', '#fbeede', '#f3e6d8'], textColor: '#7a4a55' },
      darkModern:   { type: 'gradient', stops: ['#2b2b3a', '#4a4a63'],            textColor: '#ffffff' },
      warmBeige:    { type: 'gradient', stops: ['#fdf6ec', '#f1e3c8'],            textColor: '#8a6d3b' },
      photo:        { type: 'photo',                                              textColor: '#ffffff' },
    };

    const shareCanvas = document.getElementById('shareCanvas');
    const shareCtx = shareCanvas.getContext('2d');
    const shareSwatches = Array.from(document.querySelectorAll('#shareSwatches .swatch'));
    let currentShareStyle = 'brandBlue';
    let sharePhotoImg = null;

    function drawGradientBackground(stops) {
      const W = shareCanvas.width, H = shareCanvas.height;
      const grad = shareCtx.createLinearGradient(0, 0, W, H);
      const step = stops.length > 1 ? 1 / (stops.length - 1) : 0;
      stops.forEach((color, i) => grad.addColorStop(i * step, color));
      shareCtx.fillStyle = grad;
      shareCtx.fillRect(0, 0, W, H);
    }

    function drawPhotoBackground(img) {
      const W = shareCanvas.width, H = shareCanvas.height;
      const canvasRatio = W / H;
      const imgRatio = img.width / img.height;
      let sx, sy, sw, sh;
      if (imgRatio > canvasRatio) {
        sh = img.height;
        sw = sh * canvasRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = sw / canvasRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      shareCtx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      // 하단 50%에 어두운 스크림 (텍스트 가독성)
      const scrim = shareCtx.createLinearGradient(0, H, 0, H * 0.5);
      scrim.addColorStop(0, 'rgba(20,20,30,0.7)');
      scrim.addColorStop(1, 'rgba(20,20,30,0.05)');
      shareCtx.fillStyle = scrim;
      shareCtx.fillRect(0, H * 0.5, W, H * 0.5);
    }

    // 본문 줄들이 maxWidth 안에 들어가도록 폰트 크기를 64px→36px 사이에서 축소
    function fitBodyFontSize(lines, maxWidth) {
      let size = 64;
      const minSize = 36;
      shareCtx.font = `700 ${size}px 'Gowun Dodum', 'Malgun Gothic', sans-serif`;
      while (size > minSize) {
        const tooWide = lines.some((line) => shareCtx.measureText(line).width > maxWidth);
        if (!tooWide) break;
        size -= 2;
        shareCtx.font = `700 ${size}px 'Gowun Dodum', 'Malgun Gothic', sans-serif`;
      }
      return size;
    }

    function renderShareCanvas() {
      const style = SHARE_STYLES[currentShareStyle];
      const W = shareCanvas.width, H = shareCanvas.height;

      if (style.type === 'photo') {
        drawPhotoBackground(sharePhotoImg);
      } else {
        drawGradientBackground(style.stops);
      }

      const text = (window.currentFullVerseText || '').trim();
      const ref = (window.currentFullVerseRef || '').trim();
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      const paddingX = 80;
      const maxWidth = W - paddingX * 2;
      const bodySize = fitBodyFontSize(lines, maxWidth);
      const lineHeight = bodySize * 1.6;
      const refSize = 44;

      const totalTextHeight = lines.length * lineHeight;
      const startY = (H - totalTextHeight) / 2 - (ref ? refSize : 0);

      shareCtx.textAlign = 'center';
      shareCtx.textBaseline = 'middle';
      shareCtx.fillStyle = style.textColor;

      shareCtx.font = `700 ${bodySize}px 'Gowun Dodum', 'Malgun Gothic', sans-serif`;
      lines.forEach((line, i) => {
        shareCtx.fillText(line, W / 2, startY + lineHeight * (i + 0.5));
      });

      if (ref) {
        shareCtx.font = `700 ${refSize}px 'Gowun Dodum', 'Malgun Gothic', sans-serif`;
        shareCtx.fillText(ref, W / 2, startY + totalTextHeight + refSize);
      }

      // 워터마크
      shareCtx.globalAlpha = 0.5;
      shareCtx.font = `400 28px 'Gowun Dodum', 'Malgun Gothic', sans-serif`;
      shareCtx.fillText('뉴질랜드 빅토리처치', W / 2, H - 80);
      shareCtx.globalAlpha = 1;
    }

    function setActiveShareStyle(styleName) {
      currentShareStyle = styleName;
      shareSwatches.forEach((el) => el.classList.toggle('active', el.dataset.style === styleName));
      renderShareCanvas();
    }

    /* ───────── 이미지로 공유: 모달 열기/닫기 ───────── */
    const imageShareModal = document.getElementById('imageShareModal');
    const imageShareCloseBtn = document.getElementById('imageShareCloseBtn');

    function openImageShareModal() {
      imageShareModal.classList.add('show');
      document.body.style.overflow = 'hidden';
      // 폰트 로드 완료 후 렌더 — 폴백 폰트로 그려지는 것 방지
      document.fonts.ready.then(() => setActiveShareStyle('brandBlue'));
    }
    function closeImageShareModal() {
      imageShareModal.classList.remove('show');
      document.body.style.overflow = '';
    }
    imageShareCloseBtn.addEventListener('click', closeImageShareModal);
    imageShareModal.addEventListener('click', (e) => {
      if (e.target === imageShareModal) closeImageShareModal();
    });

    // 그라디언트 스와치 클릭 (내 사진 스와치는 Task 5에서 처리)
    shareSwatches.forEach((el) => {
      if (el.dataset.style === 'photo') return;
      el.addEventListener('click', () => setActiveShareStyle(el.dataset.style));
    });

```

- [ ] **Step 2: 브라우저로 확인**

`npx serve .` 로컬 서버에서 페이지를 열고:
1. 공유 버튼 → "이미지로 공유" 클릭 → 모달이 열리고 9:16 카드에 브랜드 블루
   배경 + 구절 텍스트 + 출처 + "뉴질랜드 빅토리처치" 워터마크가 그려지는지 확인
2. 짧은 구절과 긴 구절(관리자에서 임시로 긴 구절을 활성화해 확인하거나, 콘솔에서
   `window.currentFullVerseText`를 임시로 바꿔 `renderShareCanvas()`를 다시
   호출해보는 것도 가능) 모두 카드 안에 잘 들어가는지 확인
3. 파스텔 플로럴/다크 모던/웜 베이지 스와치 클릭 → 배경색과 글자색이 함께
   바뀌는지, 선택된 스와치에 테두리가 표시되는지 확인
4. 모달 닫기(X 버튼, 바깥 클릭) 동작 확인

---

### Task 5: JS — "내 사진" 배경 업로드

**Files:**
- Modify: `index.html` — Task 4에서 추가한 "그라디언트 스와치 클릭" 코드 바로 다음

- [ ] **Step 1: 사진 업로드 핸들러 추가**

Task 4에서 추가한 다음 블록 바로 다음에:

```js
    // 그라디언트 스와치 클릭 (내 사진 스와치는 Task 5에서 처리)
    shareSwatches.forEach((el) => {
      if (el.dataset.style === 'photo') return;
      el.addEventListener('click', () => setActiveShareStyle(el.dataset.style));
    });
```

아래 코드를 추가한다:

```js
    // "내 사진" 스와치 — 클릭 시 파일 선택 다이얼로그 오픈
    const sharePhotoInput = document.getElementById('sharePhotoInput');
    const sharePhotoSwatch = document.querySelector('.swatch.swatch-photo');

    sharePhotoSwatch.addEventListener('click', () => sharePhotoInput.click());

    sharePhotoInput.addEventListener('change', () => {
      const file = sharePhotoInput.files && sharePhotoInput.files[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        sharePhotoImg = img;
        URL.revokeObjectURL(objectUrl);
        setActiveShareStyle('photo');
      };
      img.src = objectUrl;
    });
```

- [ ] **Step 2: 브라우저로 확인**

`npx serve .` 로컬 서버에서 페이지를 열고:
1. 이미지로 공유 모달 → 📷 "내 사진" 스와치 클릭 → 파일 선택 다이얼로그가
   열리는지 확인
2. 사진을 선택 → 캔버스 배경이 선택한 사진(cover-fit)으로 바뀌고, 하단에
   어두운 스크림 위에 흰 글자로 구절이 표시되는지 확인
3. 📷 스와치에 선택 테두리가 표시되는지 확인
4. 다른 스와치(예: 브랜드 블루) 클릭 → 다시 그라디언트 배경으로 전환되는지 확인

---

### Task 6: JS — 공유하기 / 저장 버튼

**Files:**
- Modify: `index.html` — Task 5에서 추가한 코드 바로 다음

- [ ] **Step 1: 공유/저장 핸들러 추가**

Task 5에서 추가한 `sharePhotoInput.addEventListener('change', ...)` 블록 바로
다음에 아래 코드를 추가한다:

```js
    // 공유하기 / 저장
    const imgShareBtn = document.getElementById('imgShareBtn');
    const imgSaveBtn = document.getElementById('imgSaveBtn');

    function canvasToPngBlob() {
      return new Promise((resolve) => shareCanvas.toBlob(resolve, 'image/png'));
    }

    imgSaveBtn.addEventListener('click', async () => {
      const blob = await canvasToPngBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'victory-verse.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    imgShareBtn.addEventListener('click', async () => {
      const blob = await canvasToPngBlob();
      if (!blob) return;
      const file = new File([blob], 'victory-verse.png', { type: 'image/png' });
      const text = (window.currentFullVerseText || '').trim();
      const ref = (window.currentFullVerseRef || '').trim();
      const body = ref ? (text + '\n\n' + ref) : text;
      try {
        await navigator.share({ files: [file], title: '빅토리처치 이번 주 성경 구절', text: body });
      } catch (e) { /* 사용자가 공유 취소 — 무시 */ }
    });

    // 이미지 파일 공유를 지원하지 않는 환경(주로 데스크톱)에서는 "공유하기" 숨김
    (function () {
      let supportsFileShare = false;
      try {
        const probe = new File([new Uint8Array([1])], 'probe.png', { type: 'image/png' });
        supportsFileShare = !!(navigator.canShare && navigator.canShare({ files: [probe] }));
      } catch (e) { supportsFileShare = false; }
      if (!supportsFileShare) imgShareBtn.classList.add('hidden');
    })();
```

- [ ] **Step 2: 브라우저로 확인**

`npx serve .` 로컬 서버에서 페이지를 열고:
1. 데스크톱 Chrome: "공유하기" 버튼이 보이지 않고 "저장" 버튼만 보이는지 확인
2. "저장" 클릭 → `victory-verse.png` 파일이 다운로드되는지, 이미지를 열어
   배경+텍스트가 올바르게 그려졌는지 확인
3. (가능하면) 모바일 Safari/Chrome에서 "이미지로 공유" → "공유하기" 클릭 →
   네이티브 공유 시트가 이미지와 함께 뜨는지 확인

---

### Task 7: Playwright 로컬 테스트

**Files:**
- Create: `tests/image-share.test.js`
- Modify: `tests/package.json`

- [ ] **Step 1: 테스트 파일 작성**

`tests/image-share.test.js`를 새로 만든다 (`tests/bank-buttons.test.js`와 같은
로컬 서버 패턴):

```js
/**
 * "이미지로 공유" 기능 — 액션 시트 / 이미지 모달 / 캔버스 렌더링 검증
 * --------------------------------------------------------------
 * 실행:
 *   1) (link 폴더) npx serve -l 8080 .
 *   2) (tests 폴더) node image-share.test.js
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const URL = `${BASE_URL}/index.html`;

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log(`   ✅ ${name}`); pass++; }
  else { console.error(`   ❌ ${name}${extra ? '  → ' + extra : ''}`); fail++; }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('   ⚠️ pageerror:', err.message));

  await page.goto(URL, { waitUntil: 'load' });

  let visible = false;
  try {
    await page.waitForSelector('#verseCard:not(.hidden)', { timeout: 15000 });
    visible = true;
  } catch (e) {
    console.log('   ⚠️ 활성 구절 카드가 없음 — 정적 마크업 존재만 확인합니다.');
  }

  check('공유 액션 시트 마크업 존재', await page.locator('#shareSheet').count() === 1);
  check('이미지 공유 모달 마크업 존재', await page.locator('#imageShareModal').count() === 1);
  check('캔버스 엘리먼트 존재', await page.locator('#shareCanvas').count() === 1);

  if (!visible) {
    console.log(`\n──────────────────────────────`);
    console.log(`결과: ${pass} 통과 / ${fail} 실패`);
    console.log(`──────────────────────────────`);
    await context.close();
    await browser.close();
    process.exit(fail > 0 ? 1 : 0);
    return;
  }

  // 1) 공유 버튼 → 액션 시트
  await page.locator('#shareBtn').click();
  await page.waitForSelector('#shareSheet.show', { timeout: 3000 });
  check('공유 버튼 클릭 시 액션 시트 표시', true);
  check('텍스트로 공유 옵션 존재', await page.locator('#shareTextOption').count() === 1);
  check('이미지로 공유 옵션 존재', await page.locator('#shareImageOption').count() === 1);

  // 2) 이미지로 공유 → 모달 오픈 + 캔버스 렌더
  await page.locator('#shareImageOption').click();
  await page.waitForSelector('#imageShareModal.show', { timeout: 3000 });
  await page.waitForTimeout(300); // document.fonts.ready 이후 렌더 대기

  const brandBlueData = await page.locator('#shareCanvas').evaluate((c) => c.toDataURL());
  check('브랜드 블루 배경으로 캔버스 렌더링', brandBlueData.length > 1000);

  // 3) 스와치 전환 시 캔버스가 다시 그려지는지
  await page.locator('.swatch[data-style="pastelFloral"]').click();
  await page.waitForTimeout(100);
  const pastelData = await page.locator('#shareCanvas').evaluate((c) => c.toDataURL());
  check('파스텔 플로럴 선택 시 캔버스 변경', pastelData !== brandBlueData);
  check('파스텔 플로럴 스와치 active 표시', await page.locator('.swatch[data-style="pastelFloral"]').evaluate((el) => el.classList.contains('active')));

  // 4) 저장 버튼 → 다운로드 트리거
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.locator('#imgSaveBtn').click(),
  ]);
  check('저장 버튼 클릭 시 PNG 다운로드', download.suggestedFilename() === 'victory-verse.png');

  // 5) 모달 닫기
  await page.locator('#imageShareCloseBtn').click();
  await page.waitForTimeout(300);
  check('닫기 버튼 클릭 시 모달 닫힘', !(await page.locator('#imageShareModal').evaluate((el) => el.classList.contains('show'))));

  await context.close();
  await browser.close();

  console.log(`\n──────────────────────────────`);
  console.log(`결과: ${pass} 통과 / ${fail} 실패`);
  console.log(`──────────────────────────────`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => { console.error('❌ 실행 오류:', err); process.exit(1); });
```

- [ ] **Step 2: package.json에 스크립트 추가**

`tests/package.json`의 `scripts`에 다음을 추가한다:

```json
    "test:image-share": "node image-share.test.js"
```

전체 `scripts` 블록은 다음과 같이 된다:

```json
  "scripts": {
    "install:browsers": "playwright install webkit chromium",
    "test:ios": "node ios-screenshots.js",
    "test:banks": "node bank-buttons.test.js",
    "test:image-share": "node image-share.test.js"
  },
```

- [ ] **Step 3: 테스트 실행**

루트 폴더에서 로컬 서버를 띄운다:

```bash
npx serve -l 8080 .
```

다른 터미널에서 `tests` 폴더로 이동해 실행:

```bash
cd tests
node image-share.test.js
```

Expected: 모든 체크가 `✅`로 출력되고 `RESULT`/`결과` 줄에 `0 실패`가 표시됨.
활성 구절이 없는 경우 마크업 존재 확인 3개만 통과하고 종료된다.

---

### Task 8: CLAUDE.md — 새 기능의 비자명한 구현 포인트 기록

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: "Architecture & gotchas" 섹션에 항목 추가**

`CLAUDE.md`의 "Architecture & gotchas" 섹션 마지막 항목(Web Audio API 관련
항목) 다음에 아래 항목을 추가한다:

```markdown
- **"이미지로 공유" (구절 카드 이미지 생성)**: `#shareBtn` 클릭 시 바텀시트
  (`#shareSheet`)에서 "텍스트로 공유"(기존 `navigator.share` 텍스트+링크)와
  "이미지로 공유"(`#imageShareModal`)를 선택한다. 이미지 생성은 1080×1920
  `<canvas id="shareCanvas">`에 배경(그라디언트 4종 또는 사용자 업로드 사진 +
  하단 스크림)과 구절 텍스트를 그려서 만든다. 텍스트는 `verse.text`의 `\n`
  줄바꿈을 그대로 사용하고, 'Gowun Dodum' 폰트는 `document.fonts.ready` 이후에
  그려야 폴백 폰트로 깨지지 않는다(기존 `startTypewriting`과 동일 패턴).
  출력은 `canvas.toBlob('image/png')` → `navigator.canShare({ files })`가
  true면 "공유하기"(파일 공유), 아니면 "공유하기" 버튼을 숨기고 "저장"
  (다운로드)만 노출한다. 전부 클라이언트 로컬 처리이며 Firestore/Storage에는
  아무것도 쓰지 않는다.
```

- [ ] **Step 2: 변경 확인**

`git diff CLAUDE.md`로 추가된 항목이 기존 항목들과 같은 글머리표/들여쓰기
스타일인지 확인한다.

---

## 최종 점검 (Self-Review 결과)

- **스펙 커버리지**: 설계 문서의 모든 결정 사항(진입점 확장, 9:16, 그라디언트
  4종 + 내 사진, 라벨 없음 + 워터마크, 공유/저장 출력, index.html 단일 파일
  변경)이 Task 1~6에 반영됨. 테스트 계획은 Task 7(자동) + 각 Task의 수동
  확인으로 커버됨.
- **타입/네이밍 일관성**: `SHARE_STYLES`, `currentShareStyle`,
  `setActiveShareStyle`, `renderShareCanvas`, `shareCanvas`/`shareCtx`,
  `sharePhotoImg`, `shareSwatches` 이름이 Task 4~6 전체에서 동일하게 사용됨.
- **범위**: "이번 주 구절" 활성 카드의 공유 버튼에만 적용(설계 문서와 동일,
  지난 구절 모달은 범위 제외).
