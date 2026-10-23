// D2 / W3 / M5 후보 지도 + 코스 초안 + 함께 고치기 + 확정
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { createMap } from '../map.js';
import { $, $$, OTHER, actionbar, closeSheet, esc, km, loading, nameOf, openSheet, ownerText, straight, toast, who } from '../ui.js';
import { loadTrip, poll } from '../trip.js';
import { catName, confirmState, filterChips, header, miniCard, searchPanel, stopList } from './course-view.js';

const C = COPY.course;
const PIN_GAP_M = 300;

export async function render(main, id) {
  let trip = await loadTrip(main, id);
  if (!trip) return;
  if (!trip.compare) { location.hash = `#/t/${id}/survey`; return; }
  main.innerHTML = `<div class="wrap page">${loading('두 분 취향에 맞는 코스 초안을 만드는 중이에요')}</div>`;
  let drafts, places;
  try {
    [{ drafts }, { places }] = await Promise.all([api(`/trips/${id}/drafts`, { trip: id }), api(`/trips/${id}/places`, { trip: id })]);
  } catch (err) {
    main.innerHTML = `<div class="wrap narrow page"><p class="error-box">${esc(err.message)}</p></div>`;
    return;
  }

  const st = { tab: trip.course ? 'saved' : 'fair', work: null, dirty: false, selected: null, results: null, query: '', code: '', filter: 'all', listOnly: false };
  const local = session.draft(id);
  const viewOf = () => (st.tab === 'saved' ? trip.course : drafts.find((d) => d.type === st.tab));
  const load = () => {
    const v = viewOf();
    st.work = { type: v.type, stops: structuredClone(v.stops) };
    st.dirty = false;
  };
  if (local && !trip.course) { st.tab = local.type; st.work = local; st.dirty = true; } else load();

  main.innerHTML = `<div class="planner" id="planner">
    <div class="planner-map"><div class="map-box" id="map"></div></div>
    <div class="planner-list"><div class="handle" aria-hidden="true"></div><div id="list"></div></div></div>
    <div id="bar"></div>`;
  const map = await createMap($('#map'), { onPinClick: (pid) => select(pid), firstDrop: true });

  const placesInCourse = () => st.work.stops.filter((s) => s.kind === 'place').map((s) => s.place);
  const findPlace = (pid) => {
    const [kind, raw] = [pid.slice(0, 1), pid.slice(2)];
    if (kind === 's') return placesInCourse().find((p) => p.id === raw);
    if (kind === 'r') return st.results?.find((p) => p.id === raw);
    return places.find((p) => p.id === raw);
  };

  // 새 장소를 넣을 때 직선거리가 가장 적게 늘어나는 자리를 찾는다
  const bestSlot = (p) => {
    const pts = placesInCourse();
    const seq = [trip.start, ...pts, trip.end];
    let best = { add: Infinity, at: pts.length };
    for (let i = 0; i <= pts.length; i++) {
      const prev = seq[i], next = seq[i + 1];
      const add = (prev ? straight(prev, p) : 0) + (next ? straight(p, next) : 0) - (prev && next ? straight(prev, next) : 0);
      if (add < best.add) best = { add, at: i };
    }
    return best;
  };
  const slotText = (at, n) => (at === 0 ? '1번 앞' : at >= n ? `${n}번 뒤` : `${at}번과 ${at + 1}번`);

  const pins = () => {
    const used = new Set(placesInCourse().map((p) => p.id));
    const f = st.filter;
    // 후보를 전부 찍으면 핀이 겹쳐 읽을 수 없어, 취향별로 코스와 가까운 곳만 보여준다 (개수는 표시하지 않음)
    // 코스 장소나 이미 찍은 후보와 너무 가까운 후보는 건너뛰어 핀끼리 겹치지 않게 한다
    const mid = placesInCourse()[0] || trip.center;
    const taken = [...placesInCourse()];
    const near = (o) => {
      const out = [];
      for (const p of places.filter((x) => !used.has(x.id) && x.owner === o).sort((a, b) => straight(mid, a) - straight(mid, b))) {
        if (out.length >= (f === 'all' ? 4 : 10)) break;
        if (taken.some((q) => straight(p, q) < PIN_GAP_M)) continue;
        taken.push(p);
        out.push(p);
      }
      return out;
    };
    const cands = (f === 'all' ? ['both', 'A', 'B'] : [f]).flatMap(near)
      .map((p) => ({ id: `c:${p.id}`, lat: p.lat, lng: p.lng, kind: p.owner, title: p.name, alt: `${p.name}, ${ownerText(trip, p.owner)}` }));
    const stops = placesInCourse().map((p, i) => ({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, kind: 'stop', owner: p.owner, label: String(i + 1), title: p.name, alt: `${i + 1}번 ${p.name}, ${ownerText(trip, p.owner)}` }));
    const res = (st.results || []).map((p, i) => ({ id: `r:${p.id}`, lat: p.lat, lng: p.lng, kind: 'search', label: String.fromCharCode(97 + i), title: p.name, alt: `검색 결과 ${p.name}` }));
    return [...cands, ...res, ...stops];
  };
  const route = () => [trip.start, ...placesInCourse(), trip.end].filter(Boolean);

  const drawMap = (fit = true) => {
    map.render({ pins: pins(), route: route(), fit });
    const legend = `<div class="map-legend" aria-hidden="true"><span><b class="who shape-both"></b>${C.legend.both}</span><span>${who(trip, 'A')}</span><span>${who(trip, 'B')}</span><span>┄ ${C.legend.order}</span></div>
      <div class="map-tools">${map.real ? '<button class="icon-btn" data-zoom="-1" aria-label="확대">＋</button><button class="icon-btn" data-zoom="1" aria-label="축소">－</button>' : ''}</div>
      <div class="map-filter">${filterChips(trip, st.filter)}</div>`;
    $$('#map > :not(.map-canvas)').forEach((el) => el.remove());
    $('#map').insertAdjacentHTML('beforeend', legend);
    $$('#map [data-zoom]').forEach((b) => (b.onclick = () => map.zoom(Number(b.dataset.zoom))));
    $$('#map [data-filter]').forEach((b) => (b.onclick = () => { st.filter = b.dataset.filter; drawMap(false); }));
    if (st.selected) showCard(st.selected);
  };

  const showCard = (pid) => {
    $('#map .mini-card')?.remove();
    const p = findPlace(pid);
    if (!p) return;
    const pts = placesInCourse();
    const idx = pts.findIndex((x) => x.id === p.id);
    let info;
    if (idx >= 0) info = C.inCourse(idx + 1);
    else { const b = bestSlot(p); info = `${slotText(b.at, pts.length)} 사이에 넣으면 직선거리 +${km(Math.max(0, b.add))}km 늘어요 (추정)`; }
    $('#map').insertAdjacentHTML('beforeend', miniCard(trip, { ...p, inCourse: idx >= 0 }, info));
    $('#map [data-close-card]').onclick = () => { st.selected = null; map.select(null); $('#map .mini-card')?.remove(); };
    $('#map [data-add-card]')?.addEventListener('click', () => addPlace(p));
  };

  function select(pid) {
    st.selected = pid;
    map.select(pid);
    showCard(pid);
    $$('#list .stop').forEach((li) => li.classList.toggle('selected', !!li.querySelector(`[data-select="${CSS.escape(pid)}"]`)));
  }

  const edit = (fn) => {
    fn(st.work.stops);
    st.dirty = true;
    session.setDraft(id, st.work);
    drawList();
    drawMap(false);
  };

  const addPlace = (p) => {
    if (placesInCourse().some((x) => x.id === p.id)) return toast('이미 코스에 있는 장소예요');
    const b = bestSlot(p), n = placesInCourse().length;
    const placeIdx = st.work.stops.map((s, i) => (s.kind === 'place' ? i : -1)).filter((i) => i >= 0);
    const at = b.at >= placeIdx.length ? st.work.stops.length : placeIdx[b.at];
    const owner = places.find((x) => x.id === p.id)?.owner || p.owner || 'neutral';
    edit((s) => { s.forEach((x) => delete x.isNew); s.splice(at, 0, { kind: 'place', place: { ...p, owner }, isNew: true }); });
    toast(C.added(slotText(b.at, n)));
  };

  const replaceSheet = (i) => {
    const cur = st.work.stops[i].place;
    const used = new Set(placesInCourse().map((p) => p.id));
    const alts = places.filter((p) => !used.has(p.id))
      .sort((a, b) => (a.owner === cur.owner ? 0 : 1) - (b.owner === cur.owner ? 0 : 1) || straight(cur, a) - straight(cur, b)).slice(0, 3);
    const sheet = openSheet(`<div class="stack"><h2>${C.replaceTitle}</h2><p class="muted">${esc(cur.name)} 대신</p>
      ${alts.length ? alts.map((p, k) => `<div class="result-item"><span class="result-label">${k + 1}</span>
        <div><p class="strong">${esc(p.name)}</p><p class="caption">${esc(catName(p))} · 약 ${km(straight(cur, p))}km</p><p class="caption">${who(trip, p.owner)}</p></div>
        <button class="btn btn-sm" data-pick="${esc(p.id)}">이걸로 바꾸기</button></div>`).join('') : `<p>${C.noAlt}</p>`}</div>`, { label: C.replaceTitle });
    $$('[data-pick]', sheet).forEach((b) => (b.onclick = () => {
      const p = places.find((x) => x.id === b.dataset.pick);
      closeSheet();
      edit((s) => { s[i] = { kind: 'place', place: p, isNew: true }; });
    }));
  };

  const drawList = () => {
    const v = viewOf() || drafts[0];
    const tabs = [...(trip.course ? [['saved', C.saved]] : []), ...drafts.map((d) => [d.type, d.title])];
    $('#list').innerHTML = `<div class="stack">
      <div class="row"><div class="tabs" role="tablist" aria-label="코스 초안" style="flex:1">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${st.tab === k}" data-tab="${k}">${esc(t)}</button>`).join('')}</div></div>
      <div class="row">${confirmState(trip)}<span class="spacer"></span><button class="link-btn" id="list-only" aria-pressed="${st.listOnly}">${st.listOnly ? C.map : C.list}</button></div>
      <div id="notice"></div>
      ${header(trip, v, st.dirty)}
      ${stopList(trip, st.work.stops, st.dirty ? null : v.legs, st.selected, trip.start)}
      <div class="row"><button class="btn btn-sm" id="add-rest">${C.addRest}</button><button class="btn btn-sm" id="add-place">${C.addPlace}</button></div>
      ${searchPanel(st.results, st.work.stops, st.query, st.code)}
    </div>`;
    bindList();
    drawBar();
  };

  const bindList = () => {
    $$('[data-tab]').forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; load(); session.setDraft(id, null); drawList(); drawMap(); }));
    $('#list-only').onclick = () => { st.listOnly = !st.listOnly; $('#planner').classList.toggle('list-only', st.listOnly); drawList(); map.relayout(); };
    $$('[data-move]').forEach((b) => (b.onclick = () => {
      const [i, d] = b.dataset.move.split(':').map(Number);
      edit((s) => { const [x] = s.splice(i, 1); s.splice(i + d, 0, x); });
    }));
    $$('[data-remove]').forEach((b) => (b.onclick = () => edit((s) => s.splice(Number(b.dataset.remove), 1))));
    $$('[data-replace]').forEach((b) => (b.onclick = () => replaceSheet(Number(b.dataset.replace))));
    $$('#list [data-select]').forEach((b) => (b.onclick = () => select(b.dataset.select)));
    $$('[data-suggest]').forEach((b) => (b.onclick = () => { st.filter = b.dataset.suggest; drawMap(false); toast(`${nameOf(trip, b.dataset.suggest)}님 취향 후보만 지도에 보여드려요`); }));
    $('#add-rest').onclick = () => edit((s) => s.push({ kind: 'rest', minutes: 30 }));
    $('#add-place').onclick = () => $('#q').focus();
    $('#search-form').onsubmit = (e) => { e.preventDefault(); st.query = $('#q').value.trim(); search(); };
    $$('[data-cat]').forEach((b) => (b.onclick = () => { st.code = st.code === b.dataset.cat ? '' : b.dataset.cat; search(); }));
    $$('[data-add]').forEach((b) => (b.onclick = () => addPlace(st.results.find((p) => p.id === b.dataset.add))));
  };

  const search = async () => {
    const c = (map.real && map.center()) || trip.center || placesInCourse()[0];
    try {
      const q = new URLSearchParams({ q: st.query, code: st.code, lat: c.lat, lng: c.lng });
      st.results = (await api(`/trips/${id}/search?${q}`, { trip: id })).places.slice(0, 10);
    } catch (err) { toast(err.message); st.results = []; }
    drawList();
    drawMap();
  };

  const drawBar = () => {
    const c = trip.course, me = trip.me;
    const savedView = st.tab === 'saved' && !st.dirty;
    let html;
    if (trip.confirmed && savedView) html = `<a class="btn btn-primary" href="#/t/${id}/go">${C.goTrip}</a>`;
    else if (savedView && c.confirmedBy.includes(me)) html = `<p style="flex:1" class="strong">${esc(C.waitConfirm(nameOf(trip, OTHER[me])))}</p>`;
    else if (savedView) html = `<button class="btn btn-primary" id="confirm">${C.confirm}</button>`;
    else html = `<button class="btn" id="temp">${C.tempSave}</button><button class="btn btn-primary" id="request">${C.requestConfirm}</button>`;
    $('#bar').innerHTML = actionbar(html);
    $('#temp')?.addEventListener('click', () => { session.setDraft(id, st.work); toast(C.tempSaved); });
    $('#request')?.addEventListener('click', requestConfirm);
    $('#confirm')?.addEventListener('click', () => confirm(c.version));
  };

  const requestConfirm = async () => {
    try {
      const stops = st.work.stops.map(({ isNew, time, stay, ...s }) => s);
      await api(`/trips/${id}/course`, { method: 'PUT', trip: id, body: { type: st.work.type, stops } });
      trip = await api(`/trips/${id}`, { trip: id });
      await confirm(trip.course.version);
    } catch (err) { toast(err.message); }
  };

  const confirm = async (version) => {
    try {
      await api(`/trips/${id}/confirm`, { method: 'POST', trip: id, body: { version } });
      session.setDraft(id, null);
      await refresh(true);
      if (trip.confirmed) toast(C.confirmed);
    } catch (err) { toast(err.message); await refresh(true); }
  };

  const refresh = async (force) => {
    const t = await api(`/trips/${id}`, { trip: id });
    const changed = t.course?.version !== trip.course?.version;
    const wasConfirmed = trip.confirmed;
    trip = t;
    if (force || (changed && !st.dirty)) { st.tab = 'saved'; load(); drawList(); drawMap(); }
    else if (changed) { $('#notice').innerHTML = `<p class="notice row">${C.partnerEdited} <button class="btn btn-sm" id="load-new">${C.loadNew}</button></p>`; $('#load-new').onclick = () => refresh(true); }
    else { drawList(); }
    if (!wasConfirmed && trip.confirmed && !force) toast(C.confirmed);
  };

  drawList();
  drawMap();
  return poll(id, 4000, (t) => {
    if (JSON.stringify(t.course?.confirmedBy) !== JSON.stringify(trip.course?.confirmedBy) || t.course?.version !== trip.course?.version) refresh(false);
  });
}
