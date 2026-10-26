const {test}=require('node:test'); const assert=require('node:assert/strict');
const vm=require('node:vm'); const fs=require('node:fs');
function player(requestSpeech, urls=[]) {
  const listeners={}; const elements={}; const audio=[]; const timers=[];
  for(const id of ['ttsBtn','ttsBtnLabel','ttsIcon','ttsMessage','verseText','verseRef']) elements[id]={textContent:'',classList:{add(){},remove(){}},addEventListener(name,fn){this[name]=fn;}};
  const window={currentTtsVerseId:'v1',currentFullVerseText:'구절',currentVerseAudioUrls:urls,
    addEventListener(name,fn){listeners[name]=fn;},speechSynthesis:{cancel(){},getVoices(){return[];},speak(){throw Error('silent fallback');}}};
  const context={window,document:{getElementById:id=>elements[id],addEventListener(){}},
    VerseSpeech:{requestSpeech},AbortController,URL:{createObjectURL:()=> 'blob:voice',revokeObjectURL(){}},
    Audio: class { constructor(url){this.url=url;audio.push(this);} play(){this.played=true;return Promise.resolve();} pause(){this.paused=true;} },
    console:{warn(){}},setTimeout(fn){timers.push(fn);return 1;},clearTimeout(){},Math,Date};
  const html=fs.readFileSync('index.html','utf8');
  const marker=html.indexOf('<!-- TTS ('); const start=html.indexOf('<script>',marker)+8;
  vm.runInNewContext(html.slice(start,html.indexOf('</script>',start)),context);
  return {elements,audio,listeners,window,timers,click:()=>elements.ttsBtn.click()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('읽어주기는 저장된 구절 ID의 VoxCPM2 음성을 재생한다',async()=>{
  let id;const p=player(async v=>{id=v;return new Blob(['voice']);});p.click();await tick();
  assert.equal(id,'v1');assert.equal(p.audio[0].url,'blob:voice');assert.equal(p.audio[0].played,true);
});
test('업로드한 녹음은 TTS 호출 없이 기존 순서대로 재생한다',async()=>{
  const p=player(async()=>{throw Error('must not generate');},['first.mp3','second.mp3']);p.click();await tick();
  assert.equal(p.audio[0].url,'first.mp3');p.audio[0].onended();p.timers.pop()();await tick();assert.equal(p.audio[1].url,'second.mp3');
});
test('생성 오류를 표시하고 기본 음성으로 몰래 전환하지 않는다',async()=>{
  const p=player(async()=>{throw Error('서버 연결 필요');});p.click();await tick();
  assert.equal(p.elements.ttsBtnLabel.textContent,'읽어주기');assert.match(p.elements.ttsMessage.textContent,/서버 연결 필요/);
});
test('생성 중 멈추면 응답이 늦게 도착해도 재생하지 않는다',async()=>{
  let resolve,signal;const p=player((id,opts)=>{signal=opts.signal;return new Promise(r=>resolve=r);});
  p.click();p.click();assert.equal(signal.aborted,true);resolve(new Blob(['late']));await tick();assert.equal(p.audio.length,0);
});
