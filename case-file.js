/* Independent layers: projected 3D desk targets, readable folio, evidence viewer,
   and persistent cassette. Future loose evidence belongs in evidenceLayer. */
(()=>{'use strict';
const data=window.HNJCaseData,root=document.querySelector('#opening-sequence'),stage=document.querySelector('#opening-stage');
let active=false,opened=false,busy=false,index=0,lastFocus=null,photoAside=false;
let deckState = 'closed';
const layer=document.createElement('div');layer.className='case-desk-targets';layer.hidden=true;root.append(layer);
const targets={};const labels={file:'CASE FILE : HNJ 열기',photo:'허남준 사진 확대',photo2:'사진 자료 02 확대',photo3:'사진 자료 03 확대',note:'조사관 메모 펼치기',cassette:'카세트 덮개 열기',tape:'테이프 삽입'};
for(const [key,label]of Object.entries(labels)){const b=document.createElement('button');b.className='case-object case-'+key;b.type='button';b.setAttribute('aria-label',label);b.title=label;layer.append(b);targets[key]=b;}
const reader=document.createElement('section');reader.className='case-reader';reader.hidden=true;reader.setAttribute('aria-label','CASE FILE : HNJ 기록철');
reader.innerHTML='<div class="case-folio"><button class="case-close" type="button">파일 닫기 ×</button><div class="case-spread"><div class="folio-stock" aria-hidden="true"></div><article class="case-left"><small>CASE FILE : HNJ</small><h1></h1><p class="case-subtitle"></p><p class="case-assigned"></p><div class="case-rule"></div><span class="case-reference"></span><div class="folio-slip"><i class="folio-tie" aria-hidden="true"></i><span>FILE COPY</span><strong>HNJ</strong><span>ARCHIVE / 01</span></div></article><article class="case-right"><small>기록 구간</small><div class="case-content"></div><div class="folio-attachments"></div><nav class="case-pages" aria-label="기록 순서"><button type="button" data-prev>← 이전</button><span></span><button type="button" data-next>다음 →</button></nav></article></div><nav class="case-tabs" aria-label="챕터 인덱스"></nav></div>';
root.append(reader);
const attachments = reader.querySelector('.folio-attachments');
for (const [kind, number, title] of [['photo','01','사진 자료'], ['note','02','조사관 메모']]) {
  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'folio-print folio-print-' + kind;
  print.innerHTML = '<span class="folio-print-number"></span><span class="folio-print-face" aria-hidden="true"></span><span class="folio-print-label"></span>';
  print.querySelector('.folio-print-number').textContent = 'ATTACHMENT / ' + number;
  print.querySelector('.folio-print-label').textContent = title;
  if (kind === 'note') print.querySelector('.folio-print-face').textContent = data.memo;
  if (kind === 'photo' && data.photo) {
    const img = new Image();
    img.src = data.photo;
    img.alt = '';
    print.querySelector('.folio-print-face').append(img);
  }
  print.onclick = () => inspect(kind);
  attachments.append(print);
}
const evidenceLayer=document.createElement('div');evidenceLayer.className='case-evidence-layer';reader.append(evidenceLayer);
const tabs=reader.querySelector('.case-tabs');data.sections.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=s.title;b.onclick=()=>turnTo(i);tabs.append(b);});
const viewer=document.createElement('dialog');viewer.className='case-viewer';viewer.innerHTML='<button type="button" class="viewer-close">닫기 ×</button><div class="viewer-body"></div>';document.body.append(viewer);viewer.querySelector('button').onclick=()=>viewer.close();
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});viewer.addEventListener('close',()=>lastFocus?.focus());
const cassette=document.createElement('button');cassette.type='button';cassette.className='case-cassette';cassette.hidden=true;cassette.setAttribute('aria-label','카세트 재생');cassette.textContent='▣ PLAY';root.append(cassette);
const deckButton = targets.cassette;
const tapeButton = targets.tape;
const deckBack = document.createElement('button');
deckBack.type = 'button';
deckBack.className = 'case-tape-back';
deckBack.textContent = '책상으로 돌아가기';
deckBack.hidden = true;
root.append(deckBack);
deckBack.onclick = async () => {
  if (busy || !root.dataset.tapeFocus) return;
  busy = true;
  const deck = window.HNJDeskCamera.room().getDeskItems().tapeDeck;
  await motion(420, progress => {
    if (deckState==='open') deck.lidAt(1-progress);
    window.HNJDeskCamera.tapeView(1-progress);
  });
  if (deckState==='open') deckState = 'closed';
  deckBack.hidden = true;
  delete root.dataset.tapeFocus;
  label(deckButton, deckState==='loaded'?'카세트 플레이어 살펴보기':'카세트 덮개 열기');
  project();
  busy = false;
  deckButton.focus();
};
function label(button, text) {
  button.title = text;
  button.setAttribute('aria-label', text);
}
function music() {
  if (deckState === 'loaded') window.HNJRoomMusic.toggle();
}
async function pressPlay() {
  if(busy)return;
  busy=true;
  const camera=window.HNJDeskCamera;
  const key=camera.room().getDeskItems().tapeDeck.playKey;
  const height=key.position.y;
  window.HNJRoomFoley('play');
  music();
  await motion(130,t=>{
    key.position.y=height-.004*Math.sin(Math.PI*t);
    camera.redraw(true);
  });
  camera.room().getDeskItems().tapeDeck.setPlaying(window.HNJRoomMusic.status().playing);
  camera.redraw(true);
  busy=false;
}
cassette.onclick = music;
async function openDeck() {
  if (!active || busy || opened || deckState !== 'closed') return;
  busy = true;
  const deck = window.HNJDeskCamera.room().getDeskItems().tapeDeck;
  root.dataset.tapeFocus = 'true';
  await motion(480, progress => {
    deck.lidAt(progress);
    window.HNJDeskCamera.tapeView(progress);
  });
  deckState = 'open';
  label(deckButton, '덮개 열림 · 테이프를 넣으세요');
  deckBack.hidden = false;
  busy = false;
  tapeButton.focus();
}
deckButton.onclick = async () => {
  if (busy || opened) return;
  if (deckState !== 'loaded') return openDeck();
  if (root.dataset.tapeFocus) return pressPlay();
  busy=true;
  root.dataset.tapeFocus='true';
  await motion(480,p=>window.HNJDeskCamera.tapeView(p));
  label(deckButton,'카세트 재생 / 정지');
  deckBack.hidden=false;
  busy=false;
};
tapeButton.onclick = async () => {
  if (busy || opened || deckState === 'loaded') return;
  if (deckState === 'closed') {
    await openDeck();
    return;
  }
  busy = true;
  const deck = window.HNJDeskCamera.room().getDeskItems().tapeDeck;
  window.HNJ.audio.getContext();
  let seatedSound=false;
  await motion(880, progress => {
    if(progress>=.96&&!seatedSound){
      seatedSound=true;
      window.HNJRoomFoley('tape');
    }
    deck.insertAt(progress);
    window.HNJDeskCamera.tapeView(1);
  });
  await motion(440, progress => {
    deck.lidAt(1-progress);
    window.HNJDeskCamera.tapeView(1);
  });
  deckState = 'loaded';
  tapeButton.hidden = true;
  window.HNJDeskCamera.tapeView(1);
  label(deckButton, '카세트 재생 / 정지');
  deckButton.setAttribute('aria-pressed','false');
  busy = false;
  deckButton.focus();
};
window.addEventListener('investigation:music-state',e=>{cassette.textContent=e.detail.playing?'▣ STOP':'▣ PLAY';cassette.setAttribute('aria-pressed',String(e.detail.playing));targets.cassette.setAttribute('aria-pressed',String(e.detail.playing));
  if (!active || deckState !== 'loaded') return;
  const camera = window.HNJDeskCamera;
  camera.room().getDeskItems().tapeDeck.setPlaying(e.detail.playing);
  if (!busy) {
    if (root.dataset.tapeFocus) camera.tapeView(1);
    else if (opened) camera.refreshReading();
    else camera.refresh();
  }
});
const memoKey='hnj-investigator-desk-memo';
let memoText=data.memo;
try { memoText=localStorage.getItem(memoKey) ?? memoText; } catch {}
function reflectMemo() {
  reader.querySelector('.folio-print-note .folio-print-face').textContent=memoText;
  window.HNJDeskCamera.room()?.getDeskItems().writeNote(memoText);
}
function showMemo(body) {
  const form=document.createElement('form');
  form.className='desk-memo-pad';
  const text=document.createElement('textarea');
  text.setAttribute('aria-label','조사관 메모');
  text.maxLength=360;
  text.readOnly=true;
  text.value=memoText;
  const action=document.createElement('button');
  action.type='submit';
  action.textContent='수정';
  form.append(text,action);
  form.onsubmit=event=>{
    event.preventDefault();
    if(text.readOnly){
      text.readOnly=false;
      action.textContent='저장';
      text.focus();
      return;
    }
    memoText=text.value;
    try { localStorage.setItem(memoKey,memoText); } catch {}
    reflectMemo();
    viewer.close();
    if(opened) window.HNJDeskCamera.refreshReading();
    else window.HNJDeskCamera.refresh();
  };
  body.append(form);
}
function inspect(kind){lastFocus=document.activeElement;viewer.dataset.kind=kind;const body=viewer.querySelector('.viewer-body');body.replaceChildren();if(kind==='photo'){if(data.photo){const img=new Image();img.src=data.photo;img.alt='허남준 원본 사진';body.append(img);}else{const p=document.createElement('div');p.className='case-photo-placeholder';p.textContent='PHOTO / ASSET PENDING';body.append(p);}}else{showMemo(body);}viewer.showModal();}
targets.photo.onclick=()=>inspect('photo');targets.photo2.onclick=()=>inspect('photo');targets.photo3.onclick=()=>inspect('photo');targets.note.onclick=()=>inspect('note');
function renderSection(scope, i) {
  const section = data.sections[i];
  const identity = window.HNJ.getIdentity();
  scope.querySelector('h1').textContent = section.title;
  scope.querySelector('.case-subtitle').textContent = section.subtitle;
  scope.querySelector('.case-assigned').textContent = '담당 조사관 · ' + (identity?.name || '—');
  scope.querySelector('.case-reference').textContent = 'HNJ / ' + section.id.toUpperCase();
  window.HNJCaseSections.render(section,scope.querySelector('.case-content'),{inspect,evidenceLayer,identity});
  scope.querySelector('[data-prev]').disabled = i === 0;
  scope.querySelector('[data-next]').disabled = i === data.sections.length-1;
  scope.querySelector('.case-pages span').textContent = String(i+1).padStart(2,'0') + ' / SECTION';
}
function show(i) {
  index = i;
  renderSection(reader,i);
  [...tabs.children].forEach((button,j)=>button.setAttribute('aria-current',j===i?'true':'false'));
}

