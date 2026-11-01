/* Original, quiet room music. No external recordings or copyrighted songs. */
(() => {
  'use strict';
  let context=null,output=null,filter=null,timer=null,next=0,step=0,started=false,openness=0,walkProgress=0;
  // An original, relaxed café-style electric-piano motif, not a sustained ambient drone.
  // Frequencies describe a light pentatonic melody over cheerful seventh chords.
  const chords=[
    [261.63,329.63,392.00,493.88], // Cmaj7
    [220.00,261.63,329.63,392.00], // Am7
    [293.66,349.23,440.00,523.25], // Dm7
    [196.00,246.94,293.66,349.23] // G7
  ];
  const melody=[392,440,523.25,440,392,329.63,349.23,392,440,392,329.63,293.66,329.63,392,349.23,329.63];
  function key(freq,when,length,volume){
    const fundamental=context.createOscillator(),overtone=context.createOscillator(),gain=context.createGain(),t=context.currentTime;
    fundamental.type='triangle';overtone.type='sine';
    fundamental.frequency.setValueAtTime(freq,when);overtone.frequency.setValueAtTime(freq*2,when);
    const hi=context.createGain();hi.gain.value=.07;
    fundamental.connect(gain);overtone.connect(hi).connect(gain);gain.connect(filter);
    gain.gain.setValueAtTime(.0001,when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.018);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.32),when+.17);
    gain.gain.exponentialRampToValueAtTime(.0001,when+length);
    fundamental.start(when);overtone.start(when);
    fundamental.stop(when+length+.02);overtone.stop(when+length+.02);
    fundamental.onended=()=>{fundamental.disconnect();overtone.disconnect();hi.disconnect();gain.disconnect();};
  }
  function schedule(){
    if(!started||!context||!enabled())return;
    while(next<context.currentTime+.30){
      const bar=Math.floor(step/8)%chords.length;
      const pos=step%8;
      if(pos===0)chords[bar].forEach((f,i)=>key(f,next+i*.035,1.45,.007));
      if(pos%2===0)key(melody[step%melody.length],next,.29,.016);
      next+=.33;step++;
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
  function setCorridorProgress(value){
    walkProgress=Math.min(1,Math.max(0,value));
    if(!started||!context)return;
    applyMix();
  }
  function applyMix(){
    if(!started||!context)return;
    const now=context.currentTime;
    // Silent until the middle of the corridor, then gently audible behind the closed door.
    const distance=Math.max(0,Math.min(1,(walkProgress-.43)/.57));
    const effective=openness;
    filter.frequency.setTargetAtTime(210+distance*130+effective*4300,now,.12);
    output.gain.setTargetAtTime(enabled()?(distance*(.12+.10*distance)*(1-effective)+effective*.75):0,now,.16);
  }
  function setDoorOpen(amount){
    openness=Math.min(1,Math.max(0,amount));
    if(!started||!context)return;
    applyMix();
  }
  function update(){
    if(!started){ensure();return;}
    applyMix();
    if(enabled())schedule();
  }
  window.addEventListener('investigation:arrived',()=>{walkProgress=1;ensure();applyMix();});
  window.addEventListener('investigation:corridor-progress',event=>{ensure();setCorridorProgress(event.detail.progress);});
  document.querySelector('#sound-button')?.addEventListener('click',()=>queueMicrotask(update));
  document.addEventListener('visibilitychange',update);
  window.HNJRoomMusic=Object.freeze({setDoorOpen,setCorridorProgress});
})();
