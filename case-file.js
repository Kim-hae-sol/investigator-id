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
reader.innerHTML='<div class="case-folio"><button class="case-close" type="button">파일 닫기 ×</button><div class="case-spread"><div class="folio-stock" aria-hidden="true"></div><article class="case-left"><i class="folio-clip" aria-hidden="true"></i><small>CASE FILE : HNJ</small><h1></h1><p class="case-subtitle"></p><p class="case-assigned"></p><div class="case-rule"></div><span class="case-reference"></span><div class="folio-slip"><i class="folio-tie" aria-hidden="true"></i><span>FILE COPY</span><strong>HNJ</strong><span>ARCHIVE / 01</span></div></article><article class="case-right"><small>기록 구간</small><div class="case-content"></div><div class="folio-attachments"></div><nav class="case-pages" aria-label="기록 순서"><button type="button" data-prev>← 이전</button><span></span><button type="button" data-next>다음 →</button></nav></article></div><nav class="case-tabs" aria-label="챕터 인덱스"></nav></div>';
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
const tabs=reader.querySelector('.case-tabs');data.sections.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=s.title;b.onclick=()=>show(i);tabs.append(b);});
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
  if (busy || deckState !== 'open') return;
  busy = true;
  const deck = window.HNJDeskCamera.room().getDeskItems().tapeDeck;
  await motion(420, progress => {
    deck.lidAt(1-progress);
    window.HNJDeskCamera.tapeView(1-progress);
  });
  deckState = 'closed';
  deckBack.hidden = true;
  delete root.dataset.tapeFocus;
  label(deckButton, '카세트 덮개 열기');
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
deckButton.onclick = () => deckState === 'loaded' ? music() : openDeck();
tapeButton.onclick = async () => {
  if (busy || opened || deckState === 'loaded') return;
  if (deckState === 'closed') {
    await openDeck();
    return;
  }
  busy = true;
  const deck = window.HNJDeskCamera.room().getDeskItems().tapeDeck;
  await motion(670, progress => {
    deck.insertAt(progress);
    window.HNJDeskCamera.tapeView(1);
  });
  await motion(340, progress => {
    deck.lidAt(1-progress);
    window.HNJDeskCamera.tapeView(1-progress);
  });
  deckState = 'loaded';
  deckBack.hidden = true;
  delete root.dataset.tapeFocus;
  tapeButton.hidden = true;
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
    if (opened) camera.refreshReading();
    else camera.refresh();
  }
});
function inspect(kind){lastFocus=document.activeElement;viewer.dataset.kind=kind;const body=viewer.querySelector('.viewer-body');body.replaceChildren();if(kind==='photo'){if(data.photo){const img=new Image();img.src=data.photo;img.alt='허남준 원본 사진';body.append(img);}else{const p=document.createElement('div');p.className='case-photo-placeholder';p.textContent='PHOTO / ASSET PENDING';body.append(p);}}else{const p=document.createElement('p');p.className='case-memo';p.textContent=data.memo;body.append(p);}viewer.showModal();}
targets.photo.onclick=()=>inspect('photo');targets.photo2.onclick=()=>inspect('photo');targets.photo3.onclick=()=>inspect('photo');targets.note.onclick=()=>inspect('note');
function show(i){index=Math.max(0,Math.min(data.sections.length-1,i));const s=data.sections[index];reader.querySelector('h1').textContent=s.title;reader.querySelector('.case-subtitle').textContent=s.subtitle;const identity=window.HNJ.getIdentity();reader.querySelector('.case-assigned').textContent='담당 조사관 · '+(identity?.name||'—');reader.querySelector('.case-reference').textContent='HNJ / '+s.id.toUpperCase();
 const area=reader.querySelector('.case-content');window.HNJCaseSections.render(s,area,{inspect,evidenceLayer,identity});
 reader.querySelector('[data-prev]').disabled=index===0;reader.querySelector('[data-next]').disabled=index===data.sections.length-1;reader.querySelector('.case-pages span').textContent=String(index+1).padStart(2,'0')+' / SECTION';[...tabs.children].forEach((b,j)=>b.setAttribute('aria-current',j===index?'true':'false'));}
reader.querySelector('[data-prev]').onclick=()=>show(index-1);reader.querySelector('[data-next]').onclick=()=>show(index+1);
async function open(){if(!active||busy||opened)return;busy=true;layer.hidden=true;photoAside=true;
 const photo=window.HNJDeskCamera.room()?.getDeskItems().photo,start=photo?.position.x||.02,startY=photo?.position.y||.827;
 await motion(260,t=>{if(photo){photo.position.x=start+(-.39-start)*t;photo.position.y=startY+(.786-startY)*Math.max(0,(t-.62)/.38);}window.HNJDeskCamera.refresh();});
 await window.HNJDeskCamera.move(true);window.HNJDeskCamera.room().getDeskItems().file.visible=false;window.HNJDeskCamera.refreshReading();opened=true;show(index);reader.hidden=false;cassette.hidden=false;cassette.disabled=deckState!=='loaded';cassette.textContent=deckState==='loaded'?(window.HNJRoomMusic.status().playing?'▣ STOP':'▣ PLAY'):'▣ 테이프 없음';reader.querySelector('.case-close').focus();busy=false;root.dataset.caseState='reading';}
async function close(){if(busy||!opened)return;busy=true;reader.hidden=true;cassette.hidden=true;window.HNJDeskCamera.room().getDeskItems().file.visible=true;await window.HNJDeskCamera.move(false);opened=false;layer.hidden=false;busy=false;root.dataset.caseState='desk';targets.file.focus();}
reader.querySelector('.case-close').onclick=close;targets.file.onclick=open;
function motion(ms,fn){if(matchMedia('(prefers-reduced-motion: reduce)').matches){fn(1);return Promise.resolve();}return new Promise(resolve=>{let start;function frame(now){start??=now;const t=Math.min(1,(now-start)/ms);fn(t*t*(3-2*t));if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});}
function project(){if(!active||opened)return;const items=window.HNJDeskCamera.room()?.getDeskItems();if(!items)return;for(const [key,b]of Object.entries(targets)){const obj=items[key];if(!obj||b.hidden)continue;const v=new THREE.Vector3();obj.getWorldPosition(v);const p=window.HNJDeskCamera.project(v.toArray());if(!p)continue;b.style.left=p.x+'px';b.style.top=p.y+'px';b.style.visibility=p.depth<1?'visible':'hidden';}}
stage.addEventListener('corridor:render',project);window.addEventListener('resize',project);
window.addEventListener('investigation:room-entered',()=>{active=true;layer.hidden=false;root.dataset.caseState='desk';project();});
window.addEventListener('keydown',e=>{if(viewer.open)return;if(e.key==='Escape'&&!deckBack.hidden){deckBack.click();return;}if(!opened)return;if(e.key==='Escape')close();if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}});
window.HNJCaseFile=Object.freeze({state:()=>({active,opened,busy,section:data.sections[index].id,photoAside})});
})();
