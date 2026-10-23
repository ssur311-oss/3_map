// 해시 라우터 + 상단 네비 + 여행방 단계 표시
import { COPY } from './copy.js';
import { $, esc } from './ui.js';
import * as home from './pages/home.js';
import * as login from './pages/login.js';
import * as create from './pages/create.js';
import * as invite from './pages/invite.js';
import * as join from './pages/join.js';
import * as survey from './pages/survey.js';
import * as compare from './pages/compare.js';
import * as course from './pages/course.js';
import * as go from './pages/go.js';

// [패턴, 페이지, 여행방 단계(0~4) 또는 null]
const ROUTES = [
  [/^\/$/, home, null],
  [/^\/login$/, login, null],
  [/^\/mine$/, login.mine, null],
  [/^\/new(?:\/(\w+))?$/, create, 0],
  [/^\/join\/([\w-]+)\/([\w-]+)$/, join, 0],
  [/^\/t\/([\w-]+)\/invite$/, invite, 0],
  [/^\/t\/([\w-]+)\/survey$/, survey, 1],
  [/^\/t\/([\w-]+)\/compare$/, compare, 2],
  [/^\/t\/([\w-]+)\/course$/, course, 3],
  [/^\/t\/([\w-]+)\/go$/, go, 4],
];

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
  <path d="M3 24 C9 24 11 10 16 10" fill="none" stroke="#14808A" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M29 24 C23 24 21 10 16 10" fill="none" stroke="#7A4FB5" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="16" cy="10" r="4.5" fill="#F2C14E" stroke="#1E2433" stroke-width="1.5"/></svg>`;

function isBig() { return document.body.classList.contains('big'); }

function renderNav(path) {
  const n = COPY.nav;
  const links = [['#/', n.courses], ['#/mine', n.mine]];
  const linkHtml = links.map(([h, t]) => `<a href="${h}" ${('#' + path) === h ? 'aria-current="page"' : ''}>${t}</a>`).join('');
  $('#nav').innerHTML = `<nav class="nav" aria-label="주요 메뉴"><div class="wrap">
      <a class="logo" href="#/">${LOGO}<span>${COPY.brand}</span></a>
      <div class="nav-links">${linkHtml}</div>
      <div class="nav-tools">
        <button class="icon-btn" id="big-toggle" aria-pressed="${isBig()}" title="글자와 버튼을 크게 보여줘요">${n.big}</button>
        <a class="icon-btn nav-cta" href="#/login">${n.login}</a>
        <a class="btn btn-primary btn-sm nav-cta" href="#/new">${n.create}</a>
        <button class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="menu-panel">${n.menu}</button>
      </div></div>
      <div class="menu-panel" id="menu-panel" hidden>${linkHtml}<a href="#/login">${n.login}</a><a href="#/new">${n.create}</a></div>
    </nav>`;
  $('#big-toggle').onclick = () => {
    document.body.classList.toggle('big');
    try { localStorage.setItem('tt.big', isBig() ? '1' : ''); } catch { /* 저장 실패는 무시 */ }
    $('#big-toggle').setAttribute('aria-pressed', isBig());
  };
  $('#menu-toggle').onclick = (e) => {
    const panel = $('#menu-panel');
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  };
}

function renderTripBar(step) {
  const bar = $('#trip-bar');
  if (step === null) { bar.innerHTML = ''; return; }
  const items = COPY.steps.map((s, i) => {
    const cls = i < step ? 'done' : i === step ? 'now' : '';
    return `<li class="${cls}" ${i === step ? 'aria-current="step"' : ''}>${esc(s)}</li>`;
  }).join('');
  bar.innerHTML = `<div class="trip-bar"><div class="wrap"><ol class="stepper" aria-label="여행 진행 단계">${items}</ol></div></div>`;
}

let cleanup = null;

async function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  cleanup?.();
  cleanup = null;
  renderNav(path);
  const main = $('#main');
  for (const [re, page, step] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    renderTripBar(step);
    const render = page.render || page;
    window.scrollTo(0, 0);
    cleanup = (await render(main, ...m.slice(1))) || null;
    return;
  }
  renderTripBar(null);
  main.innerHTML = `<div class="wrap narrow page"><div class="card empty stack"><h2>없는 페이지예요</h2><p>홈에서 다시 시작해 볼까요?</p><a class="btn btn-primary" href="#/">홈으로</a></div></div>`;
}

try { if (localStorage.getItem('tt.big')) document.body.classList.add('big'); } catch { /* 무시 */ }
window.addEventListener('hashchange', route);
route();
