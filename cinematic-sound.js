/* Non-tonal, almost inaudible room air. No fake voice or horror cues.
   The owner-supplied spy music and recorded heel Foley keep their own routing. */
(() => {
  'use strict';
  const button=document.querySelector('#sound-button');
  let entered=false,source=null,gain=null,context=null;
  const enabled=()=>entered&&!document.hidden&&window.HNJ?.audio?.isEnabled();
  function sync(){
    if(enabled()&&!source){
      context=window.HNJ.audio.getContext();if(!context)return;
      const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
      let seed=113,smoothed=0;
      for(let i=0;i<data.length;i++){
        seed=(seed*1664525+1013904223)>>>0;smoothed=smoothed*.84+(seed/2147483648-1)*.16;
        data[i]=smoothed*Math.min(1,i/1200,(data.length-1-i)/1200);
      }
      source=context.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=580;filter.Q.value=.5;
      gain=context.createGain();gain.gain.value=0;source.connect(filter).connect(gain).connect(context.destination);source.start();
    }
    if(gain)gain.gain.setTargetAtTime(enabled()?.002:0,context.currentTime,enabled()?.5:.015);
    document.querySelector('#opening-sequence').dataset.roomAir=enabled()?'enabled':'muted';
  }
  window.addEventListener('investigation:room-entered',()=>{entered=true;sync();});
  button?.addEventListener('click',()=>queueMicrotask(sync));
  document.addEventListener('visibilitychange',sync);
})();