const folio = reader.querySelector('.case-folio');
const spread = reader.querySelector('.case-spread');
const bookCorners = [
  [-.367,.017,-.167],[.114,.017,-.167],
  [-.367,.017,.167],[.114,.017,.167]
];
function alignFolio() {
  if (reader.hidden) return;
  if (stage.clientWidth < 760 || stage.clientHeight < 540) {
    reader.classList.add('folio-compact');
    folio.style.removeProperty('transform');
    return;
  }
  reader.classList.remove('folio-compact');
  const camera = window.HNJDeskCamera;
  const file = camera.room().getDeskItems().file;
  const [a,b,c,d] = bookCorners.map(point=>camera.project(file.localToWorld(new THREE.Vector3(...point)).toArray()));
  // Project the four corners of the actual book into the DOM plane.
  const dx1=b.x-d.x, dx2=c.x-d.x, dx3=a.x-b.x-c.x+d.x;
  const dy1=b.y-d.y, dy2=c.y-d.y, dy3=a.y-b.y-c.y+d.y;
  const det=dx1*dy2-dx2*dy1;
  if (Math.abs(det)<.00001) return;
  const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
  const w=folio.offsetWidth, height=folio.offsetHeight;
  folio.style.transform = 'matrix3d(' + [
    (b.x-a.x+g*b.x)/w,(b.y-a.y+g*b.y)/w,0,g/w,
    (c.x-a.x+h*c.x)/height,(c.y-a.y+h*c.y)/height,0,h/height,
    0,0,1,0,a.x,a.y,0,1
  ].join(',') + ')';
}
stage.addEventListener('corridor:render',alignFolio);
new ResizeObserver(alignFolio).observe(stage);

