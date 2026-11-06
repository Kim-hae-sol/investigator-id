/* A single-renderer doorway connection. Authentication stays owned by access.js. */
(() => {
  'use strict';
  const stage=document.querySelector('#opening-stage'),root=document.querySelector('#opening-sequence');
  const target=document.createElement('button');target.type='button';target.className='door-handle-target';target.hidden=true;
  target.setAttribute('aria-label','조사실 문 열고 들어가기');document.querySelector('#door-interaction-layer').append(target);
  let corridor=null,room=null,preparation=null,busy=false,entered=false;
  let lookingDown=false,viewBusy=false;
  const gaze=document.createElement('button');gaze.type='button';gaze.className='room-gaze';gaze.hidden=true;gaze.textContent='사건 파일 ↓';
  gaze.setAttribute('aria-label','책상 위 사건 파일 내려다보기');root.append(gaze);
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
    source.buffer=b;filter.type='lowpass';filter.frequency.value=1200;gain.gain.value=.095;
    source.connect(filter).connect(gain).connect(c.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();document.querySelector('#sound-button').removeEventListener('click',mute);};
    const mute=()=>{if(!window.HNJ.audio.isEnabled())gain.gain.setTargetAtTime(0,c.currentTime,.01);};
    document.querySelector('#sound-button').addEventListener('click',mute);
  }
  // Subtle chair contact: a short wooden creak and cushioned seat impact.
  // Synthesized locally so the site does not need an extra audio download.
  // A quiet, non-tonal fabric/cushion impact when the investigator sits.
  // Soft upholstered chair landing: filtered fabric rustle, no impact or pitch sweep.
  // Real soft-chair landing, cropped from the user-supplied recording (1.84s–2.31s).
  // Encoded as a tiny 8 kHz unsigned PCM sample to keep this change self-contained.
  // Chair sound temporarily disabled: recorded candidates produced audible scraping.
  // Keep the seating camera animation intact; restore only after approving an unedited clip.
  function seatSound(){ /* No sound intentionally. */ }
  function worldPose(name){const v=room.getViewPose(name);return {position:[v.position[0],v.position[1],v.position[2]-3.4],target:[v.target[0],v.target[1],v.target[2]-3.4],fov:v.fov};}
  function interpolate(a,b,t){return {position:a.position.map((v,i)=>v+(b.position[i]-v)*t),target:a.target.map((v,i)=>v+(b.target[i]-v)*t),fov:a.fov+(b.fov-a.fov)*t};}
  async function look(down){
    if(!entered||viewBusy||lookingDown===down)return;viewBusy=true;gaze.disabled=true;
    const from=worldPose(lookingDown?'tabletop':'seated'),to=worldPose(down?'tabletop':'seated');
    await animate(1050,t=>corridor.roomPose(interpolate(from,to,t)));
    lookingDown=down;root.dataset.roomView=down?'tabletop':'seated';gaze.textContent=down?'정면 보기 ↑':'사건 파일 ↓';
    gaze.setAttribute('aria-label',down?'맞은편 용의자석 바라보기':'책상 위 사건 파일 내려다보기');gaze.disabled=false;viewBusy=false;
  }
  window.HNJDeskCamera={project:point=>corridor?.projectWorld(point),refresh:()=>{corridor.getRenderer().shadowMap.needsUpdate=true;corridor.roomPose(worldPose('tabletop'));},refreshReading:()=>corridor?.roomPose(worldPose('reading')),move:async(open)=>{const base=worldPose('tabletop'),close=worldPose('reading');await animate(650,t=>{const hinge=room.getDeskItems().coverHinge;if(hinge)hinge.rotation.z=Math.PI*(open?t:1-t);corridor.getRenderer().shadowMap.needsUpdate=true;corridor.roomPose(interpolate(open?base:close,open?close:base,t));});},room:()=>room};
  gaze.addEventListener('click',()=>look(!lookingDown));
  window.addEventListener('keydown',event=>{if(window.HNJCaseFile||!entered||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();look(event.key==='ArrowDown');}});
  target.addEventListener('click',async()=>{
    if(busy||entered||!window.HNJAccess.getState().doorUnlocked||window.HNJAccess.getState().authSceneOpen)return;
    busy=true;target.disabled=true;
    try {
      const next=await prepare();if(!next){preparation=null;throw new Error('Room preparation failed');}
      await corridor.attachRoom(next.getScene());root.dataset.state='door-opening';target.hidden=true;doorSound();
      await animate(1350,t=>{corridor.openDoor(t);window.HNJRoomMusic?.setDoorOpen(t);});root.dataset.state='room-entering';
      let step=0;await animate(2600,t=>{corridor.enterRoom(t);if(step<3&&t>=[.13,.43,.72][step])window.dispatchEvent(new CustomEvent('investigation:room-step',{detail:{index:step++}}));});
      root.dataset.state='room-seating';
      const approach={position:[0,1.70,-.30],target:[0,1.10,-3.95],fov:48},seated=worldPose('tabletop');
      let seatPlayed=false;
      await animate(2200,t=>{const pose=interpolate(approach,seated,t);pose.position[0]=Math.sin(t*Math.PI)*.12;const lower=Math.max(0,(t-.42)/.58);pose.position[1]=1.70-(1.70-seated.position[1])*lower*lower*(3-2*lower);corridor.roomPose(pose);if(!seatPlayed&&t>=.82){seatPlayed=true;seatSound();}});
      entered=true;lookingDown=true;root.dataset.state='room';root.dataset.roomView='tabletop';gaze.textContent='정면 보기 ↑';gaze.setAttribute('aria-label','맞은편 용의자석 바라보기');gaze.hidden=true;root.setAttribute('aria-label','조사실 내부');corridor.getRenderer().domElement.setAttribute('aria-label','목재 벽과 기록 보드, 따뜻한 조명의 조사실');
      document.querySelector('#reader-target').hidden=true;
      window.dispatchEvent(new CustomEvent('investigation:room-entered',{detail:window.HNJ.getIdentity()}));
    } catch(error){target.hidden=false;target.disabled=false;console.warn('Room entry:',error.message);}
    finally{busy=false;}
  });
})();
