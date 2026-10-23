// 코스 화면 HTML 조각. 상태는 course.js가 갖고, 여기서는 그리기만 한다
import { COPY } from '../copy.js';
import { esc, km, nameOf, straight, who } from '../ui.js';

const C = COPY.course;
export const CATS = [['AT4', '관광명소'], ['FD6', '음식점'], ['CE7', '카페'], ['CT1', '문화시설'], ['PK6', '주차장']];
const CAT_NAME = Object.fromEntries([...CATS, ['AD5', '숙박'], ['CS2', '편의점'], ['PM9', '약국'], ['HP8', '병원']]);
export const catName = (p) => p.categoryName || CAT_NAME[p.category] || '장소';

export function header(trip, view, dirty) {
  const b = view.burden;
  return `<div class="stack">
    <div class="row"><h2>${esc(view.title)}</h2>${trip.demo ? '<span class="tag tag-demo">예시</span>' : ''}${trip.test ? '<span class="tag tag-demo">테스트 모드</span>' : ''}</div>
    <p class="muted">${esc(view.summary)}</p>
    ${b && !dirty ? `<div class="burden" role="img" aria-label="이동 부담 ${b.level}">
      <span class="bars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= b.steps ? 'on' : ''}"></i>`).join('')}</span>
      <span class="strong">이동 부담 ${b.level}</span></div><p class="caption">${esc(b.text)}</p>` : ''}
    ${view.balance && !dirty ? `<p>${esc(view.balance.text)}</p>
      ${view.balance.suggest ? `<button class="link-btn" data-suggest="${view.balance.suggest.owner}">${esc(view.balance.suggest.text)}</button>` : ''}` : ''}
    ${(view.notes || []).map((n) => `<p class="notice">${esc(n.text)}</p>`).join('')}
    ${dirty ? `<p class="notice">${C.editNote}</p>` : ''}
    ${!dirty && view.timesKnown === false ? `<p class="caption">${C.timesUnknown}</p>` : ''}
    ${trip.demo ? `<p class="caption">${C.demo}</p>` : ''}
  </div>`;
}

export function stopList(trip, stops, legs, selected, startPoint) {
  if (!stops.some((s) => s.kind === 'place')) return `<p class="card empty">${C.noPlaces}</p>`;
  let n = 0, leg = startPoint ? 1 : 0;
  const places = stops.filter((s) => s.kind === 'place').map((s) => s.place);
  return `<ol class="stops">${stops.map((s, i) => {
    const tools = `<div class="stop-tools">
      <button class="icon-btn" data-move="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="${C.up}">↑</button>
      <button class="icon-btn" data-move="${i}:1" ${i === stops.length - 1 ? 'disabled' : ''} aria-label="${C.down}">↓</button>
      ${s.kind === 'place' ? `<button class="icon-btn" data-replace="${i}">${C.replace}</button>` : ''}
      <button class="icon-btn" data-remove="${i}">${C.remove}</button></div>`;
    if (s.kind === 'rest') {
      return `<li class="stop"><span class="stop-num rest" aria-hidden="true">☕</span>
        <div><p class="stop-name">${C.rest(s.minutes)}</p>${s.time ? `<p class="caption">${s.time}</p>` : ''}</div>${tools}</li>`;
    }
    n += 1;
    const p = s.place;
    let legHtml = '';
    if (n < places.length) {
      const l = legs?.[leg];
      legHtml = l && l.duration != null ? C.legKnown(Math.round(l.duration / 60), km(l.distance)) : C.legStraight(km(l ? l.straight : straight(p, places[n])));
    }
    leg += 1;
    return `<li class="stop ${selected === `s:${p.id}` ? 'selected' : ''} ${s.isNew ? 'insert-slot' : ''}">
      <span class="stop-num" aria-hidden="true">${n}</span>
      <div><button class="link-btn stop-name" style="padding:0;text-align:left;text-decoration:none" data-select="s:${esc(p.id)}">${esc(p.name)}</button>
        <p class="caption">${s.time ? `${s.time} · ` : ''}${esc(catName(p))}${s.stay ? ` · ${C.stay(Math.round(s.stay / 60))}` : ''}</p>
        <p class="caption">${who(trip, p.owner)}${p.demo ? ' <span class="tag tag-demo">예시</span>' : ''}</p></div>
      ${tools}</li>${legHtml ? `<li class="leg">${esc(legHtml)}</li>` : ''}`;
  }).join('')}</ol>`;
}

export function searchPanel(results, stops, query, code) {
  const places = stops.filter((s) => s.kind === 'place').map((s) => s.place);
  const nearest = (p) => {
    let best = null;
    places.forEach((q, i) => { const d = straight(p, q); if (!best || d < best.d) best = { d, i: i + 1 }; });
    return best;
  };
  return `<section class="stack" id="search" aria-labelledby="h-search">
    <h3 id="h-search">${C.searchTitle}</h3>
    <form class="row" id="search-form" role="search"><label class="sr-only" for="q">${C.searchPh}</label>
      <input class="input" id="q" style="flex:1;min-width:0" placeholder="${C.searchPh}" value="${esc(query)}">
      <button class="btn btn-sm">${C.search}</button></form>
    <div class="chips">${CATS.map(([k, t]) => `<button class="chip" data-cat="${k}" aria-pressed="${code === k}">${t}</button>`).join('')}</div>
    <div aria-live="polite">${results === null ? '' : results.length === 0 ? '<p class="caption">찾는 장소가 없어요. 다른 이름이나 카테고리로 찾아보세요</p>'
      : results.map((p, i) => {
        const near = nearest(p);
        return `<div class="result-item"><span class="result-label" aria-hidden="true">${String.fromCharCode(97 + i)}</span>
          <div><button class="link-btn" style="padding:0;text-align:left;text-decoration:none;min-height:0" data-select="r:${esc(p.id)}">${esc(p.name)}</button>
            <p class="caption">${esc(catName(p))}${near ? ` · ${C.fromStop(near.i, km(near.d))}` : ''}</p></div>
          <button class="btn btn-sm" data-add="${esc(p.id)}">${C.add}</button></div>`;
      }).join('')}</div></section>`;
}

export function confirmState(trip) {
  const c = trip.course;
  if (!c) return '';
  const s = (side) => `<span class="tag">${who(trip, side)}&nbsp;${c.confirmedBy.includes(side) ? '확인함' : '확인 대기'}</span>`;
  return `<div class="confirm-state" aria-label="확인 상태">${s('A')}${s('B')}</div>`;
}

export function miniCard(trip, p, info) {
  return `<div class="mini-card stack" role="dialog" aria-label="${esc(p.name)}">
    <div class="row"><h3 style="flex:1">${esc(p.name)}</h3><button class="icon-btn" data-close-card aria-label="닫기">✕</button></div>
    <p>${who(trip, p.owner)} <span class="caption">${esc(catName(p))}</span></p>
    ${p.address ? `<p class="caption">${esc(p.address)}</p>` : ''}
    <p class="caption">${esc(info)}</p>
    <div class="row">${p.inCourse ? '' : `<button class="btn btn-primary btn-sm" data-add-card="${esc(p.id)}">${C.putIn}</button>`}
      ${p.url ? `<a class="btn btn-sm" href="${esc(p.url)}" target="_blank" rel="noopener">카카오맵 정보</a>` : ''}</div>
  </div>`;
}

export function filterChips(trip, filter) {
  const opts = [['all', '전체'], ['A', `● ${nameOf(trip, 'A')}`], ['B', `◆ ${nameOf(trip, 'B')}`], ['both', '공통']];
  return `<div class="chips" role="group" aria-label="취향 필터">${opts.map(([k, t]) => `<button class="chip" data-filter="${k}" aria-pressed="${filter === k}">${esc(t)}</button>`).join('')}</div>`;
}
