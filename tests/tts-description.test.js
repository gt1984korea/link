const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = html.match(/function getFullText\(\) \{[\s\S]*?\n      \}/);
assert.ok(match, 'getFullText 함수를 찾을 수 있어야 합니다.');

function getTtsText({ text, reference = '', description = '' }) {
  const fakeWindow = {
    currentFullVerseText: text,
    currentFullVerseRef: reference,
    currentVerseDescription: description,
  };
  const fakeDocument = {
    getElementById() {
      return { textContent: '' };
    },
  };
  return new Function('window', 'document', `${match[0]}; return getFullText();`)(fakeWindow, fakeDocument);
}

assert.equal(
  getTtsText({
    text: '여호와는 나의 목자시니',
    reference: '시편 23:1',
    description: '하나님이 우리의 모든 필요를 돌보신다는 뜻입니다.',
  }),
  '여호와는 나의 목자시니\n\n시편 23:1\n\n구절 설명:\n하나님이 우리의 모든 필요를 돌보신다는 뜻입니다.',
  '녹음이 없을 때 TTS는 성경 구절 뒤에 구절 설명을 포함해야 합니다.',
);

assert.equal(
  getTtsText({ text: '항상 기뻐하라', reference: '데살로니가전서 5:16' }),
  '항상 기뻐하라\n\n데살로니가전서 5:16',
  '구절 설명이 없으면 기존 구절 읽기 형식을 유지해야 합니다.',
);

console.log('PASS - TTS 구절 설명 조합');
