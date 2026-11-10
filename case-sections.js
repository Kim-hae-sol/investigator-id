/* Layout modules receive only their chapter materials and navigation actions. */
(()=>{
  function element(tag, value='', className='') {
    const node=document.createElement(tag);
    node.textContent=value;
    node.className=className;
    return node;
  }

  function region(parent, title, className) {
    const section=element('section','', 'chapter-material '+className);
    section.append(element('h2',title));
    parent.append(section);
    return section;
  }

  function paragraphs(parent, values) {
    for (const value of values) parent.append(element('p',value));
    if (!values.length) parent.append(element('p','자료 미등록','chapter-empty'));
  }

  function artwork(parent, asset, slot) {
    const frame=element('figure','','chapter-artwork '+slot);
    if (asset?.src) {
      const image=element('img');
      image.src=asset.src;
      image.alt=asset.alt ?? '';
      frame.append(image);
      if (asset.credit) frame.append(element('figcaption',asset.credit));
    } else {
      frame.append(element('span','이미지 미등록','chapter-empty'));
    }
    parent.append(frame);
  }

  function documentSheet(parent,title,format,expand) {
    const sheet=region(parent,title,'document-sheet '+format);
    if (expand) {
      const button=element('button','펼쳐 보기','document-expand');
      button.type='button';
      button.setAttribute('aria-label',title+' 펼쳐 보기');
      button.onclick=()=>expand(sheet,title,button);
      sheet.append(button);
    }
    return sheet;
  }

  const renderers=new Map([
    ['opened',({left,right,materials,expand})=>{
      paragraphs(documentSheet(left,'사건 기록','document-a4',expand),materials.record);
      artwork(documentSheet(right,'WANTED','document-poster',expand),materials.wanted,'wanted-art');
    }],
    ['profile',({right,materials})=>{
      const profile=documentSheet(right,'신상 기록','document-a5 document-profile');
      artwork(profile,materials.portrait,'portrait-art');
      const facts=element('dl');
      for (const {label,value} of materials.facts) facts.append(element('dt',label),element('dd',value));
      if (materials.facts.length) profile.append(facts);
      else paragraphs(profile,[]);
    }],
    ['index',({left,right,sections,goTo,memo})=>{
      left.append(element('p','EVIDENCE / 01–03','chapter-separator'));
      if (memo) {
        const note=documentSheet(left,'조사관 메모','document-a6');
        note.dataset.typeRecord='';
        paragraphs(note,[memo]);
      }
      const list=element('ol','','chapter-evidence-list');
      for (const id of ['photos','interview','filmography']) {
        const chapter=sections.find(section=>section.id===id);
        const row=element('li');
        const button=element('button',chapter.title);
        button.type='button';
        button.onclick=()=>goTo(id);
        row.append(button);
        list.append(row);
      }
      documentSheet(right,'증거 목록','document-a5').append(list);
    }],
    ['photos',({right,materials,expand})=>{
      const stack=element('div','','document-evidence-stack');
      right.append(stack);
      const envelope=documentSheet(stack,'증거사진 봉투','chapter-envelope',expand);
      const prints=element('div','','document-prints');
      for (const print of materials.prints.length ? materials.prints : [null,null]) {
        artwork(prints,print,'evidence-print '+(print?.orientation==='landscape'?'print-wide':''));
      }
      envelope.append(prints);
    }],
    ['interview',({left,right,materials,expand})=>{
      paragraphs(documentSheet(left,'인터뷰 기록지','document-a4',expand),materials.transcript);
      const statements=region(right,'발언 발췌','chapter-statements document-excerpts');
      if (!materials.statements.length) paragraphs(statements,[]);
      for (const statement of materials.statements) statements.append(element('blockquote',statement));
    }],
    ['filmography',({right,materials,expand})=>{
      const board=documentSheet(right,'필모그래피 보드','chapter-board document-board',expand);
      if (!materials.works.length) paragraphs(board,[]);
      else {
        const works=element('ul');
        for (const {title,art} of materials.works) {
          const work=element('li',title);
          if (art) artwork(work,art,'work-art');
          works.append(work);
        }
        board.append(works);
      }
    }],
    ['final',({left,right,materials,expand})=>{
      paragraphs(documentSheet(left,'최종 수사 보고서','document-a4',expand),materials.report);
      const conclusion=documentSheet(right,'조사관 결론','document-a6 document-conclusion');
      if (materials.conclusion.length) conclusion.dataset.typeRecord='';
      paragraphs(conclusion,materials.conclusion);
    }]
  ]);

  window.HNJCaseSections=Object.freeze({
    register(id,render){renderers.set(id,render);},
    render(section,left,right,context){
      left.replaceChildren();
      right.replaceChildren();
      renderers.get(section.id)?.({left,right,materials:section.materials,...context});
    }
  });
})();
