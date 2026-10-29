/* STEP 03: local issued-card view + projected 3D nickel reader.
   Only authentication: no handle listener, door rotation or interior scene. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const stage = $('#opening-stage'), root = $('#opening-sequence');
  const layer = $('#door-interaction-layer'), target = $('#reader-target');
  const card = $('#access-card'), lip = $('#reader-lip'), status = $('#access-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { arrivedAtDoor:false, authSceneOpen:false, cardInserted:false, doorUnlocked:false };
  let scene, busy=false, selected=false, pointer=null, geometry=null, baseWidth=354, baseHeight=590;
  let pose={x:0,y:0}, home={x:0,y:0}, cardSize={width:0,height:0}, closeProgress=0;
  let channel=null, context=null;
  const smooth = t => t*t*(3-2*t);
  const announce = text => { status.textContent=text; };
  function publish() {
    for(const [key,value] of Object.entries(state)) layer.dataset[key]=String(value);
    target.disabled=busy||state.doorUnlocked;
    card.classList.toggle('is-busy',busy);
  }
  function audioChannel() {
    if(!window.HNJ?.audio.isEnabled()||document.hidden) return null;
    const ctx=window.HNJ.audio.getContext(); if(!ctx) return null;
    if(context!==ctx) { channel?.disconnect(); context=ctx; channel=ctx.createGain();channel.gain.value=.65;channel.connect(ctx.destination); }
    return ctx;
  }
  function syncSound() {
    const enabled=window.HNJ?.audio.isEnabled()&&!document.hidden;
    if(enabled) audioChannel();
    if(channel) { channel.gain.cancelScheduledValues(context.currentTime);channel.gain.setTargetAtTime(enabled?.65:0,context.currentTime,.006); }
  }
  $('#sound-button').addEventListener('click',syncSound);
  document.addEventListener('visibilitychange',syncSound);
  // Quiet friction followed by a short, resonant metal latch. No digital tone or beep.
  function mechanism(kind) {
    const ctx=audioChannel();if(!ctx)return;
    const start=ctx.currentTime, friction=kind==='slide', duration=friction?.48:.25;
    const count=Math.ceil(ctx.sampleRate*duration), buffer=ctx.createBuffer(1,count,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<count;i++) {
      const t=i/ctx.sampleRate, n=Math.random()*2-1;
      data[i]=friction?n*(.35+.65*Math.sin(Math.PI*i/count)):n*(Math.exp(-t*45)+.65*Math.exp(-Math.max(0,t-.065)*65)*(t>.065?1:0));
    }
    const source=ctx.createBufferSource(); source.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type=friction?'bandpass':'highpass';filter.frequency.value=friction?1900:240;filter.Q.value=friction?.6:.5;
    const gain=ctx.createGain();gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(friction?.12:.27,start+.009);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter).connect(gain).connect(channel);
    // A physical metal resonance under the latch, buried beneath its transient.
    const nodes=[source,filter,gain];
    if(!friction) for(const frequency of [367,813,1327]) {
      const resonator=ctx.createBiquadFilter();resonator.type='bandpass';resonator.frequency.value=frequency;resonator.Q.value=8;
      const level=ctx.createGain();level.gain.value=.12;source.connect(resonator).connect(level).connect(channel);nodes.push(resonator,level);
    }
    source.start();source.onended=()=>nodes.forEach(n=>n.disconnect());
    layer.dataset.lastSound=kind;layer.dataset.soundEvents=String(Number(layer.dataset.soundEvents||0)+1);
  }
  // RAF durations pause in background tabs, so return and insertion cannot jump ahead unseen.
  function animate(duration,draw) {
    if(reduce.matches) {draw(1);return Promise.resolve();}
    return new Promise(resolve=>{let elapsed=0,last=null;
      function frame(now) {
        if(document.hidden){last=null;requestAnimationFrame(frame);return;}
        if(last!==null)elapsed+=Math.min(64,now-last);last=now;
        const t=Math.min(1,elapsed/duration);draw(smooth(t));
        if(t<1)requestAnimationFrame(frame);else resolve();
      }requestAnimationFrame(frame);
    });
  }
  function drawCard(p=pose,clip=false) {
    pose={...p};card.style.transform=`translate3d(${p.x}px,${p.y}px,0)`;
    card.style.clipPath=clip?`inset(${Math.max(0,geometry.mouthY-p.y)}px 0 0 0)`:'none';
  }
  function projection() {
    if(!scene||!state.arrivedAtDoor)return;
    geometry=scene.readerProjection();
    target.style.left=`${geometry.x+geometry.width/2}px`;target.style.top=`${geometry.y+geometry.height/2}px`;
    target.style.width=`${Math.max(44,geometry.width+12)}px`;target.style.height=`${Math.max(44,geometry.height+12)}px`;
    lip.style.left=`${geometry.mouthX}px`;lip.style.top=`${geometry.mouthY-1}px`;lip.style.width=`${geometry.mouthWidth*1.17}px`;
    if(state.authSceneOpen&&!card.hidden) {
      const old={...home};
      cardSize.width=geometry.mouthWidth*.93; cardSize.height=cardSize.width*baseHeight/baseWidth;
      card.style.width=`${cardSize.width}px`;card.style.height=`${cardSize.height}px`;
      card.firstElementChild.style.transform=`scale(${cardSize.width/baseWidth})`;
      home={x:geometry.mouthX-cardSize.width/2,y:geometry.mouthY+Math.max(18,stage.clientHeight*.035)};
      if(!busy&&!pointer)drawCard({x:pose.x+home.x-old.x,y:pose.y+home.y-old.y});
    }
  }
  function cloneIssuedCard() {
    const source=$('#id-form'), view=source.cloneNode(true);
    baseWidth=parseFloat(getComputedStyle($('.card-rig')).width)||354;
    view.removeAttribute('id');view.removeAttribute('aria-label');view.setAttribute('aria-hidden','true');
    view.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    view.querySelectorAll('[for]').forEach(e=>e.removeAttribute('for'));
    view.querySelectorAll('input').forEach(input=>{
      if(input.type==='file'||input.type==='range'){input.remove();return;}
      const out=document.createElement('output');out.className='access-name';out.textContent=$('#investigator-name').value;out.style.cssText=input.style.cssText;input.replaceWith(out);
    });
    view.querySelectorAll('button,.photo-toolbar,.edit-mark').forEach(e=>e.remove());
    view.querySelectorAll('[tabindex]').forEach(e=>e.removeAttribute('tabindex'));
    view.style.width=`${baseWidth}px`;card.replaceChildren(view);
    card.hidden=false;view.style.transform='none';baseHeight=view.offsetHeight;
    projection();drawCard(home);
  }
  async function openAuth() {
    if(!state.arrivedAtDoor||busy||state.doorUnlocked)return;
    if(state.authSceneOpen){if(selected)await insertCard();return;}
    busy=true;state.authSceneOpen=true;publish();audioChannel();
    try {
      await animate(680,t=>{closeProgress=t;scene.authView(t);});
      cloneIssuedCard();const from={x:home.x,y:home.y+60};
      await animate(330,t=>drawCard({x:home.x,y:from.y+(home.y-from.y)*t}));
      announce('조사관증을 슬롯으로 옮기세요. 키보드는 카드 선택 후 슬롯을 선택하세요.');
    } finally {busy=false;publish();if(!card.hidden)card.focus({preventScroll:true});}
  }
  function selectCard(){if(busy||state.cardInserted)return;selected=true;card.classList.add('is-selected');announce('조사관증 선택됨. 금속 슬롯을 선택하면 삽입합니다.');}
  async function returnCard(){busy=true;publish();const from={...pose};await animate(250,t=>drawCard({x:from.x+(home.x-from.x)*t,y:from.y+(home.y-from.y)*t}));busy=false;publish();}
  function nearMouth(){
    const top={x:pose.x+cardSize.width/2,y:pose.y};
    return Math.abs(top.x-geometry.mouthX)<Math.max(65,geometry.mouthWidth*.9)&&Math.abs(top.y-geometry.mouthY)<Math.max(60,cardSize.height*.27);
  }
  async function insertCard() {
    if(busy||!state.authSceneOpen||state.cardInserted)return;
    busy=true;pointer=null;card.classList.remove('is-dragging');target.blur();card.blur();publish();
    try {
      const from={...pose};
      await animate(180,t=>drawCard({x:from.x+(geometry.mouthX-cardSize.width/2-from.x)*t,y:from.y+(geometry.mouthY+3-from.y)*t}));
      lip.hidden=false;mechanism('slide');
      await animate(560,t=>drawCard({x:geometry.mouthX-cardSize.width/2,y:geometry.mouthY+3-(cardSize.height-5)*t},true));
      state.cardInserted=true;state.doorUnlocked=true;publish();scene.readerFeedback({unlocked:true});mechanism('unlock');
      announce('출입 인증 완료. 조사실 문 잠금이 해제되었습니다.');
      window.dispatchEvent(new CustomEvent('investigation:unlocked',{detail:window.HNJ.getIdentity()}));
      await animate(960,()=>{});
      card.hidden=true;lip.hidden=true;
      await animate(680,t=>{closeProgress=1-t;scene.authView(closeProgress);});
      state.authSceneOpen=false;root.setAttribute('aria-label','잠금이 해제된 닫힌 조사실 문 앞');root.focus({preventScroll:true});
    } finally {busy=false;publish();}
  }
  target.addEventListener('click',openAuth);
  target.addEventListener('pointerenter',()=>{if(scene&&!busy&&!state.doorUnlocked)scene.readerFeedback({hover:true});});
  target.addEventListener('pointerleave',()=>{if(scene)scene.readerFeedback({unlocked:state.doorUnlocked});});
  target.addEventListener('focus',()=>{if(scene&&!state.doorUnlocked)scene.readerFeedback({hover:true});});
  target.addEventListener('blur',()=>{if(scene)scene.readerFeedback({unlocked:state.doorUnlocked});});
  card.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCard();target.focus({preventScroll:true});}
  });
  card.addEventListener('pointerdown',e=>{
    if(busy||state.cardInserted||e.button>0)return;e.preventDefault();selectCard();
    card.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,start:{...pose}};card.classList.add('is-dragging');
  });
  card.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId||busy)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    drawCard({x:Math.max(-cardSize.width*.5,Math.min(stage.clientWidth-cardSize.width*.5,pointer.start.x+dx)),y:Math.max(0,Math.min(stage.clientHeight-25,pointer.start.y+dy))});
    if(Math.hypot(dx,dy)>10&&pose.y<home.y-14&&nearMouth()) {card.releasePointerCapture(e.pointerId);pointer=null;insertCard();}
  });
  async function release(e) {
    if(!pointer||pointer.id!==e.pointerId)return;
    const moved=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10;pointer=null;card.classList.remove('is-dragging');
    if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);
    if(moved&&pose.y<home.y-10&&nearMouth())await insertCard();else if(moved)await returnCard();
  }
  card.addEventListener('pointerup',release);
  card.addEventListener('pointercancel',()=>{if(!pointer)return;pointer=null;card.classList.remove('is-dragging');returnCard();});
  // Escape backs out safely before insertion; the issued identity is never reset.
  root.addEventListener('keydown',async e=>{
    if(e.key!=='Escape'||busy||!state.authSceneOpen||state.cardInserted)return;
    busy=true;pointer=null;card.hidden=true;selected=false;card.classList.remove('is-selected');publish();
    await animate(680,t=>{closeProgress=1-t;scene.authView(closeProgress);});state.authSceneOpen=false;busy=false;publish();target.focus();
  });
  stage.addEventListener('corridor:render',projection);
  window.addEventListener('investigation:arrived',async()=>{
    scene=await window.HNJCorridor3D.create(stage);
    if(!scene)return; // The pre-existing photo fallback remains available without a fake floating reader.
    state.arrivedAtDoor=true;target.hidden=false;projection();publish();
  });
  // STEP 04: connect a future handle action only when getState().doorUnlocked is true.
  // The existing mainDoor remains closed; this event/API carries no actual security credentials.
  window.HNJAccess=Object.freeze({getState:()=>Object.freeze({...state})});
  publish();
})();