function snapshot(page) {
  const copy = page.cloneNode(true);
  copy.setAttribute('aria-hidden','true');
  copy.inert = true;
  copy.classList.add('turn-copy');
  return copy;
}
async function turnTo(i) {
  if (!opened || busy || viewer.open || i===index || i<0 || i>=data.sections.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    show(i);
    return;
  }
  busy = true;
  const direction = i>index ? 1 : -1;
  const outgoing = spread.querySelector(direction===1?'.case-right':'.case-left');
  const prepared = spread.cloneNode(true);
  renderSection(prepared,i);
  const incoming = prepared.querySelector(direction===1?'.case-right':'.case-left');
  const reverse = prepared.querySelector(direction===1?'.case-left':'.case-right');
  const width = outgoing.offsetWidth;
  const height = outgoing.offsetHeight;
  const spine = spread.clientWidth/2;
  const count = 16;
  const segment = width/count;
  const overlap = 1.15;

  const beneath = snapshot(incoming);
  beneath.classList.add('turn-under');
  beneath.style.cssText = 'left:'+ (direction===1?spine:0) +'px;width:'+width+'px;height:'+height+'px';
  const shadow = document.createElement('div');
  shadow.className = 'turn-shadow';
  shadow.setAttribute('aria-hidden','true');
  const turn = document.createElement('div');
  turn.className = 'turn-leaf';
  turn.setAttribute('aria-hidden','true');

  const pieces = Array.from({length:count},(_,j)=>{
    const piece = document.createElement('div');
    piece.className = 'turn-strip';
    piece.style.width = (segment+overlap)+'px';
    piece.style.height = height+'px';
    piece.style.transformOrigin = (direction===1?'left':'right')+' center';
    for (const [side,page,offset] of [
      ['front',outgoing,direction===1?j:count-1-j],
      ['back',reverse,direction===1?count-1-j:j]
    ]) {
      const face = document.createElement('div');
      face.className = 'turn-face turn-'+side;
      const copy = snapshot(page);
      const extendsLeft = side==='front' ? direction<0 : direction>0;
      copy.style.cssText = 'left:'+(-offset*segment+(extendsLeft?overlap:0))+'px;width:'+width+'px;height:'+height+'px';
      face.append(copy);
      piece.append(face);
    }
    turn.append(piece);
    return piece;
  });
  const controls = [...reader.querySelectorAll('button')];
  const focused = document.activeElement;
  const previousDisabled = controls.map(button=>button.disabled);
  controls.forEach(button=>button.disabled=true);
  outgoing.style.visibility = 'hidden';
  spread.append(beneath,shadow,turn);
  try {
    await motion(760,p=>{
      let x = spine;
      let z = .6;
      const curve = Math.sin(Math.PI*p);
      for (let j=0;j<count;j++) {
        const u = (j+.5)/count;
        const angle = Math.PI*p + .84*curve*(u-.31);
        const piece = pieces[j];
        piece.style.transform = 'translate3d('+ (x-(direction<0?segment+overlap:0)) +'px,0,'+z+'px) rotateY('+(-direction*angle)+'rad)';
        piece.style.setProperty('--crease',String(.07*curve*(1-u)));
        x += direction*segment*Math.cos(angle);
        z += segment*Math.sin(angle);
      }
      shadow.style.left = Math.min(x,spine)+'px';
      shadow.style.width = Math.max(1,Math.abs(x-spine))+'px';
      shadow.style.opacity = String(curve*.65);
    });
    show(i);
  } finally {
    turn.remove();shadow.remove();beneath.remove();
    outgoing.style.removeProperty('visibility');
    controls.forEach((button,j)=>{
      if (button.matches('[data-prev]')) button.disabled=index===0;
      else if (button.matches('[data-next]')) button.disabled=index===data.sections.length-1;
      else button.disabled=previousDisabled[j];
    });
    busy = false;
    if (focused instanceof HTMLElement && !focused.matches(':disabled')) focused.focus({preventScroll:true});
    else tabs.children[index].focus({preventScroll:true});
  }
}
reader.querySelector('[data-prev]').onclick=()=>turnTo(index-1);
reader.querySelector('[data-next]').onclick=()=>turnTo(index+1);

