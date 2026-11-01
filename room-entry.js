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
    source.buffer=b;filter.type='lowpass';filter.frequency.value=1700;gain.gain.value=.19;
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
  function seatSound(){
    if(!window.HNJ?.audio?.isEnabled()||document.hidden)return;
    const c=window.HNJ.audio.getContext();if(!c)return;
    const bytes=Uint8Array.from(atob('gH+AgIB/f39/f39/f3+AgH+AgICAgH9/f3+AgICAgICAf4CAgH9/f39/f39/gH9/f3+AgIB/fn5/f39/gIGBgICAgYGAgIB/f39/gH9/f4CBgH+AgIB+foCBgYKDgoGBgH5+fX5/fn5+fn+AgIGCgYCAf359fX1+fn1+gICBgIGAf4CAgICAfn5+fn5+f4CBgX9+fn+AgICAgICBgICAgYGAgH99fn5/fn1/fnx7fH+Bf35/gH+Af35/gYF/f4KCgYGAgIGCgoGAf4CCgoODgoKBgH+Ag4OCg4B9gIB/gIGAgH18fX5+fn9+f4CAf398e318fH1/f36BgoGCgn9/gH9/f3+BgH+AgYKBgIB/fX5+fX+BgH6AgX9+gICBf31+fXt7fH19fX5+f4B+fX+Bg4KCgoB+foB/fn+AgYCAg4OBgYKCgYCAfnx6en2BgoKAgoOBgYB/gIKDg4OEg4KCgYGCgYGDhIWGg4OGg39+fX19fnx7fX5/fn1+fn1+fnt7e3h4enp6e3x9fn9+fn5+gH9/fn1/goB/f4CBgoB/gYB/gH5/gYGBgH5/gYGCgIGDhYWEgYKCgYGBgYB/gICAgH9/gH9+f35+f317fX+AgYB9fn98enx8e319e3x/goSEhYWFhIOBgIF/fX1+f4CAgICBgoGAgH9+fn5/gYGBgX99fX5/gICAf3+AgIGAgH+AgYGBgYCBg4KDgn9/gYB+f35+gIKAfX+CgoGBgYGAf358e3p6enl5e31+fn6AgoKDhISDg4KAgH+Af359fX16enx7e3t7fH5+f4CCgoOFhYWEgoKEhYaHiIqMjo2KiIeFgn99e3p3c25sbW1vcnBwcnR2d3d6fX5/gYKFhYSEhISEgoGCg4WGhoWGiImLjI2NjYyJh4iHg4CBhYWDgoB9fXx7e3l4eHl5dnV0dXd4en6ChoiGhoN/e3Z0dnd4dnFra3N6e3x9fYCDg4KBgYKAfX5/gIOEhIeGhoiHhoWFhoSBfnx6eHd7fn+BhYiLjI6QkJGRkZGRkpKPjo6Ni4mIioqIhYOBgoF/f4GCfHNxcHBycG9zcWxpZWJiYV1cYmtvcnRxbWpqbGpoam1vdXp9gIGChoqNkJGOi4uOk5WYnqOkpqWin5mWlY+LiYiLjY6Qko+JhoN+eHFsamtpZmVkY2NnbHBxcXR5enh3dnV5fXx9gIOBf4B/f4CEiIaEh4uJhoqPkZOTkI2MiYiLjY6JiIqJi42JiIqMi42Qj46Oj4+Ojo2JhYF8dW9qaWloZmJfXVhXV1ZWUU1NTlNYV1ljbnd9gYaKjI+RkY+OkJCTmJufpKitr6uknZSPjYmGh4mLioiMj46Oj4yEf3t0bm1ubnF2en+AfHl6d3RvbG1saWRkZ2hqb3Z4eoCFhIF8d3Z5fHx+gYGAgomIhYiLi4uNkpSSkZOXmJSQjIuPk5KMhYB8enRwb21vcnh9gISIi4mCgH56eXV0dnd0cXV6enuDh4WDgoGBfXp8eXBrbnBzeHl9goKBfnh7hoeGhYeNjouLioyOjImIiYeCfXl8gX+BhYeCfH18enx8f4B8fIB+d3R4fHl4eXV7f36BgX2Ag4OEhYeKiYWEgn5/gXx4eXyBgX9+e3x+fXx7foCAgIKEhIWDgYKFh4aBgYF6d3uBgn98fn9+fHl6e3h4eXx/fXt8fYKGhISDfn5/fHh4f4F6foeDfoF/enp9f39+gYJ/f4aLioaGhoKAgIF+fX5/gH5+fXyBhoiJiYiLjYyJi4yJhoSDfnp9gYKDg4B/f359fHp3eXt3dnh2eHhzc3Z3d3p6dXZ7fXx6fYGDg4GCg4aIhYF/fn18f4SDgICChYSCgHx8fn+Ag4OEhYOAfHV8gXl4fYCDgYKEg4SFg4B/g4R+enx6dnp/gX+AgH99enx+fH1+fH+Bf36Gj42KioeFi46AeX+BenV0d359dm1vfH5+gYN/e4GKhoGGhH56eXx9gIeQl5SRlpqXl5aSlJGFfX1+eXJvb3BxcGxlZmtoZWNiZWZobnN2eoKFh42RlJeXlZSVk4+TlpSTk5mclY6Ii4yCe3h2b2hmZmJfXl1cWVZTUVZaVFRaX2VpaXF+f36AhpGanJ+kqrbBxsjJycjDv726tbSzsbCropqRgnVuZF1bVEpGRkQ/PD07Njc8PDs/Q0hQWF1mbXN8gYSNlpecoaSqrq6urq2tsrWxrayqpqShm5qYkI6OiYaAeHFsZmNdVldcXl1bW15gYF9gYmVobXF0e4OGiIyMjpSWk5WanJqXk5GTkIuJh4aBf39/goOAfH98d3Z3eHt/gHx8fnx6eXh5enh4eHd5e3p7fXx9fnt7enyCgoGFiYqOk5KRkpCLiYeFhYB8gIKEhoSFhoiGg4F/f4B5dXRxbGptbmtsbW1yd3R0enp6fXx8gYaGg4eKiYiGi4+LiYuKiIeHhYOBgIKFhICAhYeFgoOCgYF8fIB/fH19e3h2eHl2c3h6dnZ4d3h5fH16eXh1dXV2d3h7foF/foODf4CGiIiIhoeKjpCQioOHiomOi4yKfIKFg4WLk4uFiYmEgYOEfnp5d3l6dXh6dnx/d3R2d3d3d3Z3eHh7eXZ5enh2dnZ1dXh6enx/goSKkI6Pk5GNi42MioqKh4WHg4CCgH5+fYCDgYCBg4J+gISAgH96eXhycHFwcXJ2e3l6f318gH56enZ1fXtzdHh4eXl5fX5/gYOFiImKjI2Oj5CSk5GSkImHhoF9fX59fXt4d3d6enh4enx7fX19fn+FiISGg3x9gn55fHx5eXh3eXp3eXp9gH5/goaIhICFiIuPkJCNjYqHh4WFhYF9f354en98eXx9eXh3dnV1d3Z0dHh6eXx8e31/f4CCf3yAgn98fICEgYGFhYOHi4uNjY6Mi42LhoSCg4SBf3p3eXt4dHh6dnZ5e31+d3R4d3Z1cXF2eHd4foSHh4eFh4uHg4F/goiFgH19fn+AfoCEhoiJjI6JiI2Qi4SBhISAfXp8fnx6e3l4eHd2dXl6dXBwd3d4f399fn9+f4B+foKCg4SEg4KGiYiIhomMjYuGiI+QkI6HhoiEgHt7fHp0cXJzb2xscHFvb3BydnV1eXt7fICBgICAfoB/foKFh4eGiIuKiYiJi4uLiIWFhIKDhIWGh4eFhYSGg4CCgH9/e3t/f39/f398eHd4d3R0eXx4d3yAh4uLi4mFg4KAfXh1d3RwdXNudHp4dXV4fH99f4SHiouHh4mKiISBhYaDg4KBg4WGhoWFgX56enp5fX18f4KBgICAf315e3p4fIGBfoCDf3t8fn16eHp5eXt3e4KAfX+AgoWFhISGiYyOjImJhoSFgX+FhYF+fHx+f39+f4GBfoCCg4WDgHt5fnt2dnZ4enl3eHp6fX5/gIOEg4KAf4CCg4SDg4OCgoOFhYOCf4CBgYODgYKBgH19fXt6fHt6f315fYCBhoiGgH+Cfnx9eXZ1dXh7e3t8enyAf36Bg4ODhIeHhoeHhoWGioaCg359gX94dXt9eXt/foCDgoGBgoKAgoJ9eHh5eXyBhIaFg4aJiIaEgYKBenh8eXZ2dHZ4dnd6fYGCgYCEhIKAgYWHiISCgoGDgX+Dh4aDg4SEgn5+f3t5e3x7fH9/fX5/gYKBgYB/goSDgYGBgIGAgIF7eXx7enyAg4WBfoB/fX5+f4F/f4KAgYF/gYJ/fH17eX2AgIWEgIB+fHt7fXx6e3x9fXt+f3+DhIF/f318f39/hYR+goeGh4aDgIGCf39/gIJ/gIKBgYOAf4GDgX1/f3x7eXl9f319gH+Ag4KBgYB9f4B9f4OGgnx8f4KBfHp+gHx9fnp7fn+Cgn6CgoCDg3+BhIB/f4CCgX5+gH99enp9fH+Cf3+CgoKDg4KFg36BgX19gYF8e3+Afn+BfXt7fH99enx/f3x9gYF/goWEgYKEgH5/fX6Ag4J7fYaIhYB9fX+Cf3t8gYJ/foOHh4WDg4aCfHp7e3x7eXp/gX59f4OCfHt7e3x+gHt4ent+f3p8fX2DhYCBhYiJg4GHh4OCgX+BgYGFg4OEhoaCgoF9fICAgoN7eH1+fICCfXx+eHR7f3p5eHZ4eXl6fYCBgYKDg4OFg4WEgYKAfoCEhoGCg36BhoOAgIF/g4OBgoKDfX2AfoCAfXyAhH96fYOBfn15fH99eHV3en16dn+Ef3+Dg3+CgX2BhIGAgoOEhIeJhYKFhH9+f31+gX99goeEgH+ChoB9fXp7fn12d358fICAgIB7fH96foOAf36Bf3yAgH5+gYKChoaGi4qDgoOCgH18fnl0dHZ9fX2CgoF+e4KCfoN+fIGBhYR/fXx+f319f39+gH97foR9fYCAgn16fn16gIN/goSCgoSEiIuFgoJ/gIOCg4SEhYF/f4B/f398fn16fHt5e315eX16eHyAgX6BhIF9en5+fYJ6eYF/fH5/goWDg4WDh4V/e31/foSEfoWIgoKCf36Eg36BgH2Cgnp5fXx9fHt+f4GCgYOAgISBgIaEfX6Afnx8fnp4enx5eX19e36BgICAgYWBfH+Afn9/gIKDgoOBgYWGg4OGhoWCfoGDgoB+fn58fYN+eX56dn5/eH2AfoGAfoCAgH+AgYF9e36Ag4SEg4CCgX58e357dXh/gX6AhISGjImCgX59fXt9f4B/foKDfnt9gYB/gX5/gH6DgHt/f3yAgX+BgYKCgoB9f4CEg36AgoKFhoSCgYCAf31+f317gISAfn99fX17fX9+fX+AfHp8fHt+fn+BgH99fn18gX97fnx5fYB+f4B+foGHh4SFhYOEg4CChIKAfn9/fHyAgYF/gYSCfoCDgX+Bf3yBgoB/foGAe32AfX6BgH2AfnyBgn9/foCBfn6Afn1+foCCf36BgYCAgIF/f4B/f4GBf39/gIB+f4B+fn+AgH9/gICAgX9/f3+BgH+AgYB/f4B/f39/f39/f39+f4CAf4CBgH9/f39/f39/f3+Af3+AgICAgICAf4CAf39/f4CAf39/f4CAgA=='),ch=>ch.charCodeAt(0));
    const buffer=c.createBuffer(1,bytes.length,8000),data=buffer.getChannelData(0);
    for(let i=0;i<bytes.length;i++)data[i]=(bytes[i]-128)/128;
    const source=c.createBufferSource(),gain=c.createGain();
    source.buffer=buffer;gain.gain.value=.75;
    source.connect(gain).connect(c.destination);
    const mute=()=>{if(!window.HNJ.audio.isEnabled())gain.gain.setTargetAtTime(0,c.currentTime,.008);};
    document.querySelector('#sound-button')?.addEventListener('click',mute);
    source.addEventListener('ended',()=>{source.disconnect();gain.disconnect();document.querySelector('#sound-button')?.removeEventListener('click',mute);},{once:true});
    source.start();
  }
  function worldPose(name){const v=room.getViewPose(name);return {position:[v.position[0],v.position[1],v.position[2]-3.4],target:[v.target[0],v.target[1],v.target[2]-3.4],fov:v.fov};}
  function interpolate(a,b,t){return {position:a.position.map((v,i)=>v+(b.position[i]-v)*t),target:a.target.map((v,i)=>v+(b.target[i]-v)*t),fov:a.fov+(b.fov-a.fov)*t};}
  async function look(down){
    if(!entered||viewBusy||lookingDown===down)return;viewBusy=true;gaze.disabled=true;
    const from=worldPose(lookingDown?'tabletop':'seated'),to=worldPose(down?'tabletop':'seated');
    await animate(1050,t=>corridor.roomPose(interpolate(from,to,t)));
    lookingDown=down;root.dataset.roomView=down?'tabletop':'seated';gaze.textContent=down?'정면 보기 ↑':'사건 파일 ↓';
    gaze.setAttribute('aria-label',down?'맞은편 용의자석 바라보기':'책상 위 사건 파일 내려다보기');gaze.disabled=false;viewBusy=false;
  }
  gaze.addEventListener('click',()=>look(!lookingDown));
  window.addEventListener('keydown',event=>{if(!entered||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();look(event.key==='ArrowDown');}});
  target.addEventListener('click',async()=>{
    if(busy||entered||!window.HNJAccess.getState().doorUnlocked||window.HNJAccess.getState().authSceneOpen)return;
    busy=true;target.disabled=true;
    try {
      const next=await prepare();if(!next){preparation=null;throw new Error('Room preparation failed');}
      await corridor.attachRoom(next.getScene());root.dataset.state='door-opening';target.hidden=true;doorSound();
      await animate(1350,t=>{corridor.openDoor(t);window.HNJRoomMusic?.setDoorOpen(t);});root.dataset.state='room-entering';
      let step=0;await animate(2600,t=>{corridor.enterRoom(t);if(step<3&&t>=[.13,.43,.72][step])window.dispatchEvent(new CustomEvent('investigation:room-step',{detail:{index:step++}}));});
      root.dataset.state='room-seating';
      const approach={position:[0,1.70,-.30],target:[0,1.10,-3.95],fov:48},seated=worldPose('seated');
      let seatPlayed=false;
      await animate(2200,t=>{const pose=interpolate(approach,seated,t);pose.position[0]=Math.sin(t*Math.PI)*.30;const lower=Math.max(0,(t-.42)/.58);pose.position[1]=1.70-(1.70-seated.position[1])*lower*lower*(3-2*lower);corridor.roomPose(pose);if(!seatPlayed&&t>=.82){seatPlayed=true;seatSound();}});
      entered=true;root.dataset.state='room';root.dataset.roomView='seated';gaze.hidden=false;root.setAttribute('aria-label','조사실 내부');corridor.getRenderer().domElement.setAttribute('aria-label','목재 벽과 기록 보드, 따뜻한 조명의 조사실');
      document.querySelector('#reader-target').hidden=true;
      window.dispatchEvent(new CustomEvent('investigation:room-entered',{detail:window.HNJ.getIdentity()}));
    } catch(error){target.hidden=false;target.disabled=false;console.warn('Room entry:',error.message);}
    finally{busy=false;}
  });
})();
