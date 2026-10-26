/* 관리자와 메인 화면이 공유하는 자동 낭독 요청. 비밀 키는 서버에만 보관합니다. */
(function (root) {
  function audioUrlsForVerse(verse, urls) {
    if (verse.audioMode === 'voxcpm2') return [];
    return (Array.isArray(urls) ? urls : (urls ? [urls] : []))
      .filter(u => typeof u === 'string' && u.trim()).map(u => u.trim());
  }
  async function requestSpeech(verseId, { signal, fetchImpl = fetch } = {}) {
    if (!verseId) throw new Error('구절을 저장한 뒤 다시 시도하세요.');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal) { signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel(); }
    const timer = setTimeout(cancel, 55000);
    try {
      const res = await fetchImpl('/api/tts', {
        method: 'POST', headers: { Accept: 'audio/wav', 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseId }), signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.error === 'string' ? detail.error : '음성을 생성하지 못했습니다. 잠시 후 다시 시도하세요.');
      }
      if (!(res.headers.get('Content-Type') || '').startsWith('audio/')) {
        throw new Error('음성 서버가 연결되지 않았거나 올바른 음성을 반환하지 않았습니다.');
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error('생성된 음성이 비어 있습니다. 다시 시도하세요.');
      return blob;
    } catch (error) {
      if (controller.signal.aborted && !(signal && signal.aborted)) {
        throw new Error('음성 생성 시간이 길어지고 있습니다. 잠시 후 다시 시도하세요.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', cancel);
    }
  }
  const api = { requestSpeech, audioUrlsForVerse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VerseSpeech = api;
})(typeof window !== 'undefined' ? window : globalThis);
