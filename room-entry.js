/* A single-renderer doorway connection. Authentication stays owned by access.js. */
(() => {
  'use strict';
  const stage=document.querySelector('#opening-stage'),root=document.querySelector('#opening-sequence');
  const target=document.createElement('button');target.type='button';target.className='door-handle-target';target.hidden=true;
  target.setAttribute('aria-label','조사실 문 열고 들어가기');document.querySelector('#door-interaction-layer').append(target);
  let corridor=null,room=null,preparation=null,busy=false,entered=false;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function position(){if(!corridor||entered)return;const p=corridor.handleProjection();target.style.left=p.x+'px';target.style.top=p.y+'px';}
  stage.addEventListener('corridor:render',position);
  function animate(ms,draw){if(reduce.matches){draw(1);return Promise.resolve();}return new Promise(resolve=>{let elapsed=0,last=null;function frame(now){if(document.hidden){last=null;requestAnimationFrame(frame);return;}if(last!==null)elapsed+=Math.min(64,now-last);last=now;const t=Math.min(1,elapsed/ms);draw(t*t*(3-2*t));if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});}
  async function prepare(){
    if(preparation)return preparation;
    preparation=(async()=>{corridor=await window.HNJCorridor3D.create(stage);if(!corridor)return null;
      room=await window.HNJInterrogationRoom.create(stage,{renderer:corridor.getRenderer()});return room;})();
    return preparation;
  }
  // The unlock event arrives before the original close-up has finished returning.
  window.addEventListener('investigation:unlocked',async()=>{
    await prepare();
    function ready(){if(window.HNJAccess.getState().authSceneOpen){requestAnimationFrame(ready);return;}position();target.hidden=false;}
    ready();
  });
  function doorSound(){
    if(!window.HNJ.audio.isEnabled())return;
    const c=window.HNJ.audio.getContext();if(!c)return;
    const gain=c.createGain(),filter=c.createBiquadFilter(),source=c.createBufferSource();
    const b=c.createBuffer(1,c.sampleRate*.75,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++){const t=i/c.sampleRate;d[i]=(Math.random()*2-1)*(.5*Math.exp(-t*40)+.08*Math.sin(t*28)**2*Math.exp(-t*3));}
    source.buffer=b;filter.type='lowpass';filter.frequency.value=1700;gain.gain.value=.19;
    source.connect(filter).connect(gain).connect(c.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();document.querySelector('#sound-button').removeEventListener('click',mute);};
    const mute=()=>{if(!window.HNJ.audio.isEnabled())gain.gain.setTargetAtTime(0,c.currentTime,.01);};
    document.querySelector('#sound-button').addEventListener('click',mute);
  }
  target.addEventListener('click',async()=>{
    if(busy||entered||!window.HNJAccess.getState().doorUnlocked||window.HNJAccess.getState().authSceneOpen)return;
    busy=true;target.disabled=true;
    try {
      const next=await prepare();if(!next){preparation=null;throw new Error('Room preparation failed');}
      corridor.attachRoom(next.getScene());root.dataset.state='door-opening';target.hidden=true;doorSound();
      await animate(1350,t=>corridor.openDoor(t));root.dataset.state='room-entering';
      let step=0;await animate(2600,t=>{corridor.enterRoom(t);if(step<3&&t>=[.13,.43,.72][step])window.dispatchEvent(new CustomEvent('investigation:room-step',{detail:{index:step++}}));});entered=true;root.dataset.state='room';root.setAttribute('aria-label','조사실 내부');corridor.getRenderer().domElement.setAttribute('aria-label','목재 벽과 기록 보드, 따뜻한 조명의 조사실');
      document.querySelector('#reader-target').hidden=true;
      window.dispatchEvent(new CustomEvent('investigation:room-entered',{detail:window.HNJ.getIdentity()}));
    } catch(error){target.hidden=false;target.disabled=false;console.warn('Room entry:',error.message);}
    finally{busy=false;}
  });
})();
