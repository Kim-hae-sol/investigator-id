/* Original, quiet room music. No external recordings or copyrighted songs. */
(() => {
  'use strict';
  let context=null,output=null,filter=null,timer=null,next=0,step=0,started=false,openness=0;
  // Warm major-seventh lounge colors (Cmaj7, Am7, Dm7, G7), no dark sustained drone.
  const chords=[[261.63,329.63,392,493.88],[220,261.63,329.63,392],[293.66,349.23,440,523.25],[196,246.94,293.66,349.23]];
  function enabled(){return !!window.HNJ?.audio?.isEnabled()&&!document.hidden;}
  function note(freq,when,length,volume){
    const osc=context.createOscillator(),harm=context.createOscillator(),env=context.createGain(),hGain=context.createGain();
    osc.type='sine';harm.type='sine';osc.frequency.value=freq;harm.frequency.value=freq*2;
    hGain.gain.value=.045;
    env.gain.setValueAtTime(.0001,when);
    env.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.035);
    env.gain.exponentialRampToValueAtTime(.0001,when+length);
    osc.connect(env);harm.connect(hGain).connect(env);env.connect(filter);
    osc.start(when);harm.start(when);osc.stop(when+length+.05);harm.stop(when+length+.05);
    osc.onended=()=>{osc.disconnect();harm.disconnect();hGain.disconnect();env.disconnect();};
  }
  function schedule(){
    if(!started||!context||!enabled())return;
    while(next<context.currentTime+.25){
      const chord=chords[Math.floor(step/4)%chords.length];
      const n=step%4;
      if(n===0){
        // Gentle chord stabs rather than a low sustained minor drone.
        chord.forEach((f,i)=>note(f,next+i*.025,1.05,.012));
      } else if(n===2)note(chord[2]*2,next,.43,.010);
      else note(chord[n===1?1:3],next,.55,.009);
      next+=.66;step++;
    }
  }
  function ensure(){
    if(started||!enabled())return;
    context=window.HNJ.audio.getContext();
    if(!context)return;
    output=context.createGain();filter=context.createBiquadFilter();
    filter.type='lowpass';filter.Q.value=.35;
    filter.connect(output).connect(context.destination);
    output.gain.value=0;
    started=true;next=context.currentTime+.1;
    setDoorOpen(openness);
    timer=setInterval(schedule,100);schedule();
  }
  function setDoorOpen(amount){
    openness=Math.min(1,Math.max(0,amount));
    if(!started||!context)return;
    const now=context.currentTime;
    filter.frequency.setTargetAtTime(520+openness*3200,now,.17);
    output.gain.setTargetAtTime(enabled()?(.28+openness*.72):0,now,.25);
  }
  function update(){
    if(!started){ensure();return;}
    output.gain.setTargetAtTime(enabled()?(.28+openness*.72):0,context.currentTime,.06);
    if(enabled())schedule();
  }
  window.addEventListener('investigation:arrived',ensure);
  document.querySelector('#sound-button')?.addEventListener('click',()=>queueMicrotask(update));
  document.addEventListener('visibilitychange',update);
  window.HNJRoomMusic=Object.freeze({setDoorOpen});
})();
