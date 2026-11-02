/* Original MP3 supplied by the project owner. Native audio playback avoids
   silent Web Audio routing when an AudioContext cannot output on the device. */
(() => {
  'use strict';
  const root=document.querySelector('#opening-sequence');
  const music=new Audio();
  music.preload='none'; // Set before src, so the browser does not start loading the MP3 during 3D preparation.
  music.src=new URL('assets/tunetank-jazz-spy-music-349626.mp3',document.baseURI).href;
  music.loop=false;
  const INTRO_SKIP_SECONDS=0; // Play Tunetank Jazz Spy Music from the beginning.
  let introSeeked=false;
  function skipIntro(){
    if(introSeeked||!Number.isFinite(music.duration)||music.duration<=INTRO_SKIP_SECONDS+5)return;
    try{music.currentTime=INTRO_SKIP_SECONDS;introSeeked=true;}catch(error){console.warn('Room music intro seek:',error);}
  }
  music.addEventListener('loadedmetadata',skipIntro);
  music.addEventListener('ended',()=>{
    if(!started||!enabled())return;
    music.currentTime=INTRO_SKIP_SECONDS;
    music.play().catch(error=>console.warn('Room music loop:',error));
  });
  let started=false,progress=0,door=0,playPending=false,lastError='';
  const clamp=v=>Math.min(1,Math.max(0,v));
  const enabled=()=>!!window.HNJ?.audio?.isEnabled()&&!document.hidden;
  const state=value=>{if(root)root.dataset.musicStatus=value;};
  function update(){
    // Experimental OST cue: corridor stays silent. Music fades in only as the door opens.
    // The doorway animation already eases 'door' from 0 to 1 over about 1.35 seconds.
    const desired=clamp(door*.16);
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
      skipIntro();
      state('ready');
    }
    // Triggered during the door-handle click for reliable browser audio permission.
    play();
    update();
  }
  function setCorridorProgress(value){
    progress=clamp(value);
    // Keep progress reporting for compatibility; do not start music in the corridor.
    update();
  }
  function setDoorOpen(value){door=clamp(value);update();}
  function sync(){update();if(started&&enabled()&&music.paused)play();}
  // Capture the actual unlocked door-handle click BEFORE the room's async setup.
  // This is a genuine user gesture, so browsers can start the MP3 silently.
  document.addEventListener('click',event=>{
    const handle=event.target?.closest?.('.door-handle-target');
    if(!handle||handle.hidden||handle.disabled||started)return;
    const access=window.HNJAccess?.getState?.();
    if(!access?.doorUnlocked||access.authSceneOpen)return;
    begin();
  },true);
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
