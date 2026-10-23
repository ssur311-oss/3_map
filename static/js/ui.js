// 공통 UI 도우미: 이스케이프, 이름 라벨, 토스트, 바텀시트, 상태 화면
import { COPY } from './copy.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const OTHER = { A: 'B', B: 'A' };
export const nameOf = (trip, side) => trip.members[side]?.nickname || (side === 'A' ? '만든 사람' : '동행자');

// 사람 색은 참여자에게 고정한다 (A=초대한 사람 ●, B=초대받은 사람 ◆)
export function who(trip, owner) {
  if (owner === 'A') return `<span class="who shape-a">${esc(nameOf(trip, 'A'))}</span>`;
  if (owner === 'B') return `<span class="who shape-b">${esc(nameOf(trip, 'B'))}</span>`;
  if (owner === 'both') return `<span class="who shape-both">둘 다</span>`;
  return `<span class="who shape-neutral">누구나</span>`;
}

export function ownerText(trip, owner) {
  if (owner === 'A' || owner === 'B') return `${nameOf(trip, owner)}님이 좋아할 곳`;
  if (owner === 'both') return '둘 다 좋아할 곳';
  return '어느 쪽 취향도 특별히 강하지 않은 곳';
}

let toastTimer;
export function toast(msg) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2800);
}

export function openSheet(html, { label = '' } = {}) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', label);
  sheet.innerHTML = `<div class="handle" aria-hidden="true"></div>${html}`;
  back.addEventListener('click', closeSheet);
  document.body.append(back, sheet);
  const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', onKey, { once: true });
  sheet.querySelector('button, input, a')?.focus();
  return sheet;
}

export function closeSheet() {
  $$('.sheet, .sheet-backdrop').forEach((el) => el.remove());
}

export const loading = (text = '불러오는 중이에요') => `<div class="loading" role="status">${esc(text)}</div>`;

export function errorView(err, retry) {
  const noAccess = err?.status === 403;
  return `<div class="wrap narrow page"><div class="card stack">
    <h2>${noAccess ? '들어갈 수 없어요' : '잠깐 문제가 생겼어요'}</h2>
    <p>${esc(noAccess ? COPY.error.noAccess : err?.message || COPY.error.load)}</p>
    <div class="row">${retry && !noAccess ? `<button class="btn btn-primary" data-retry>${COPY.error.retry}</button>` : ''}
    <a class="btn" href="#/">${COPY.error.home}</a></div></div></div>`;
}

export function actionbar(inner) {
  return `<div class="actionbar"><div class="inner">${inner}</div></div>`;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function km(m) {
  return (m / 1000).toFixed(m < 10000 ? 1 : 0);
}

export function straight(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dp = (b.lat - a.lat) * rad, dl = (b.lng - a.lng) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
