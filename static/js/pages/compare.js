// D1 / M3 취향 비교 (통하는 것 → 티격태격 포인트 → 같이 정하면 좋은 것) + 룰렛 패널
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { $, $$, actionbar, esc, nameOf, reducedMotion, toast, who } from '../ui.js';
import { loadTrip, poll } from '../trip.js';
import { bindRoulette, openRoulette, rouletteHtml, spinIfNew } from './roulette-panel.js';

export async function render(main, id) {
  let trip = await loadTrip(main, id);
  if (!trip) return;
  if (!trip.compare) { location.hash = `#/t/${id}/survey`; return; }
  const animate = !session.flag(`compare.${id}`) && !reducedMotion();
  session.setFlag(`compare.${id}`);

  const draw = () => {
    const c = trip.compare, k = COPY.compare;
    const matchCount = c.common.length + c.likes.both.length;
    const diffs = c.diffs;
    main.innerHTML = `<div class="wrap page"><div class="split">
      <div class="stack-lg">
        <header class="stack">
          <p class="muted">${k.top}</p>
          <h1>${esc(k.count(matchCount, diffs.length))}</h1>
        </header>

        <section class="stack" aria-labelledby="h-common">
          <h2 id="h-common">${k.common}</h2>
          ${matchCount ? '' : '<p class="muted">이번엔 겹치는 답이 없었어요. 대신 각자 좋아하는 걸 번갈아 담아볼게요</p>'}
          <div class="chips">
            ${c.likes.both.map((t) => `<span class="chip chip-common">${esc(t)}</span>`).join('')}
            ${c.common.map((x) => `<span class="chip chip-common">${esc(shortTitle(x.title))} · ${esc(x.text)}</span>`).join('')}
          </div>
          ${c.likes.A.length || c.likes.B.length ? `<h3>${k.each}</h3><div class="chips">
            ${c.likes.A.map((t) => `<span class="chip chip-a"><span class="who shape-a"></span>${esc(t)}</span>`).join('')}
            ${c.likes.B.map((t) => `<span class="chip chip-b"><span class="who shape-b"></span>${esc(t)}</span>`).join('')}</div>
            <p class="caption">${who(trip, 'A')} ${who(trip, 'B')} 각자 좋아하는 건 코스에 번갈아 담아요</p>` : ''}
        </section>

        <section class="stack" aria-labelledby="h-diff">
          <h2 id="h-diff">${k.diff}</h2>
          ${diffs.length ? diffs.filter((d) => d.scale).map((d) => bar(trip, d, animate)).join('') + table(trip, diffs) : `<p class="notice">${k.sameAll}</p>`}
        </section>

        ${c.conditions.length ? `<section class="stack"><h2>${k.conditions}</h2>
          ${c.conditions.map((d) => `<p class="card card-tight">${esc(shortTitle(d.title))}: ${esc(k.method.condition(d.result))}</p>`).join('')}</section>` : ''}
      </div>
      <aside class="card sticky-side" id="r-panel" aria-label="${COPY.roulette.title}">${panel()}</aside>
    </div></div>
    ${actionbar(`<a class="btn btn-primary" href="#/t/${id}/course">${k.next}</a>`)}`;
    bind();
  };

  const panel = () => {
    if (trip.roulette && trip.roulette.key.startsWith('diff:')) return rouletteHtml(trip);
    const open = trip.compare.diffs.filter((d) => d.method === 'roulette' && !d.result);
    return `<div class="stack"><h2>${COPY.roulette.title}</h2><p class="muted">${COPY.roulette.pick}</p>
      ${open.length ? `<div class="chips">${open.map((d) => `<button class="chip" data-open="diff:${d.key}">${esc(shortTitle(d.title))}</button>`).join('')}</div>`
        : '<p class="caption">지금은 룰렛으로 정할 항목이 없어요</p>'}</div>`;
  };

  const refresh = async () => {
    trip = await api(`/trips/${id}`, { trip: id });
    $('#r-panel').innerHTML = panel();
    bindPanel();
    if (trip.roulette?.applied) draw();
  };

  const bindOpen = (scope) => $$('[data-open]', scope).forEach((b) => b.addEventListener('click', async () => {
    try {
      await openRoulette(id, b.dataset.open);
      await refresh();
      $('#r-panel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (err) { toast(err.message); }
  }));
  const bindPanel = () => {
    bindOpen($('#r-panel'));
    bindRoulette($('#r-panel'), id, refresh);
    spinIfNew(trip, $('#r-panel'));
  };
  const bind = () => {
    bindOpen($('.diff-table') || document.createElement('div'));
    bindPanel();
  };

  draw();
  let last = JSON.stringify(trip.roulette) + JSON.stringify(trip.decisions);
  return poll(id, 3000, (t) => {
    const now = JSON.stringify(t.roulette) + JSON.stringify(t.decisions);
    if (now === last) return;
    const decided = JSON.stringify(t.decisions) !== JSON.stringify(trip.decisions);
    last = now;
    trip = t;
    if (decided) draw();
    else { $('#r-panel').innerHTML = panel(); bindPanel(); }
  });
}

const shortTitle = (t) => t.replace(/\?$/, '').replace(/^(어떤|하루에|하루를|하루|얼마나)\s*/, '');

function bar(trip, d, animate) {
  const n = d.scale.length - 1;
  const pa = (d.posA / n) * 100, pb = (d.posB / n) * 100;
  const lo = Math.min(pa, pb), hi = Math.max(pa, pb);
  const alt = `${shortTitle(d.title)}: ${nameOf(trip, 'A')} ${d.A}, ${nameOf(trip, 'B')} ${d.B}, 그 사이가 ${COPY.compare.range}`;
  return `<div class="cbar ${animate ? 'animate' : ''}" role="img" aria-label="${esc(alt)}">
    <div class="cbar-head"><span>${esc(shortTitle(d.title))}</span></div>
    <div class="cbar-track" aria-hidden="true">
      <span class="cbar-range" style="left:${lo}%;width:${hi - lo}%"></span>
      <span class="cbar-dot a" style="left:${pa}%">●<span class="lbl">${esc(nameOf(trip, 'A'))}</span></span>
      <span class="cbar-dot b" style="left:${pb}%">◆<span class="lbl">${esc(nameOf(trip, 'B'))}</span></span>
    </div>
    <div class="cbar-ends" aria-hidden="true"><span>${esc(d.scale[0])}</span><span>${COPY.compare.range}</span><span>${esc(d.scale[n])}</span></div>
  </div>`;
}

function table(trip, diffs) {
  const m = COPY.compare.method;
  const how = (d) => {
    if (d.method === 'condition') return esc(m.condition(d.result));
    if (d.method === 'course') return m.course;
    if (d.result) return esc(m.decided(d.result));
    return `<button class="btn btn-sm" data-open="diff:${d.key}">${m.roulette}</button>`;
  };
  return `<table class="diff-table"><thead><tr><th>항목</th><th>${who(trip, 'A')}</th><th>${who(trip, 'B')}</th><th>정하는 방법</th></tr></thead>
    <tbody>${diffs.map((d) => `<tr><td class="strong">${esc(shortTitle(d.title))}</td>
      <td><span class="sr-only">${esc(nameOf(trip, 'A'))}: </span><span class="who shape-a"></span> ${esc(d.A)}</td>
      <td><span class="sr-only">${esc(nameOf(trip, 'B'))}: </span><span class="who shape-b"></span> ${esc(d.B)}</td>
      <td>${how(d)}</td></tr>`).join('')}</tbody></table>`;
}
