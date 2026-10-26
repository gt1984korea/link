// 로컬 UI 검증 전용. Firebase와 GPU 대신 메모리 문서와 테스트 WAV를 사용합니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const wav = Buffer.alloc(44 + 48000 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
// 테스트가 실제로 들리는지 확인할 수 있도록 1초짜리 440Hz 톤을 넣습니다.
for (let i = 0; i < 48000; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * 5000), 44 + i * 2);
const fixture = `
window.__testDoc = {verses:[]}; window.__ttsRequests = [];
sessionStorage.setItem('vc_admin_ok', '1');
const firebaseConfig={}, VERSE_DOC_PATH={collection:'site',id:'memoryVerse'}, ADMIN_PASSCODE='test';
const PRAYER_COLLECTION='prayers', PRAYER_CONTENT_COLLECTION='prayerContents';
const initializeApp=()=>({}), getFirestore=()=>({}),getStorage=()=>({});
const doc=()=>({}),collection=()=>({}),storageRef=()=>({});
const getDoc=async()=>({exists:()=>true,data:()=>window.__testDoc});
const setDoc=async(ref,data)=>{if(window.__failSave)throw Error('테스트 저장 오류');Object.assign(window.__testDoc,structuredClone(data));};
const serverTimestamp=()=>null,deleteField=()=>null,deleteDoc=async()=>{},deleteObject=async()=>{};
const onSnapshot=()=>()=>{},uploadBytes=async()=>{},getDownloadURL=async()=>'/test.wav';
const liveFetch=window.fetch;
window.fetch=(url,options)=>{
 if(url==='/api/tts')window.__ttsRequests.push(JSON.parse(options.body));
 if(url==='/api/tts'&&window.__failTts)return Promise.resolve(new Response(JSON.stringify({error:'테스트 음성 서버 연결 실패'}),{status:503}));
 return liveFetch(url,options);
};
`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/tts'||url.pathname==='/test.wav') {res.writeHead(200,{'Content-Type':'audio/wav'});return res.end(wav);}
  if(url.pathname.startsWith('/api/')){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{}');}
  if(url.pathname==='/'||url.pathname==='/admin'||url.pathname==='/admin.html') {
    let html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
    html=html.replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?/g,'');
    html=html.replace('<script type="module">','<script type="module">'+fixture);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);
  }
  const allowed = new Set(['/tts-client.js','/church_cross.png','/icon-192.png','/icon-512.png']);
  if(!allowed.has(url.pathname)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'image/png');
  fs.createReadStream(path.join(root,url.pathname)).pipe(res);
});
const port = Number(process.env.PORT || 4179);
server.listen(port,'127.0.0.1',()=>console.log(`TTS 로컬 테스트 화면: http://127.0.0.1:${port}/admin (Firebase/GPU 없이 테스트 WAV 사용)`));
