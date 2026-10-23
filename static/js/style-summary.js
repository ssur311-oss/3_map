// 온보딩 미리보기용 여행 스타일 이름 ("느긋한 아침 미식가"). 재미 요소일 뿐 추천에는 쓰지 않는다
const RHYTHM = { early: '부지런한 아침', morning: '느긋한 아침', noon: '여유로운 한낮' };
const STYLE = { many: '탐험가', relaxed: '산책가', food: '미식가', view: '풍경 수집가' };

export function styleSummary(qs, a) {
  const title = `${RHYTHM[a.start] || '자유로운'} ${STYLE[a.style] || '여행자'}`;
  const tags = [];
  for (const q of qs) {
    if (q.type === 'mbti') { if (a.mbti) tags.push(a.mbti); continue; }
    const vals = q.type === 'multi' ? a[q.key] || [] : a[q.key] ? [a[q.key]] : [];
    for (const v of vals) {
      if (v === 'any') continue;
      const opt = q.options.find(([k]) => k === v);
      if (opt) tags.push(opt[1]);
    }
  }
  return { title, tags };
}
