/* Original Lexin_Music recording provided by the site owner.
   The MP3 must be uploaded to assets/lexin_music-quirky-romantic-spy-121840%20(1).mp3. */
(() => {
  'use strict';
  const music=new Audio('assets/lexin_music-quirky-romantic-spy-121840%20(1).mp3');
  music.loop=true;music.preload='none';
  let ctx,source,filter,gain,progress=0,door=0,started=false,failed=false;
  const enabled=()=>!!window.HNJ?.audio?.isEnabled()&&!document.hidden;
  function prepare(){
    if(failed||started||!enabled())return;
    try {
      ctx=window.HNJ.audio.getContext();
      if(!ctx)return;
      source=ctx.createMediaElementSource(music);
      filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.5;
      gain=ctx.createGain();gain.gain.value=0;
      source.connect(filter).connect(gain).connect(ctx.destination);
      started=true;
      music.play().catch(error=>console.warn('Room music playback:',error.name,error.message));
      mix();
    }catch(error){failed=true;console.warn('Room music setup:',error.message);}
  }
  function mix(){
    if(!started)return;
    const distance=Math.max(0,Math.min(1,(progress-.43)/.57));
    const t=ctx.currentTime;
    const audible=enabled();
    // Distant, low-passed music begins halfway down the corridor.
    filter.frequency.setTargetAtTime(220+distance*160+door*6200,t,.12);
    gain.gain.setTargetAtTime(audible?(distance*(.16+.09*distance)*(1-door)+door*.72):0,t,.18);
    if(audible&&music.paused)music.play().catch(()=>{});
  }
  function setCorridorProgress(p){progress=Math.max(0,Math.min(1,p));if(progress>.40)prepare();mix();}
  function setDoorOpen(v){door=Math.max(0,Math.min(1,v));prepare();mix();}
  function sync(){if(enabled())prepare();mix();}
  // Called synchronously from the visitor's 'enter room' click. Starting silent playback
  // here avoids browser autoplay blocking when the walk animation later begins.
  window.addEventListener('investigation:enter',()=>{prepare();});
  window.addEventListener('investigation:corridor-progress',e=>setCorridorProgress(e.detail.progress));
  window.addEventListener('investigation:arrived',()=>setCorridorProgress(1));
  document.querySelector('#sound-button')?.addEventListener('click',()=>queueMicrotask(sync));
  document.addEventListener('visibilitychange',sync);
  music.addEventListener('error',()=>console.warn('Room music MP3 not yet available at',music.src));
  window.HNJRoomMusic=Object.freeze({setCorridorProgress,setDoorOpen});
})();
