/* Quiet police-station corridor room tone.
   Intentionally no chatter, random footsteps, music, or tonal mechanical hum.
   The intimate interrogation room becomes quieter once the visitor is seated. */
(() => {
  'use strict';
  let context=null,source=null,highpass=null,lowpass=null,gain=null;
  let corridorStarted=false,roomEntered=false,prepared=false,volume=0;
  const soundButton=document.querySelector('#sound-button');
  const enabled=()=>!!window.HNJ?.audio?.isEnabled()&&!document.hidden;
  function makeLoop(ctx){
    // Broad, soft air-noise texture. Gentle taper at buffer edges prevents an audible click.
    const seconds=4,buffer=ctx.createBuffer(1,Math.round(ctx.sampleRate*seconds),ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    let smooth=0;
    for(let i=0;i<samples.length;i++){
      const white=Math.random()*2-1;
      smooth=smooth*.78+white*.22;
      const edge=Math.min(1,i/1500,(samples.length-1-i)/1500);
      samples[i]=smooth*Math.max(0,edge);
    }
    return buffer;
  }
  function prepare(){
    if(prepared||!enabled())return;
    const ctx=window.HNJ?.audio?.getContext();
    if(!ctx)return;
    try{
      context=ctx;
      source=ctx.createBufferSource();
      source.buffer=makeLoop(ctx);
      source.loop=true;
      highpass=ctx.createBiquadFilter();
      highpass.type='highpass';highpass.frequency.value=135;highpass.Q.value=.55;
      lowpass=ctx.createBiquadFilter();
      lowpass.type='lowpass';lowpass.frequency.value=950;lowpass.Q.value=.45;
      gain=ctx.createGain();gain.gain.value=0;
      source.connect(highpass).connect(lowpass).connect(gain).connect(ctx.destination);
      source.start();
      prepared=true;
    }catch(error){console.warn('Corridor ambience unavailable:',error);try{source?.disconnect();}catch{}}
  }
  function mix(){
    if(!prepared)return;
    // Silent on the ID card; very faint in the corridor; quieter in the interrogation room.
    volume=enabled()?(roomEntered?.0035:corridorStarted?.014:0):0;
    gain.gain.setTargetAtTime(volume,context.currentTime,.40);
  }
  // Preparing under a user gesture avoids browsers blocking audio after the cinematic wait.
  window.addEventListener('investigation:enter',()=>{prepare();mix();});
  window.addEventListener('investigation:corridor-progress',()=>{
    if(!corridorStarted){corridorStarted=true;prepare();mix();}
  });
  window.addEventListener('investigation:arrived',()=>{corridorStarted=true;prepare();mix();});
  window.addEventListener('investigation:room-entered',()=>{roomEntered=true;mix();});
  soundButton?.addEventListener('click',()=>queueMicrotask(()=>{if(enabled())prepare();mix();}));
  document.addEventListener('visibilitychange',mix);
  window.HNJCorridorAmbience=Object.freeze({isReady:()=>prepared});
})();
