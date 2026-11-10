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
  const foley = {
    tape: {duration:.16, gain:.24, cutoff:1800, hits:[[0,1,520],[.05,.45,280]]},
    play: {duration:.13, gain:.25, cutoff:2200, hits:[[0,1,720],[.027,.38,410]]},
    door: {duration:.48, gain:.27, cutoff:770, hits:[[0,.9,155],[.12,.55,109],[.22,.35,145]]},
    seat: {duration:.26, gain:.26, cutoff:460, hits:[[0,.48,128],[.014,1,86]]}
  };
  window.HNJRoomFoley = name => {
    const cue=foley[name];
    const audio=window.HNJ.audio.getContext();
    if(!audio)return;
    const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*cue.duration),audio.sampleRate);
    const samples=buffer.getChannelData(0);
    let noise=0;
    for(let i=0;i<samples.length;i++){
      const time=i/audio.sampleRate;
      noise=.68*noise+.32*(Math.random()*2-1);
      let sample=0;
      for(const [offset,level,frequency] of cue.hits){
        const t=time-offset;
        if(t<0)continue;
        const envelope=Math.min(1,t/.003)*Math.exp(-t*(name==='door'?19:44));
        sample+=level*envelope*(.7*noise+.3*Math.sin(2*Math.PI*frequency*t));
      }
      samples[i]=sample*Math.min(1,(samples.length-i)/(audio.sampleRate*.02));
    }
    const player=audio.createBufferSource();
    const filter=audio.createBiquadFilter();
    const level=audio.createGain();
    filter.type='lowpass';
    filter.frequency.value=cue.cutoff;
    level.gain.value=cue.gain;
    player.buffer=buffer;
    player.connect(filter).connect(level).connect(audio.destination);
    const mute=()=>queueMicrotask(()=>{
      if(!window.HNJ.audio.isEnabled())level.gain.setTargetAtTime(0,audio.currentTime,.008);
    });
    button.addEventListener('click',mute);
    player.onended=()=>{
      button.removeEventListener('click',mute);
      player.disconnect();filter.disconnect();level.disconnect();
    };
    player.start();
  };
  window.addEventListener('investigation:room-entered',()=>{entered=true;sync();});
  button?.addEventListener('click',()=>queueMicrotask(sync));
  document.addEventListener('visibilitychange',sync);
})();
