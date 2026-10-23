// W1 로그인(준비 중 안내) · 내 여행 목록
import { session } from '../api.js';
import { COPY } from '../copy.js';
import { esc } from '../ui.js';

export function render(main) {
  const l = COPY.login;
  main.innerHTML = `<div class="wrap narrow page"><div class="card sticker stack" style="max-width:440px;margin:0 auto">
    <h1>${l.title}</h1>
    <p class="notice">${l.soon}</p>
    <button class="btn btn-block" disabled>${l.kakao}</button>
    <button class="btn btn-block" disabled>${l.naver}</button>
    <button class="btn btn-block" disabled>${l.email}</button>
    <a class="btn btn-primary btn-block" href="#/new">${l.nick}</a>
    <p class="caption">${l.invited}</p>
  </div></div>`;
}

export function mine(main) {
  const list = session.list();
  const m = COPY.mine;
  main.innerHTML = `<div class="wrap narrow page stack"><h1>${m.title}</h1>
    ${list.length ? list.map((t) => `<a class="card row" style="text-decoration:none" href="#/t/${esc(t.id)}/${t.test ? 'course' : 'survey'}">
        <div><h3>${esc(t.region)}${t.test ? ' <span class="tag tag-demo">테스트</span>' : ''}</h3><p class="caption">${esc(t.date)}</p></div><span class="spacer"></span><span class="btn btn-sm">${m.open}</span></a>`).join('')
      : `<div class="card empty stack"><p>${m.empty}</p><a class="btn btn-primary" href="#/new">${COPY.nav.create}</a></div>`}
  </div>`;
}
