/* Editorial source: sections are navigation destinations, not a fixed page count.
   Supply owner-approved photo/audio/content here; never generate a subject portrait. */
window.HNJCaseData=Object.freeze({
 photo:null, // Relative URL of the original authorized photograph.
 memo:'관찰한 사실과 추측은 구분할 것.',
 sections:[
 ['opened','사건 발생','CASE OPENED'],['profile','신원 조사','SUBJECT PROFILE'],
 ['index','증거 수집 시작','EVIDENCE INDEX'],['photos','증거 01','외적 매력 / 증거사진 봉투'],
 ['interview','증거 02','인터뷰 및 발언 기록'],['filmography','증거 03','필모그래피 보드'],
 ['final','최종 페이지','FINAL REPORT']
 ].map(([id,title,subtitle])=>({id,title,subtitle,content:null}))
});
