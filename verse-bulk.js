/* 관리자 "대량 등록": 받은 텍스트를 구절 목록으로 나눕니다.
 * 한 구절 = 날짜 머리줄(선택) + 출처(선택) + 본문.
 * 날짜 머리줄이 하나라도 있으면 머리줄에서만 나누고(본문 속 빈 줄은 유지), 없으면 빈 줄에서 나눕니다.
 * 출처와 본문이 이미 있는 구절에서 출처로 시작하는 줄이 나오면 다음 구절로 넘어갑니다.
 * 날짜가 없으면 앞 구절 다음 날부터 7일, 종료일이 없으면 시작일 + 6일로 채웁니다. */
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function addDays(s, n) {
    const [y, m, d] = s.split('-').map(Number);
    return ymd(new Date(y, m - 1, d + n));
  }
  function valid(y, m, d) {
    const t = new Date(y, m - 1, d);
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  }

  // 성경 66권 이름과 약어. 출처를 날짜(예: "3.16")보다 먼저 찾아 떼어내기 위해 책 이름으로 한정합니다.
  const BOOKS = ('창세기 출애굽기 레위기 민수기 신명기 여호수아 사사기 룻기 사무엘상 사무엘하 열왕기상 열왕기하 역대상 역대하 ' +
    '에스라 느헤미야 에스더 욥기 시편 잠언 전도서 아가 이사야 예레미야애가 예레미야 에스겔 다니엘 호세아 요엘 아모스 오바댜 ' +
    '요나 미가 나훔 하박국 스바냐 학개 스가랴 말라기 마태복음 마가복음 누가복음 요한복음 사도행전 로마서 고린도전서 고린도후서 ' +
    '갈라디아서 에베소서 빌립보서 골로새서 데살로니가전서 데살로니가후서 디모데전서 디모데후서 디도서 빌레몬서 히브리서 야고보서 ' +
    '베드로전서 베드로후서 요한일서 요한이서 요한삼서 유다서 요한계시록 ' +
    '창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 ' +
    '마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계')
    .split(' ').sort((a, b) => b.length - a.length);
  // 요한복음 3:16 · 요 3.16 · 롬 12:1~2 · 시편 23편 1절 · 고린도전서 13장 4~7절 · 요 3:16-4:2 · 시편 23편
  const NUM_RANGE = String.raw`(?:\d{1,3}\s*(?:[:：.]\s*|(?:장|편)\s*)\d{1,3}(?:\s*[-~∼〜–,]\s*\d{1,3}(?:\s*[:：.]\s*\d{1,3})?)*\s*절?|\d{1,3}\s*(?:장|편)(?![가-힣]))`;
  const REF_RE = new RegExp(String.raw`[(\[【]?\s*((?<![가-힣])(?:${BOOKS.join('|')})\s*${NUM_RANGE})\s*[)\]】]?`);

  // 2026-11-02 · 2026.11.2 · 2026년 11월 2일 · 11/2 · 11.2 · 11월 2일
  const DATE_RE = /(?<![:：.\d])(?:(\d{4})\s*[.\-/년]\s*)?(\d{1,2})\s*(?:[.\-/]|월\s*)(\d{1,2})\s*일?(?![\d:：])/g;
  // 첫 날짜 바로 뒤의 "~8일" · "-8" (종료일에 일만 적은 경우)
  const DAY_ONLY_RE = /^\s*[~∼〜–-]\s*(\d{1,2})(?![\d.\-/:：])\s*일?/;
  const WEEKDAY_RE = /\(\s*(?:[월화수목금토일](?:요일)?|주일)\s*\)/g;
  // 줄 앞 표시: "1주차" · "암송 구절:" · 번호 목록("1." "2)" "(3)" "①")
  const LABEL_RE = /^\s*(?:\d+\s*주\s*차?|제?\s*\d+\s*주|암송\s*(?:구절|말씀)?|이번\s*주|week\s*\d*|\d{1,2}\s*[.)](?=\s)|\(\d{1,2}\)|[①-⑳])\s*[:：.)\]-]?\s*/i;
  const MAX_SPAN_DAYS = 31;
  function stripLabels(s) {
    let prev;
    do { prev = s; s = s.replace(LABEL_RE, ''); } while (s !== prev);
    return s;
  }

  function findDates(line) {
    const out = [];
    DATE_RE.lastIndex = 0;
    let m;
    while ((m = DATE_RE.exec(line))) {
      const mo = +m[2], d = +m[3];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push({ y: m[1] ? +m[1] : null, m: mo, d, index: m.index, end: m.index + m[0].length });
    }
    if (out.length === 1) {
      const dm = line.slice(out[0].end).match(DAY_ONLY_RE);
      if (dm) out.push({ y: null, m: null, d: +dm[1], index: out[0].end, end: out[0].end + dm[0].length });
    }
    return out.slice(0, 2);
  }

  // 연도가 없으면 올해로 보되, 6개월 넘게 지난 날짜는 내년으로 봅니다(연말에 내년 1월분을 받는 경우).
  function resolveRange(dates, today) {
    const [ty] = today.split('-').map(Number);
    const a = dates[0];
    let y = a.y;
    if (y == null) {
      y = ty;
      if (valid(y, a.m, a.d) && `${y}-${pad(a.m)}-${pad(a.d)}` < addDays(today, -183)) y += 1;
    }
    if (!valid(y, a.m, a.d)) return null;
    const start = `${y}-${pad(a.m)}-${pad(a.d)}`;
    let end = null;
    const b = dates[1];
    if (b) {
      const by = b.y == null ? y : b.y, bm = b.m == null ? a.m : b.m;
      if (valid(by, bm, b.d)) {
        end = `${by}-${pad(bm)}-${pad(b.d)}`;
        // 연말·월말을 넘기는 기간: "12/28~1/3" → 다음 해, "11월 28일~4일" → 다음 달
        if (end < start && b.y == null) end = ymd(b.m == null ? new Date(by, bm, b.d) : new Date(by + 1, bm - 1, b.d));
      }
    }
    return { start, end: end && end >= start ? end : addDays(start, 6) };
  }

  // 한 줄을 출처 → 날짜 순으로 분석합니다. 출처를 먼저 떼어내야 "4~7절"·"3.16"이 날짜로 오인되지 않습니다.
  function analyzeLine(line, today) {
    let rest = line, ref = '', refAtStart = false;
    const rm = rest.match(REF_RE);
    if (rm) {
      ref = rm[1].replace(/\s+/g, ' ').trim();
      refAtStart = !stripLabels(rest.slice(0, rm.index)).trim();
      rest = rest.slice(0, rm.index) + ' ' + rest.slice(rm.index + rm[0].length);
    }
    // 머리줄: 줄 맨 앞(라벨 뒤)의 날짜이면서, 기간이거나 출처가 같이 있거나 날짜만 있는 줄.
    // "11월 2일 우리는…"처럼 본문이 날짜로 시작하는 줄은 본문으로 둡니다.
    let dates = findDates(rest);
    const wasRange = dates.length === 2;
    // 기간이 한 달을 넘으면 두 번째 "날짜"는 출처 등을 잘못 읽은 것으로 보고 첫 날짜만 씁니다.
    if (dates.length === 2) {
      const r2 = resolveRange(dates, today);
      if (r2 && addDays(r2.start, MAX_SPAN_DAYS) < r2.end) dates = dates.slice(0, 1);
    }
    let range = null;
    if (dates.length) {
      const last = dates[dates.length - 1];
      const lead = stripLabels(rest.slice(0, dates[0].index)).replace(/[\s(\[]/g, '');
      const after = rest.slice(last.end).replace(WEEKDAY_RE, '').replace(/[\s)\]\-:：.,]/g, '');
      if (!lead && (wasRange || ref || !after)) {
        range = resolveRange(dates, today);
        if (range) rest = (rest.slice(0, dates[0].index) + ' ' + rest.slice(last.end)).replace(WEEKDAY_RE, ' ');
      }
    }
    if (!range && !ref) return { range: null, ref: '', refAtStart: false, text: line };
    rest = stripLabels(rest).replace(/^[\s\-:：.,()[\]]+|[\s\-:：,([]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    return { range, ref, refAtStart, text: rest };
  }

  function parseBulk(input, { today, nextStart } = {}) {
    today = today || ymd(new Date());
    const lines = String(input || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.trim());
    const info = lines.map(l => (l ? analyzeLine(l, today) : null));
    const headerMode = info.some(x => x && x.range);

    const blocks = [];
    let cur = null;
    const flush = () => {
      if (cur) {
        while (cur.lines.length && !cur.lines[cur.lines.length - 1]) cur.lines.pop();
        if (cur.lines.length || cur.ref) blocks.push(cur);
      }
      cur = null;
    };
    info.forEach((x, i) => {
      if (!x) {
        if (!headerMode) flush();
        else if (cur && cur.lines.length) cur.lines.push('');
        return;
      }
      if (x.range) flush();
      else if (x.ref && x.refAtStart && cur && cur.ref && cur.lines.some(Boolean)) flush();
      cur = cur || { lines: [], ref: '', range: null };
      if (x.range) cur.range = x.range;
      let text = x.text;
      // 한 구절 안의 두 번째 출처는 본문에 원문 그대로 둡니다.
      if (x.ref) { if (!cur.ref) cur.ref = x.ref; else text = lines[i]; }
      if (text) cur.lines.push(text);
    });
    flush();

    let cursor = nextStart || today;
    return blocks.map((b) => {
      const range = b.range || { start: cursor, end: addDays(cursor, 6), guessed: true };
      cursor = addDays(range.end, 1);
      const text = b.lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^["“'‘]+|["”'’]+$/g, '').trim();
      return { text, reference: b.ref, startDate: range.start, endDate: range.end, dateGuessed: !!range.guessed };
    }).filter(v => v.text || v.reference);
  }

  // 두 구절의 표시 기간이 하루라도 겹치는지
  function overlaps(a, b) {
    return !!(a.startDate && a.endDate && b.startDate && b.endDate && a.startDate <= b.endDate && b.startDate <= a.endDate);
  }

  const api = { parseBulk, overlaps, addDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VerseBulk = api;
})(typeof window !== 'undefined' ? window : globalThis);
