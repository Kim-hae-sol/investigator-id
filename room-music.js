/* Original MP3 supplied by the project owner. Native audio playback avoids
   silent Web Audio routing when an AudioContext cannot output on the device. */
(() => {
  'use strict';
  const root=document.querySelector('#opening-sequence');
  const music=new Audio();
  music.src=new URL('assets/lexin_music-quirky-romantic-spy-121840%20(1).mp3',document.baseURI).href;
  music.preload='auto';
  music.loop=true;
  let started=false,progress=0,door=0,playPending=false,lastError='';
  const clamp=v=>Math.min(1,Math.max(0,v));
  const enabled=()=>!!window.HNJ?.audio?.isEnabled()&&!document.hidden;
  const state=value=>{if(root)root.dataset.musicStatus=value;};
  function update(){
    const distance=clamp((progress-.43)/.57);
    // Already playing (silently) from the entry click: emerge mid-corridor.
    const corridorVolume=distance*(.045+.095*distance);
    const desired=clamp(corridorVolume*(1-door)+door*.48);
    music.volume=enabled()?desired:0;
    music.muted=!enabled();
    if(started&&!music.paused&&root)root.dataset.musicVolume=music.volume.toFixed(3);
  }
  function play(){
    if(!started||!enabled()||playPending||!music.paused)return;
    try{
      playPending=true;
      state('starting');
      const promise=music.play();
      if(promise&&typeof promise.then==='function'){
        promise.then(()=>{playPending=false;lastError='';state('playing');update();},
          error=>{playPending=false;lastError=error?.name||'play-failed';state('blocked-'+lastError);console.warn('Room music:',error);});
      }else{playPending=false;state('playing');update();}
    }catch(error){playPending=false;lastError=error?.name||'play-failed';state('error-'+lastError);console.warn('Room music:',error);}
  }
  function begin(){
    if(!started){
      started=true;
      music.volume=0;
      music.muted=false;
      state('ready');
    }
    // Invoked synchronously by the existing investigation-entry button.
    play();
    update();
  }
  function setCorridorProgress(value){
    progress=clamp(value);
    if(progress>.43&&!started)begin();
    update();
  }
  function setDoorOpen(value){door=clamp(value);update();}
  function sync(){update();if(started&&enabled()&&music.paused)play();}
  window.addEventListener('investigation:enter',begin);
  window.addEventListener('investigation:corridor-progress',event=>setCorridorProgress(event.detail.progress));
  window.addEventListener('investigation:arrived',()=>setCorridorProgress(1));
  document.querySelector('#sound-button')?.addEventListener('click',()=>queueMicrotask(sync));
  document.addEventListener('visibilitychange',sync);
  music.addEventListener('error',()=>{lastError='media-'+(music.error?.code||'unknown');state(lastError);console.warn('Room music load failed:',music.src,music.error);});
  music.addEventListener('playing',()=>{state('playing');update();});
  music.addEventListener('pause',()=>{if(started)state('paused');});
  // Retry only following another deliberate user interaction if autoplay was blocked.
  document.addEventListener('pointerdown',()=>{if(started&&enabled()&&music.paused&&!playPending)play();},{passive:true});
  window.HNJRoomMusic=Object.freeze({setDoorOpen,setCorridorProgress,status:()=>({started,paused:music.paused,volume:music.volume,src:music.src,error:lastError})});
})();
