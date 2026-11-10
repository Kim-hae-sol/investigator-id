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

  const renderers=new Map([
    ['opened',({left,right,materials})=>{
      paragraphs(region(left,'사건 기록','chapter-document'),materials.record);
      artwork(region(right,'WANTED','chapter-wanted'),materials.wanted,'wanted-art');
    }],
    ['profile',({left,right,materials})=>{
      artwork(region(left,'인물 사진','chapter-portrait'),materials.portrait,'portrait-art');
      const profile=region(right,'신상 기록','chapter-profile');
      const facts=element('dl');
      for (const {label,value} of materials.facts) facts.append(element('dt',label),element('dd',value));
      if (materials.facts.length) profile.append(facts);
      else paragraphs(profile,[]);
    }],
    ['index',({left,right,sections,goTo})=>{
      left.append(element('p','EVIDENCE / 01–03','chapter-separator'));
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
      region(right,'증거 목록','chapter-guide').append(list);
    }],
    ['photos',({right,materials})=>{
      const envelope=region(right,'증거사진 봉투','chapter-envelope');
      if (!materials.prints.length) paragraphs(envelope,[]);
      for (const print of materials.prints) artwork(envelope,print,'evidence-print');
    }],
    ['interview',({left,right,materials})=>{
      paragraphs(region(left,'인터뷰 문서','chapter-document'),materials.transcript);
      const statements=region(right,'발언 기록','chapter-statements');
      if (!materials.statements.length) paragraphs(statements,[]);
      for (const statement of materials.statements) statements.append(element('blockquote',statement));
    }],
    ['filmography',({right,materials})=>{
      const board=region(right,'필모그래피 보드','chapter-board');
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
    ['final',({left,right,materials})=>{
      paragraphs(region(left,'최종 수사 보고서','chapter-document'),materials.report);
      paragraphs(region(right,'조사관 결론','chapter-conclusion'),materials.conclusion);
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
