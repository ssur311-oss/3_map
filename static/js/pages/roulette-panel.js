// 룰렛 패널 (M4 · D1 오른쪽 · 여행 중 문제 해결). 결과는 서버가 정하고, 화면은 같은 결과를 보여주기만 한다
import { api } from '../api.js';
import { COPY } from '../copy.js';
import { $, OTHER, esc, nameOf, reducedMotion, toast, who } from '../ui.js';

const FILL = { A: 'var(--person-1-tint)', B: 'var(--person-2-tint)', both: 'var(--common-tint)' };
const spun = new Set();   // 같은 결과로 바퀴를 두 번 돌리지 않기 위해 기억

function wheel(r) {
  const seg = 360 / r.options.length;
  const stops = r.options.map((o, i) => {
    const color = FILL[o.owner] || (i % 2 ? '#FFFFFF' : 'var(--fog)');
    return `${color} ${i * seg}deg ${(i + 1) * seg}deg`;
  }).join(', ');
  const lines = r.options.map((_, i) => `<line x1="50" y1="50" x2="${50 + 50 * Math.sin((i * seg * Math.PI) / 180)}" y2="${50 - 50 * Math.cos((i * seg * Math.PI) / 180)}" stroke="#1E2433" stroke-width="0.8"/>`).join('');
  const nums = r.options.map((_, i) => {
    const a = ((i + 0.5) * seg * Math.PI) / 180;
    return `<text x="${50 + 34 * Math.sin(a)}" y="${50 - 34 * Math.cos(a) + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#1E2433">${i + 1}</text>`;
  }).join('');
  return `<div class="wheel-wrap" aria-hidden="true"><span class="wheel-pointer">▼</span>
    <div class="wheel" style="background:conic-gradient(${stops})"><svg viewBox="0 0 100 100" width="100%" height="100%">${lines}${nums}</svg></div></div>`;
}

function optionList(trip, r) {
  return `<ol class="opt-list">${r.options.map((o, i) => `<li><span class="opt-swatch" style="background:${FILL[o.owner] || 'var(--fog)'}"></span>
    <span><b>${i + 1}</b> ${esc(o.label)}</span> ${o.owner ? who(trip, o.owner) : ''}</li>`).join('')}</ol>`;
}

export function rouletteHtml(trip) {
  const r = trip.roulette;
  const c = COPY.roulette;
  const partner = nameOf(trip, OTHER[trip.me]);
  if (!r) return '';
  const result = r.options.find((o) => o.id === r.result);
  const me = trip.me, other = OTHER[me];
  let action = '';
  if (r.applied) {
    action = `<div class="result-box celebrate stack"><p class="strong">${c.applied}</p><p class="t-title-2">${esc(result?.label)}</p>
      <button class="btn btn-sm" data-r="close">${c.close}</button></div>`;
  } else if (result) {
    action = `<div class="result-box stack" id="r-result"><p class="t-title-2">${esc(result.label)}</p>
      ${result.owner ? `<p>${who(trip, result.owner)}</p>` : ''}
      <div class="row"><button class="btn btn-primary btn-sm" data-r="accept" ${r.accepted[me] ? 'disabled' : ''}>${c.accept}</button>
      <button class="btn btn-sm" data-r="again" ${r.again[me] || r.spins >= r.max ? 'disabled' : ''}>${c.again}</button></div>
      ${r.accepted[me] && !r.accepted[other] ? `<p class="caption">${esc(c.acceptWait(partner))}</p>` : ''}
      ${r.again[me] && !r.again[other] ? `<p class="caption">${esc(c.againWait(partner))}</p>` : ''}</div>`;
  } else {
    action = `<button class="btn btn-primary btn-block" data-r="ready" ${r.ready[me] ? 'disabled' : ''}>${r.ready[me] ? c.ready : c.spin}</button>
      ${r.ready[me] && !r.ready[other] ? `<p class="caption">${esc(c.waitingFor(partner))}</p>` : ''}`;
  }
  const state = (side) => `<div class="state">${who(trip, side)}<br>${r.ready[side] ? c.statusReady : c.statusNot}</div>`;
  return `<div class="stack" id="roulette">
    <h2>${esc(r.title)}</h2>
    ${r.note ? `<p class="notice">${esc(r.note)}</p>` : ''}
    ${trip.test ? `<p class="notice">${c.together}</p>` : ''}
    ${wheel(r)}
    ${optionList(trip, r)}
    ${trip.test ? '' : `<div class="ready-row">${state('A')}${state('B')}</div>`}
    ${action}
    <p class="caption">${esc(c.rule(r.max))}</p>
  </div>`;
}

// 결과가 새로 나왔을 때 한 번만 회전. 모션 줄이기 설정이면 결과만 보여준다
export function spinIfNew(trip, root) {
  const r = trip.roulette;
  if (!r || !r.result) return;
  const key = `${r.key}:${r.spins}`;
  const el = $('.wheel', root);
  const idx = r.options.findIndex((o) => o.id === r.result);
  const seg = 360 / r.options.length;
  const deg = 360 * 5 - (idx + 0.5) * seg;
  if (spun.has(key) || reducedMotion()) {
    el.style.transition = 'none';
    el.style.transform = `rotate(${deg}deg)`;
    spun.add(key);
    return;
  }
  spun.add(key);
  const box = $('#r-result', root);
  if (box) box.style.visibility = 'hidden';
  requestAnimationFrame(() => { el.style.transform = `rotate(${deg}deg)`; });
  setTimeout(() => { if (box) box.style.visibility = ''; }, 2400);
}

export function bindRoulette(root, id, refresh) {
  root.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api(`/trips/${id}/roulette/${b.dataset.r}`, { method: 'POST', trip: id });
      await refresh();
    } catch (err) { toast(err.message); b.disabled = false; }
  }));
}

export async function openRoulette(id, key) {
  await api(`/trips/${id}/roulette`, { method: 'POST', trip: id, body: { key } });
}
