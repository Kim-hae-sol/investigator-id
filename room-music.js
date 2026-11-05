/* Playback is deliberate; use the existing owner-supplied track only. */
(()=>{'use strict';const music=new Audio(new URL('assets/tunetank-jazz-spy-music-349626.mp3',document.baseURI));music.preload='none';music.loop=true;music.volume=.16;let requested=false;
function sync(){music.muted=!window.HNJ.audio.isEnabled();if(document.hidden||!requested)music.pause();else music.play().catch(()=>{requested=false;emit();});emit();}
function emit(){window.dispatchEvent(new CustomEvent('investigation:music-state',{detail:{playing:requested,muted:!window.HNJ.audio.isEnabled()}}));}
window.HNJRoomMusic=Object.freeze({setDoorOpen(){},setCorridorProgress(){},toggle(){requested=!requested;sync();},status:()=>({playing:requested,paused:music.paused})});
document.querySelector('#sound-button').addEventListener('click',()=>queueMicrotask(sync));document.addEventListener('visibilitychange',sync);
})();