async function open() {
  if (!active || busy || opened) return;
  busy=true;layer.hidden=true;photoAside=true;
  const camera=window.HNJDeskCamera;
  show(index);
  reader.style.opacity='0';
  reader.inert=true;
  reader.hidden=false;
  await camera.move(true,t=>{
    reader.style.opacity=String(Math.max(0,(t-.91)/.09));
    alignFolio();
  });
  opened=true;reader.inert=false;
  reader.style.removeProperty('opacity');
  cassette.hidden=false;
  cassette.disabled=deckState!=='loaded';
  cassette.textContent=deckState==='loaded'?(window.HNJRoomMusic.status().playing?'▣ STOP':'▣ PLAY'):'▣ 테이프 없음';
  reader.querySelector('.case-close').focus();
  busy=false;root.dataset.caseState='reading';
}
async function close() {
  if (busy || !opened || viewer.open) return;
  busy=true;reader.inert=true;cassette.hidden=true;
  await window.HNJDeskCamera.move(false,t=>{
    reader.style.opacity=String(Math.max(0,1-t/.09));
  });
  reader.hidden=true;reader.inert=false;reader.style.removeProperty('opacity');
  opened=false;layer.hidden=false;busy=false;root.dataset.caseState='desk';targets.file.focus();
}
reader.querySelector('.case-close').onclick=close;
targets.file.onclick=open;
function motion(ms,fn){if(matchMedia('(prefers-reduced-motion: reduce)').matches){fn(1);return Promise.resolve();}return new Promise(resolve=>{let start;function frame(now){start??=now;const t=Math.min(1,(now-start)/ms);fn(t*t*(3-2*t));if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});}
function project(){if(!active||opened)return;const items=window.HNJDeskCamera.room()?.getDeskItems();if(!items)return;for(const [key,b]of Object.entries(targets)){const obj=key==='cassette'&&deckState==='loaded'&&root.dataset.tapeFocus?items.tapeDeck.playKey:items[key];if(!obj||b.hidden)continue;const v=new THREE.Vector3();obj.getWorldPosition(v);const p=window.HNJDeskCamera.project(v.toArray());if(!p)continue;b.style.left=p.x+'px';b.style.top=p.y+'px';b.style.visibility=p.depth<1?'visible':'hidden';}}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const hint=document.createElement('p');
hint.className='desk-touch-hint';
hint.textContent='책상 위 물건을 터치해 살펴보세요';
layer.append(hint);
let hovered=null;
const lifts=new Map();
function clearLifts(){
  for(const [object,offset] of lifts)object.position.y-=offset;
  lifts.clear();
  hovered=null;
  stage.style.cursor='';
}
function pickObject(event){
  if(!active||busy||opened||viewer.open||layer.hidden)return null;
  const camera=window.HNJDeskCamera;
  const items=camera.room().getDeskItems();
  const candidates=new Map();
  for(const [key,button] of Object.entries(targets)){
    if(button.hidden||button.disabled||!button.getClientRects().length)continue;
    const mesh=key==='cassette'&&deckState==='loaded'&&root.dataset.tapeFocus?items.tapeDeck.playKey:items[key];
    if(mesh)candidates.set(mesh,button);
  }
  const mesh=camera.pick(event.clientX,event.clientY,[...candidates.keys()]);
  return mesh?{mesh,button:candidates.get(mesh)}:null;
}
stage.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  hovered=pickObject(event)?.mesh??null;
  stage.style.cursor=hovered?'pointer':'';
});
stage.addEventListener('pointerleave',()=>{hovered=null;stage.style.cursor='';});
stage.addEventListener('click',event=>{
  const hit=pickObject(event);
  if(!hit)return;
  clearLifts();
  window.HNJDeskCamera.redraw(true);
  hit.button.click();
});
for(const button of Object.values(targets)){
  button.addEventListener('click',()=>clearLifts(),{capture:true});
}
let lastDeskFrame=0;
function deskFrame(now){
  requestAnimationFrame(deskFrame);
  if(document.hidden||!active||now-lastDeskFrame<40)return;
  const elapsed=Math.min(50,now-lastDeskFrame);
  lastDeskFrame=now;
  const camera=window.HNJDeskCamera;
  if(busy||opened||viewer.open||layer.hidden){
    if(lifts.size)clearLifts();
    return;
  }
  if(reducedMotion.matches)return;
  if(hovered&&!lifts.has(hovered)){
    lifts.set(hovered,0);
    if(hovered.userData.liftCompanion)lifts.set(hovered.userData.liftCompanion,0);
  }
  let changed=false;
  for(const [mesh,offset] of lifts){
    const selected=mesh===hovered||mesh===hovered?.userData.liftCompanion;
    const target=selected?(mesh===camera.room().getDeskItems().tapeDeck.playKey ? 0 : .0035):0;
    const difference=target-offset;
    const next=Math.abs(difference)<.00008?target:offset+difference*(1-Math.exp(-elapsed/61));
    mesh.position.y+=next-offset;
    changed ||= next!==offset;
    if(next===0&&!selected)lifts.delete(mesh);
    else lifts.set(mesh,next);
  }
  if(!root.dataset.tapeFocus)camera.room().animateSteam(now/1000);
  if(changed||!root.dataset.tapeFocus)camera.redraw(changed);
}
requestAnimationFrame(deskFrame);
stage.addEventListener('corridor:render',project);window.addEventListener('resize',project);
window.addEventListener('investigation:room-entered',()=>{active=true;reflectMemo();window.HNJDeskCamera.refresh();layer.hidden=false;root.dataset.caseState='desk';project();});
window.addEventListener('keydown',e=>{if(viewer.open)return;if(e.key==='Escape'&&!deckBack.hidden){deckBack.click();return;}if(!opened)return;if(e.key==='Escape')close();if(e.key==='ArrowRight'){e.preventDefault();turnTo(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();turnTo(index-1);}});
window.HNJCaseFile=Object.freeze({state:()=>({active,opened,busy,section:data.sections[index].id,photoAside})});
})();
