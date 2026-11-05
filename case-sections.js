/* Section renderers are deliberately independent. Future envelope, interview and
   filmography modules register a renderer here without changing navigation. */
(()=>{const renderers=new Map();
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
function action(area,label,fn){const b=text('button',label);b.type='button';b.onclick=fn;area.append(b);}
renderers.set('opened',(area,ctx)=>action(area,'접힌 메모',()=>ctx.inspect('note')));
renderers.set('photos',(area,ctx)=>action(area,'사진 자료 보기',()=>ctx.inspect('photo')));
renderers.set('interview',()=>{});renderers.set('filmography',()=>{});
window.HNJCaseSections=Object.freeze({register(id,render){renderers.set(id,render);},render(section,area,ctx){area.replaceChildren();if(section.content){for(const block of section.content)area.append(text('p',block.text||''));}else{const p=text('p','자료 준비 중');p.className='case-pending';area.append(p);}renderers.get(section.id)?.(area,ctx);}});
})();
