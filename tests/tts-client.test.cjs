const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requestSpeech, audioUrlsForVerse}=require('../tts-client.js');
test('자동 낭독을 선택하면 기존 공유 녹음이 있어도 재생하지 않는다',()=>{
  assert.deepEqual(audioUrlsForVerse({audioMode:'voxcpm2'},['old.mp3']),[]);
  assert.deepEqual(audioUrlsForVerse({audioMode:'recording'},['one.mp3','two.mp3']),['one.mp3','two.mp3']);
  assert.deepEqual(audioUrlsForVerse({},['legacy.mp3']),['legacy.mp3']);
});
test('저장된 구절 ID로 WAV를 받아 재생 가능한 Blob으로 반환한다',async()=>{
  const blob=await requestSpeech('v1',{fetchImpl:async(url,options)=>{
    assert.equal(url,'/api/tts'); assert.deepEqual(JSON.parse(options.body),{verseId:'v1'});
    return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'audio/wav'}});
  }});
  assert.equal(blob.type,'audio/wav'); assert.equal(blob.size,2);
});
test('서버 오류와 잘못된 응답을 성공 음성으로 취급하지 않는다',async()=>{
  await assert.rejects(requestSpeech('v',{fetchImpl:async()=>new Response(JSON.stringify({error:'서버가 아직 연결되지 않았습니다.'}),{status:503})}),/연결/);
  await assert.rejects(requestSpeech('v',{fetchImpl:async()=>new Response('<html>hosting fallback</html>')}),/음성/);
});
