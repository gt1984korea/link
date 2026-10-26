const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseBulk, overlaps}=require('../verse-bulk.js');
const today='2026-10-26';
test('날짜 줄·출처·본문 블록을 구절별로 나눈다',()=>{
  const r=parseBulk(`11월 2일 ~ 11월 8일
요한복음 3:16
하나님이 세상을 이처럼 사랑하사
독생자를 주셨으니

11/9~11/15 (시편 23:1)
여호와는 나의 목자시니 내게 부족함이 없으리로다`,{today});
  assert.equal(r.length,2);
  assert.deepEqual(r[0],{text:'하나님이 세상을 이처럼 사랑하사\n독생자를 주셨으니',reference:'요한복음 3:16',startDate:'2026-11-02',endDate:'2026-11-08',dateGuessed:false});
  assert.equal(r[1].reference,'시편 23:1'); assert.equal(r[1].startDate,'2026-11-09'); assert.equal(r[1].endDate,'2026-11-15');
  assert.equal(r[1].text,'여호와는 나의 목자시니 내게 부족함이 없으리로다');
});
test('한 줄 형식, 범위 출처, 월말·연말 넘김, 일만 적은 종료일',()=>{
  const r=parseBulk(`1주차 11/30~12/6 고린도전서 13:4-7 사랑은 오래 참고
12월 28일(월)~3일 빌 4:13 내게 능력 주시는 자 안에서
2027.1.4 - 2027.1.10 요 1:1-3 태초에 말씀이 계시니라`,{today});
  assert.equal(r.length,3);
  assert.deepEqual([r[0].startDate,r[0].endDate,r[0].reference,r[0].text],['2026-11-30','2026-12-06','고린도전서 13:4-7','사랑은 오래 참고']);
  assert.deepEqual([r[1].startDate,r[1].endDate,r[1].reference],['2026-12-28','2027-01-03','빌 4:13']);
  assert.deepEqual([r[2].startDate,r[2].endDate,r[2].reference,r[2].text],['2027-01-04','2027-01-10','요 1:1-3','태초에 말씀이 계시니라']);
});
test('날짜가 없으면 이어지는 주로, 종료일이 없으면 7일로 채운다',()=>{
  const r=parseBulk(`11/2 로마서 8장 28절
우리가 알거니와

시편 23편 1절
여호와는 나의 목자시니`,{today});
  assert.deepEqual([r[0].startDate,r[0].endDate,r[0].reference],['2026-11-02','2026-11-08','로마서 8장 28절']);
  assert.deepEqual([r[1].startDate,r[1].endDate,r[1].dateGuessed],['2026-11-09','2026-11-15',true]);
});
test('연도 없는 지난 1월 날짜는 내년으로 본다',()=>{
  assert.equal(parseBulk('1/4~1/10\n본문',{today})[0].startDate,'2027-01-04');
});
test('기간 겹침 판단',()=>{
  assert.equal(overlaps({startDate:'2026-11-02',endDate:'2026-11-08'},{startDate:'2026-11-08',endDate:'2026-11-14'}),true);
  assert.equal(overlaps({startDate:'2026-11-02',endDate:'2026-11-08'},{startDate:'2026-11-09',endDate:'2026-11-15'}),false);
});
test('"장 N-M절" 출처를 날짜로 오인하지 않는다',()=>{
  const r=parseBulk(`11/2~11/8
창세기 1장 1-3절
태초에 하나님이 천지를 창조하시니라

11/9~11/15 고린도전서 13장 4-7절 사랑은 오래 참고`,{today});
  assert.equal(r.length,2);
  assert.deepEqual([r[0].startDate,r[0].endDate,r[0].reference,r[0].text],['2026-11-02','2026-11-08','창세기 1장 1-3절','태초에 하나님이 천지를 창조하시니라']);
  assert.deepEqual([r[1].startDate,r[1].endDate,r[1].reference,r[1].text],['2026-11-09','2026-11-15','고린도전서 13장 4-7절','사랑은 오래 참고']);
});
test('물결·점이 들어간 출처를 자르지 않는다',()=>{
  let r=parseBulk('11/2~11/8 고린도전서 13장 4~7절 사랑은 오래 참고',{today})[0];
  assert.deepEqual([r.reference,r.text,r.endDate],['고린도전서 13장 4~7절','사랑은 오래 참고','2026-11-08']);
  r=parseBulk('11/30~12/6 롬 12:1~2 본문',{today})[0];
  assert.deepEqual([r.reference,r.text],['롬 12:1~2','본문']);
  r=parseBulk('11/2~11/8 요한복음 3.16 하나님이',{today})[0];
  assert.deepEqual([r.reference,r.text],['요한복음 3.16','하나님이']);
  const two=parseBulk('11/2~11/8\n요한복음 3.16\n하나님이',{today});
  assert.equal(two.length,1); assert.equal(two[0].reference,'요한복음 3.16'); assert.equal(two[0].startDate,'2026-11-02');
});
test('출처와 같은 줄의 일만 적은 종료일이 본문에 남지 않는다',()=>{
  const r=parseBulk('11/2-8 요 3:16 본문',{today})[0];
  assert.deepEqual([r.startDate,r.endDate,r.reference,r.text],['2026-11-02','2026-11-08','요 3:16','본문']);
});
test('본문 속 날짜와 빈 줄로 구절을 쪼개지 않는다',()=>{
  const r=parseBulk('11/2~11/8\n요 3:16\n첫 문단\n11월 2일 우리는\n\n둘째 문단\n\n11/9~11/15 시 23:1\n여호와는',{today});
  assert.equal(r.length,2);
  assert.equal(r[0].text,'첫 문단\n11월 2일 우리는\n\n둘째 문단');
  assert.deepEqual([r[1].startDate,r[1].reference,r[1].text],['2026-11-09','시 23:1','여호와는']);
});
test('날짜 머리줄이 있어도 출처로 시작하는 줄은 다음 구절로 나눈다',()=>{
  const r=parseBulk('11/2 로마서 8:28\n우리가 알거니와\n시편 23편 1절\n여호와는',{today});
  assert.equal(r.length,2);
  assert.deepEqual([r[1].reference,r[1].startDate,r[1].dateGuessed],['시편 23편 1절','2026-11-09',true]);
});
test('번호 목록 머리줄도 날짜로 나눈다',()=>{
  const r=parseBulk('1. 11/2~11/8 요 3:16 본문\n2) 11/9~11/15 시 23:1 본문2\n③ 11/16~11/22 롬 8:28 본문3',{today});
  assert.equal(r.length,3);
  assert.deepEqual(r.map(v=>[v.startDate,v.reference,v.text]),[['2026-11-02','요 3:16','본문'],['2026-11-09','시 23:1','본문2'],['2026-11-16','롬 8:28','본문3']]);
});
test('한 달 넘는 기간은 두 번째 날짜를 버리고 7일로 둔다',()=>{
  const r=parseBulk('11/2 요한 3.16 본문',{today})[0];
  assert.deepEqual([r.startDate,r.endDate],['2026-11-02','2026-11-08']);
  assert.match(r.text,/3\.16/);
});
test('여러 글자 요일 표시를 지운다',()=>{
  const r=parseBulk('11/2(월)~11/8(주일)\n요 3:16\n본문\n\n11/9(월요일)~11/15(일요일) 시 23:1\n본문2',{today});
  assert.deepEqual(r.map(v=>[v.startDate,v.endDate,v.text]),[['2026-11-02','2026-11-08','본문'],['2026-11-09','2026-11-15','본문2']]);
});
test('6개월 이내로 지난 날짜는 올해로 본다',()=>{
  assert.equal(parseBulk('8/20~8/26 요 3:16 본문',{today})[0].startDate,'2026-08-20');
  assert.equal(parseBulk('1/4~1/10 요 3:16 본문',{today})[0].startDate,'2027-01-04');
});
test('장만 있는 출처도 분리한다',()=>{
  const r=parseBulk('11/2~11/8 시편 23편\n여호와는 나의 목자시니',{today})[0];
  assert.deepEqual([r.reference,r.text],['시편 23편','여호와는 나의 목자시니']);
});
