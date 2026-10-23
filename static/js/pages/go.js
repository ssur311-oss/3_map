// M6 확정 · 여행 중: 방문 순서 지도, 다음 장소, 주변 시설, 문제 해결 룰렛
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { createMap } from '../map.js';
import { $, $$, actionbar, closeSheet, esc, km, openSheet, ownerText, reducedMotion, straight, toast, who } from '../ui.js';
import { loadTrip, poll } from '../trip.js';
import { catName } from './course-view.js';
import { bindRoulette, openRoulette, rouletteHtml, spinIfNew } from './roulette-panel.js';

const G = COPY.go;
const UTIL = [['PK6', '주차장', 'P'], ['CS2', '편의점', '편'], ['PM9', '약국', '약'], ['HP8', '병원', '병']];

export async function render(main, id) {
  let trip = await loadTrip(main, id);
  if (!trip) return;
  if (!trip.confirmed) { location.hash = `#/t/${id}/course`; return; }
  let util = null, utilCode = '';

  const places = () => trip.course.stops.filter((s) => s.kind === 'place').map((s) => s.place);
  const firstVisit = !session.flag(`confirmed.${id}`);
  session.setFlag(`confirmed.${id}`);

  main.innerHTML = `<div class="wrap page"><div class="split split-even">
    <div class="stack"><p class="badge-done ${firstVisit && !reducedMotion() ? 'celebrate' : ''}">✓ ${G.badge}</p>
      <div class="go-map"><div class="map-box" id="map"></div></div></div>
    <div class="stack" id="side"></div></div></div><div id="bar"></div>`;
  if (firstVisit) toast(COPY.course.confirmed);
  const map = await createMap($('#map'), { onPinClick: (pid) => map.select(pid) });

  const drawMap = () => {
    const ps = places();
    const pins = ps.map((p, i) => ({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, kind: 'stop', owner: p.owner, label: String(i + 1), title: p.name, alt: `${i + 1}번 ${p.name}, ${ownerText(trip, p.owner)}` }));
    (util || []).forEach((p) => pins.push({ id: `u:${p.id}`, lat: p.lat, lng: p.lng, kind: 'util', label: UTIL.find((u) => u[0] === utilCode)?.[2] || '', title: p.name, alt: p.name }));
    map.render({ pins, route: [trip.start, ...ps, trip.end].filter(Boolean) });
    const next = ps[trip.goIndex];
    if (next) map.select(`s:${next.id}`);
  };

  const legText = (i) => {
    const legs = trip.course.legs || [];
    const l = legs[trip.start ? i : i - 1];
    if (!l) return '';
    return l.duration != null ? `자동차 약 ${Math.round(l.duration / 60)}분 · ${km(l.distance)}km (추정)` : `${G.legUnknown} · 직선 ${km(l.straight)}km`;
  };

  const drawSide = () => {
    const ps = places(), i = trip.goIndex, next = ps[i];
    if (!next) {
      $('#side').innerHTML = `<div class="next-card stack"><h1>${G.done}</h1></div>`;
      $('#bar').innerHTML = actionbar(`<a class="btn btn-primary" href="#/">홈으로</a>`);
      return;
    }
    $('#side').innerHTML = `
      <div class="next-card stack">
        <p class="caption">${G.next} · ${i + 1}/${ps.length}</p>
        <h1>${esc(next.name)}</h1>
        <p>${who(trip, next.owner)} <span class="caption">${esc(catName(next))}</span></p>
        ${i > 0 || trip.start ? `<p class="caption">${esc(legText(i))}</p>` : ''}
        <a class="btn" href="https://map.kakao.com/link/to/${encodeURIComponent(next.name)},${next.lat},${next.lng}" target="_blank" rel="noopener">${G.route}</a>
      </div>
      <section class="card stack"><h2>${G.trouble}</h2><p class="muted">${G.troubleSub}</p>
        <button class="btn" id="trouble">룰렛 열기</button></section>
      <section class="card stack" aria-labelledby="h-near"><h2 id="h-near">${G.nearby}</h2>
        <div class="chips">${UTIL.map(([c, t]) => `<button class="chip" data-util="${c}" aria-pressed="${utilCode === c}">${t}</button>`).join('')}</div>
        <div id="util-list" aria-live="polite">${utilList()}</div></section>`;
    $('#bar').innerHTML = actionbar(`<button class="btn btn-primary" id="arrive">${G.arrived}</button>`);
    $('#arrive').onclick = async () => {
      try { await api(`/trips/${id}/arrive`, { method: 'POST', trip: id }); await refresh(); } catch (err) { toast(err.message); }
    };
    $('#trouble').onclick = async () => {
      try { await openRoulette(id, 'trip'); await refresh(); showRoulette(); } catch (err) { toast(err.message); }
    };
    $$('[data-util]').forEach((b) => (b.onclick = () => nearby(b.dataset.util)));
    if (trip.roulette?.key === 'trip' && !$('.sheet')) showRoulette();
  };

  const utilList = () => {
    if (util === null) return '';
    if (!util.length) return `<p class="caption">${G.noNearby}</p>`;
    const next = places()[trip.goIndex];
    return `${utilCode === 'HP8' ? `<p class="notice">${G.hospital}</p>` : ''}<ul class="stack" style="padding:0;list-style:none;margin:0">${util.map((p) =>
      `<li class="row"><span class="strong">${esc(p.name)}</span><span class="caption">약 ${km(straight(next, p))}km</span>
       ${p.demo ? '<span class="tag tag-demo">예시</span>' : ''}</li>`).join('')}</ul>`;
  };

  const nearby = async (code) => {
    const next = places()[trip.goIndex];
    utilCode = code;
    try {
      util = (await api(`/trips/${id}/nearby?code=${code}&lat=${next.lat}&lng=${next.lng}`, { trip: id })).places;
    } catch (err) { util = []; toast(err.message); }
    drawSide();
    drawMap();
  };

  const showRoulette = () => {
    const sheet = openSheet(`<div id="r-sheet">${rouletteHtml(trip)}</div>`, { label: COPY.roulette.title });
    bindRoulette(sheet, id, async () => { await refresh(); });
    spinIfNew(trip, sheet);
  };

  const refresh = async () => {
    trip = await api(`/trips/${id}`, { trip: id });
    const sheet = $('#r-sheet');
    if (sheet && trip.roulette) {
      sheet.innerHTML = rouletteHtml(trip);
      bindRoulette(sheet, id, refresh);
      spinIfNew(trip, sheet);
      if (trip.roulette.applied) { drawSide(); drawMap(); }
      $('[data-r="close"]', sheet)?.addEventListener('click', closeSheet);
      return;
    }
    if (!trip.roulette) closeSheet();
    drawSide();
    drawMap();
  };

  drawSide();
  drawMap();
  let last = JSON.stringify([trip.roulette, trip.goIndex, trip.course.version]);
  return poll(id, 3000, (t) => {
    const now = JSON.stringify([t.roulette, t.goIndex, t.course.version]);
    if (now !== last) { last = now; refresh(); }
  });
}
