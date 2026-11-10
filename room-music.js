/* Playback is deliberate; use the existing owner-supplied track only. */
(()=>{
  'use strict';
  const music=new Audio(new URL('assets/tunetank-jazz-spy-music-349626.mp3',document.baseURI));
  music.preload='none';
  music.loop=true;
  music.volume=.16;
  let requested=false, playing=false, attempt=0;

  function emit(){
    window.dispatchEvent(new CustomEvent('investigation:music-state',{
      detail:{playing,muted:music.muted}
    }));
  }
  function setPlaying(value){
    if(playing===value)return;
    playing=value;
    emit();
  }
  function sync(){
    music.muted=!window.HNJ.audio.isEnabled();
    const id=++attempt;
    if(document.hidden||!requested){
      music.pause();
      setPlaying(false);
    }else{
      music.play().catch(()=>{
        if(id!==attempt)return;
        requested=false;
        setPlaying(false);
      });
    }
    emit();
  }
  music.addEventListener('playing',()=>setPlaying(requested&&!document.hidden&&!music.paused));
  for(const event of ['waiting','pause','ended','error']){
    music.addEventListener(event,()=>setPlaying(false));
  }
  window.HNJRoomMusic=Object.freeze({
    setDoorOpen(){},
    setCorridorProgress(){},
    toggle(){requested=!requested;sync();},
    status:()=>({playing,paused:music.paused})
  });
  document.querySelector('#sound-button').addEventListener('click',()=>queueMicrotask(sync));
  document.addEventListener('visibilitychange',sync);
})();
