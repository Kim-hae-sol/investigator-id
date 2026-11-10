/* Sections are navigation destinations. Fill their materials with approved originals.
   Image entries use { src, alt, credit }; omit entries until assets are available. */
window.HNJCaseData=Object.freeze({
  photo:null, // Original photograph used by the existing desk photo viewer.
  memo:'관찰한 사실과 추측은 구분할 것.',
  sections:[
    {id:'opened',title:'사건 발생',materials:{record:[],wanted:null}},
    {id:'profile',title:'신원 조사',materials:{portrait:null,facts:[]}},
    {id:'index',title:'증거 수집 시작',materials:{}},
    {id:'photos',title:'증거 01 — 외적 매력 / 증거사진 봉투',materials:{prints:[]}},
    {id:'interview',title:'증거 02 — 인터뷰와 발언 기록',materials:{transcript:[],statements:[]}},
    {id:'filmography',title:'증거 03 — 필모그래피 보드',materials:{works:[]}},
    {id:'final',title:'최종 페이지',materials:{report:[],conclusion:[]}}
  ]
});
