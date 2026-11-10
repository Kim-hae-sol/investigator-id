/* Projected 3D desk targets, readable folio, evidence viewer, and persistent cassette. */
(()=>{'use strict';
const data=window.HNJCaseData,root=document.querySelector('#opening-sequence'),stage=document.querySelector('#opening-stage');
let active=false,opened=false,busy=false,index=0,lastFocus=null,photoAside=false;
let deckState = 'closed';
const layer=document.createElement('div');layer.className='case-desk-targets';layer.hidden=true;root.append(layer);
const targets={};const labels={file:'CASE FILE : HNJ 열기',photo:'허남준 사진 확대',photo2:'사진 자료 02 확대',photo3:'사진 자료 03 확대',note:'조사관 메모 펼치기',cassette:'카세트 덮개 열기',tape:'테이프 삽입'};
for(const [key,label]of Object.entries(labels)){const b=document.createElement('button');b.className='case-object case-'+key;b.type='button';b.setAttribute('aria-label',label);b.title=label;layer.append(b);targets[key]=b;}
const reader=document.createElement('section');reader.className='case-reader';reader.hidden=true;reader.setAttribute('aria-label','CASE FILE : HNJ 기록철');
reader.innerHTML=`
  <div class="case-folio">
    <button class="case-close" type="button">파일 닫기 ×</button>
    <div class="case-spread">
      <div class="folio-stock" aria-hidden="true"></div>
      <article class="case-left">
        <small>CASE FILE : HNJ</small>
        <h1 tabindex="-1"></h1>
        <p class="case-assigned"></p>
        <div class="case-chapter-left"></div>
      </article>
      <article class="case-right">
        <div class="case-chapter-right"></div>
        <nav class="case-pages" aria-label="기록 순서">
          <button type="button" data-prev>← 이전</button><span></span><button type="button" data-next>다음 →</button>
        </nav>
      </article>
    </div>
    <nav class="case-tabs" aria-label="챕터 인덱스"></nav>
  </div>`;
root.append(reader);
const tabs=reader.querySelector('.case-tabs');
data.sections.forEach((section,i)=>{
  const button=document.createElement('button');
  button.type='button';
  button.textContent=String(i+1).padStart(2,'0');
  button.setAttribute('aria-label',section.title);
  button.title=section.title;
  button.onclick=()=>turnTo(i);
  tabs.append(button);
});
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
async function pressPlay() {
  if(busy||deckState!=='loaded')return;
  busy=true;
  const camera=window.HNJDeskCamera;
  const deck=camera.room().getDeskItems().tapeDeck;
  try {
    if(window.HNJ.audio.isEnabled())window.HNJRoomFoley('play');
    window.HNJRoomMusic.toggle();
    if(!reducedMotion.matches){
      deck.pressKey(.4);
      camera.redraw(true);
      await motion(145,t=>{
        deck.pressKey(t<.25?.4+2.4*t:(1-t)/.75);
        camera.redraw(true);
      });
    }
  } finally {
    deck.pressKey(0);
    camera.redraw(true);
    busy=false;
  }
}
cassette.onclick = pressPlay;
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
const draftKey=memoKey+'-draft';
let memoText='', memoDraft=null;
try {
  memoText=localStorage.getItem(memoKey) ?? '';
  memoDraft=localStorage.getItem(draftKey);
} catch {}
function reflectMemo() {
  window.HNJDeskCamera.room()?.getDeskItems().writeNote(memoText || data.memo);
}

const memoDialog=document.createElement('dialog');
memoDialog.className='desk-note-flight';
memoDialog.setAttribute('aria-label','조사관 메모');
memoDialog.innerHTML=`
  <form class="desk-note-sheet">
    <div class="desk-note-controls">
      <button type="button" data-return>닫기 ×</button>
    </div>
    <section class="desk-note-record"><small>기본 기록</small><p></p></section>
    <label class="desk-note-writing">내 메모<textarea maxlength="360" rows="4"></textarea></label>
    <div class="desk-note-controls"><output aria-live="polite"></output><button type="submit">저장</button></div>
  </form>`;
document.body.append(memoDialog);
const memoSheet=memoDialog.querySelector('form');
const memoInput=memoSheet.querySelector('textarea');
const memoStatus=memoSheet.querySelector('output');
memoSheet.querySelector('.desk-note-record p').textContent=data.memo;
let memoMoving=false, memoSource=null, memoMesh=null, memoFocus=null;

function noteCorners() {
  if (memoMesh) {
    const camera=window.HNJDeskCamera;
    const {widthSegments,heightSegments}=memoMesh.geometry.parameters;
    const row=widthSegments+1;
    const vertices=memoMesh.geometry.attributes.position;
    const rect=stage.getBoundingClientRect();
    return [0,widthSegments,heightSegments*row,vertices.count-1].map(index=>{
      const corner=new THREE.Vector3().fromBufferAttribute(vertices,index);
      const point=camera.project(memoMesh.localToWorld(corner).toArray());
      return {x:point.x+rect.left,y:point.y+rect.top};
    });
  }
  const {left,top,right,bottom}=memoSource.getBoundingClientRect();
  return [{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}];
}

function animateNote(opening) {
  const source=noteCorners();
  const w=memoSheet.offsetWidth, height=memoSheet.offsetHeight;
  const x=(memoDialog.clientWidth-w)/2, y=(memoDialog.clientHeight-height)/2;
  const destination=[{x,y},{x:x+w,y},{x,y:y+height},{x:x+w,y:y+height}];
  const draw=p=>{
    const [a,b,c,d]=source.map((point,i)=>({
      x:point.x+(destination[i].x-point.x)*p,
      y:point.y+(destination[i].y-point.y)*p-18*Math.sin(Math.PI*p)
    }));
    const dx1=b.x-d.x,dx2=c.x-d.x,dx3=a.x-b.x-c.x+d.x;
    const dy1=b.y-d.y,dy2=c.y-d.y,dy3=a.y-b.y-c.y+d.y;
    const det=dx1*dy2-dx2*dy1;
    const g=Math.abs(det)<.001?0:(dx3*dy2-dx2*dy3)/det;
    const h=Math.abs(det)<.001?0:(dx1*dy3-dx3*dy1)/det;
    memoSheet.style.transform='matrix3d('+[
      (b.x-a.x+g*b.x)/w,(b.y-a.y+g*b.y)/w,0,g/w,
      (c.x-a.x+h*c.x)/height,(c.y-a.y+h*c.y)/height,0,h/height,
      0,0,1,0,a.x,a.y,0,1
    ].join(',')+')';
    memoDialog.style.setProperty('--desk-shade',String(.14*p));
    memoSheet.style.setProperty('--paper-lift',String(p));
    memoSheet.style.setProperty('--note-ink',String(Math.max(0,(p-.35)/.65)));
  };
  draw(opening?0:1);
  return motion(410,t=>draw(opening?t:1-t));
}

async function showMemo(source) {
  if (!active || busy || memoMoving || memoDialog.open || viewer.open) return;
  memoMoving=true;
  memoFocus=source || document.activeElement;
  memoSource=source || reader.querySelector('h1');
  memoMesh=source===targets.note ? window.HNJDeskCamera.room().getDeskItems().note : null;
  memoInput.value=memoDraft ?? memoText;
  memoStatus.textContent=memoDraft===null?'':'저장하지 않은 초안';
  memoSheet.inert=true;
  memoDialog.style.setProperty('--desk-shade','0');
  memoSheet.style.setProperty('--paper-lift','0');
  memoSheet.style.setProperty('--note-ink','0');
  if (memoMesh) {
    memoSheet.style.setProperty('--note-surface','url('+memoMesh.material.map.image.toDataURL()+')');
  } else memoSheet.style.removeProperty('--note-surface');
  if (memoMesh && !reducedMotion.matches) {
    const camera=window.HNJDeskCamera;
    await motion(125,t=>{
      camera.room().getDeskItems().curlNote(.014*t);
      camera.redraw(true);
    });
  }
  memoDialog.showModal();
  const flight=animateNote(true);
  if (memoMesh) {
    memoMesh.visible=false;
    window.HNJDeskCamera.redraw(true);
  }
  await flight;
  memoMoving=false;
  memoSheet.inert=false;
  memoSheet.querySelector('[data-return]').focus({preventScroll:true});
}

async function returnMemo() {
  if (!memoDialog.open || memoMoving) return;
  memoMoving=true;
  memoSheet.inert=true;
  await animateNote(false);
  if (memoMesh) {
    memoMesh.visible=true;
    const camera=window.HNJDeskCamera;
    memoDialog.close();
    await motion(115,t=>{
      camera.room().getDeskItems().curlNote(.014*(1-t));
      camera.redraw(true);
    });
  }
  if (memoDialog.open) memoDialog.close();
  memoMoving=false;
  memoFocus?.focus({preventScroll:true});
}
memoSheet.querySelector('[data-return]').onclick=returnMemo;
memoDialog.addEventListener('cancel',event=>{event.preventDefault();returnMemo();});
memoInput.addEventListener('input',()=>{
  memoDraft=memoInput.value;
  try { localStorage.setItem(draftKey,memoDraft); memoStatus.textContent='초안 보관됨'; }
  catch { memoStatus.textContent='이 탭에 초안 보관 중'; }
});
memoSheet.onsubmit=event=>{
  event.preventDefault();
  if (memoMoving) return;
  try {
    localStorage.setItem(memoKey,memoInput.value);
    localStorage.removeItem(draftKey);
  } catch {
    memoStatus.textContent='저장할 수 없습니다. 초안은 이 탭에 남습니다.';
    return;
  }
  memoText=memoInput.value;
  memoDraft=null;
  reflectMemo();
  returnMemo();
};

function inspect(kind){
  if(kind==='note'){showMemo(document.activeElement.closest('.case-reader button'));return;}
  lastFocus=document.activeElement;
  const body=viewer.querySelector('.viewer-body');
  body.replaceChildren();
  if(data.photo){
    const img=new Image();img.src=data.photo;img.alt='허남준 원본 사진';body.append(img);
  }else{
    const p=document.createElement('div');p.className='case-photo-placeholder';p.textContent='PHOTO / ASSET PENDING';body.append(p);
  }
  viewer.showModal();
}
targets.photo.onclick=()=>inspect('photo');targets.photo2.onclick=()=>inspect('photo');targets.photo3.onclick=()=>inspect('photo');
targets.note.onclick=()=>showMemo(targets.note);
const documentViewer=document.createElement('dialog');
documentViewer.className='case-document-viewer';
documentViewer.innerHTML='<button type="button" class="document-return">기록철로 돌아가기 ×</button><div class="document-reading"></div>';
document.body.append(documentViewer);
const documentReading=documentViewer.querySelector('.document-reading');
let documentFocus=null;
documentViewer.querySelector('button').onclick=()=>documentViewer.close();
documentViewer.addEventListener('close',()=>{
  if (documentViewer.open) return;
  documentReading.replaceChildren();
  documentFocus?.focus({preventScroll:true});
});
function expandDocument(sheet,title,trigger) {
  if (busy || documentViewer.open) return;
  finishTyping?.(true);
  documentFocus=trigger;
  const copy=sheet.cloneNode(true);
  copy.querySelector('.document-expand')?.remove();
  documentViewer.dataset.format=sheet.classList.contains('document-board')?'wide':'portrait';
  documentViewer.setAttribute('aria-label',title);
  documentReading.replaceChildren(copy);
  documentViewer.showModal();
  documentReading.scrollTop=0;
}

function renderSection(scope, i) {
  const section = data.sections[i];
  const identity = window.HNJ.getIdentity();
  scope.querySelector('h1').textContent = section.title;
  scope.querySelector('.case-assigned').textContent = '담당 조사관 · ' + (identity?.name || '—');
  window.HNJCaseSections.render(section,scope.querySelector('.case-chapter-left'),
    scope.querySelector('.case-chapter-right'),{
      sections:data.sections,identity,memo:data.memo,expand:expandDocument,
      goTo:id=>turnTo(data.sections.findIndex(chapter=>chapter.id===id))
    });
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
let folioTravel=1;
function alignFolio() {
  if (reader.hidden) return;
  if (stage.clientWidth < 760 || stage.clientHeight < 540) {
    reader.classList.add('folio-compact');
    if (folioTravel>=1) folio.style.removeProperty('transform');
    else {
      const camera=window.HNJDeskCamera;
      const file=camera.room().getDeskItems().file;
      const point=camera.project(file.getWorldPosition(new THREE.Vector3()).toArray());
      const rect=stage.getBoundingClientRect();
      const parent=reader.getBoundingClientRect();
      const x=point.x+rect.left-parent.left-folio.offsetLeft-folio.offsetWidth/2;
      const y=point.y+rect.top-parent.top-folio.offsetTop-folio.offsetHeight/2;
      const remaining=1-folioTravel;
      folio.style.transform=`translate(${x*remaining}px,${y*remaining}px) scale(${1-.65*remaining})`;
    }
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
function followFolder(openAmount) {
  folioTravel=openAmount;
  const start=stage.clientWidth<760||stage.clientHeight<540 ? .24 : .74;
  const opacity=Math.max(0,Math.min(1,(openAmount-start)/(1-start)));
  reader.style.opacity=String(opacity*opacity*(3-2*opacity));
  alignFolio();
}

const chapterInk = [...reader.querySelectorAll('h1,.case-assigned,.case-chapter-left,.case-chapter-right')];
const readRecords = new Set();
let finishTyping = null;

function prepareRecord() {
  const record = reader.querySelector('[data-type-record]');
  if (!record || reducedMotion.matches || readRecords.has(index)) return;
  const paragraphs = [...record.querySelectorAll('p:not(.chapter-empty)')];
  const runs = paragraphs.map(paragraph=>{
    const letters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('ko').segment(paragraph.textContent), item=>item.segment)
      : Array.from(paragraph.textContent);
    return {paragraph,letters};
  });
  const length = runs.reduce((total,{letters})=>total+letters.length,0);
  if (!length || length>120) return;

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'case-type-skip';
  skip.textContent = '전체 보기';
  record.append(skip);
  let frame, start;
  const sectionIndex = index;
  function reveal(count) {
    for (const run of runs) {
      const visible = Math.min(count,run.letters.length);
      run.tail.textContent = run.letters.slice(visible).join('');
      run.paragraph.replaceChildren(run.letters.slice(0,visible).join(''),run.tail);
      count -= visible;
    }
  }
  finishTyping = (read=false)=>{
    cancelAnimationFrame(frame);
    reveal(length);
    if (read) readRecords.add(sectionIndex);
    if (document.activeElement===skip) reader.querySelector('h1').focus({preventScroll:true});
    skip.disabled=true;
    skip.style.visibility='hidden';
    record.removeEventListener('click',skipTyping);
    finishTyping=null;
  };
  function skipTyping() { if (!busy) finishTyping?.(true); }
  record.addEventListener('click',skipTyping);
  for (const run of runs) {
    run.tail=document.createElement('span');
    run.tail.className='case-type-tail';
  }
  reveal(0);
  const duration=Math.min(1250,Math.max(240,length*24));
  function tick(now) {
    start ??= now;
    const count=Math.floor((now-start)*length/duration);
    if(count>=length)finishTyping(true);
    else {
      reveal(count);
      frame=requestAnimationFrame(tick);
    }
  }
  return ()=>{if (finishTyping) frame=requestAnimationFrame(tick);};
}

async function turnTo(i) {
  if (!opened || busy || viewer.open || memoDialog.open || i===index || i<0 || i>=data.sections.length) return;
  const focused = document.activeElement;
  finishTyping?.();
  busy = true;
  const direction = Math.sign(i-index);
  const animateInk = async (from,to,duration) => {
    const animations=chapterInk.map(node=>node.animate([from,to],{duration,easing:'ease-in-out',fill:'forwards'}));
    await Promise.all(animations.map(animation=>animation.finished));
    return animations;
  };
  let outgoing = [];
  let incoming = [];
  let startRecord;
  try {
    if (!reducedMotion.matches) outgoing=await animateInk(
      {opacity:1,transform:'none'},
      {opacity:.08,transform:'translateX('+(-4*direction)+'px)'},145);
    show(i);
    startRecord=prepareRecord();
    if (!reducedMotion.matches || outgoing.length) incoming=await animateInk(
      {opacity:.08,transform:'translateX('+(4*direction)+'px)'},
      {opacity:1,transform:'none'},165);
  } finally {
    [...outgoing,...incoming].forEach(animation=>animation.cancel());
    busy=false;
  }
  if (reader.contains(focused) && (!focused.isConnected || focused.matches(':disabled'))) {
    reader.querySelector('h1').focus({preventScroll:true});
  }
  startRecord?.();
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
  followFolder(0);
  await camera.move(true,followFolder);
  opened=true;reader.inert=false;
  reader.style.removeProperty('opacity');
  cassette.hidden=false;
  cassette.disabled=deckState!=='loaded';
  cassette.textContent=deckState==='loaded'?(window.HNJRoomMusic.status().playing?'▣ STOP':'▣ PLAY'):'▣ 테이프 없음';
  reader.querySelector('.case-close').focus();
  busy=false;root.dataset.caseState='reading';
  prepareRecord()?.();
}
async function close() {
  if (busy || !opened || viewer.open) return;
  finishTyping?.();
  busy=true;reader.inert=true;cassette.hidden=true;
  await window.HNJDeskCamera.move(false,t=>followFolder(1-t));
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
  const items=window.HNJDeskCamera.room()?.getDeskItems();
  for(const [object,offset] of lifts){
    if(object===items?.note)items.curlNote(0);
    else object.position.y-=offset;
  }
  lifts.clear();
  hovered=null;
  stage.style.cursor='';
}
const deskPickOffsets=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
function pickObject(event, includeHoverOnly=false){
  if(!active||busy||opened||viewer.open||memoMoving||memoDialog.open||layer.hidden)return null;
  const camera=window.HNJDeskCamera;
  const items=camera.room().getDeskItems();
  const candidates=new Map();
  for(const [key,button] of Object.entries(targets)){
    if(button.hidden||button.disabled||!button.getClientRects().length)continue;
    const mesh=key==='cassette'&&deckState==='loaded'&&root.dataset.tapeFocus?items.tapeDeck.playKey:items[key];
    if(mesh)candidates.set(mesh,button);
  }
  if(includeHoverOnly&&!root.dataset.tapeFocus)candidates.set(items.pen,null);
  const {clientX:x,clientY:y}=event;
  let mesh=camera.pick(x,y,[...candidates.keys()]);
  if (!mesh) {
    const clickable=[...candidates].filter(([,button])=>button).map(([object])=>object);
    const radius=event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents?16:9;
    for (const [dx,dy] of deskPickOffsets) {
      mesh=camera.pick(x+dx*radius,y+dy*radius,clickable);
      if(mesh)break;
    }
  }
  return mesh?{mesh,button:candidates.get(mesh)}:null;
}
stage.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  const hit=pickObject(event,true);
  hovered=hit?.mesh??null;
  stage.style.cursor=hit?.button?'pointer':'';
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
  const items=camera.room().getDeskItems();
  const reelsMoving=!busy&&!reducedMotion.matches&&items.tapeDeck.advanceReels(elapsed/1000);
  if(busy||opened||viewer.open||memoMoving||memoDialog.open||layer.hidden){
    if(lifts.size)clearLifts();
    if(reelsMoving)camera.redraw();
    return;
  }
  if(reducedMotion.matches)return;
  if(hovered&&!lifts.has(hovered)){
    lifts.set(hovered,0);

  }
  let changed=false;
  for(const [mesh,offset] of lifts){
    const selected=mesh===hovered;
    const distance=mesh===items.pen ? .0015 : mesh===items.note ? .010 : mesh===items.tapeDeck.playKey ? 0 : .0035;
    const target=selected?distance:0;
    const difference=target-offset;
    const next=Math.abs(difference)<.00008?target:offset+difference*(1-Math.exp(-elapsed/61));
    if(mesh===items.note){if(next!==offset)items.curlNote(next);}
    else mesh.position.y+=next-offset;
    changed ||= next!==offset;
    if(next===0&&!selected)lifts.delete(mesh);
    else lifts.set(mesh,next);
  }
  if(!root.dataset.tapeFocus)camera.room().animateSteam(now/1000);
  if(changed||reelsMoving||!root.dataset.tapeFocus)camera.redraw(changed);
}
requestAnimationFrame(deskFrame);
stage.addEventListener('corridor:render',project);window.addEventListener('resize',project);
window.addEventListener('investigation:room-entered',()=>{active=true;reflectMemo();window.HNJDeskCamera.refresh();layer.hidden=false;root.dataset.caseState='desk';project();});
window.addEventListener('keydown',e=>{if(viewer.open||memoDialog.open||documentViewer.open)return;if(e.key==='Escape'&&!deckBack.hidden){deckBack.click();return;}if(!opened)return;if(e.key==='Escape')close();if(e.key==='ArrowRight'){e.preventDefault();turnTo(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();turnTo(index-1);}});
window.HNJCaseFile=Object.freeze({state:()=>({active,opened,busy,section:data.sections[index].id,photoAside})});
})();
