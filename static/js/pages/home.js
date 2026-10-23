// W0 홈: 화면 전체를 코스 만들기로 쓴다. 기본은 초대 없이 바로 지도까지 가는 테스트 모드
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { $, esc, toast } from '../ui.js';

const options = (list, selected) => list.map(([v, t]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${t}</option>`).join('');

function field(id, label, input) {
  return `<div class="field"><label for="${id}">${label}</label>${input}<p class="field-error" id="${id}-err" aria-live="polite"></p></div>`;
}

export function render(main) {
  const h = COPY.home;
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  main.innerHTML = `
  <section class="maker"><div class="wrap">
    <form class="maker-card stack" id="maker" novalidate>
      <div class="maker-head">
        <span class="tag tag-demo">${h.testTag}</span>
        <h1>${esc(h.headline).replace('\n', '<br>')}</h1>
        <p class="muted">${h.sub}</p>
      </div>
      <div class="maker-grid">
        ${field('m-region', h.where, `<input class="input" id="m-region" name="region" value="강릉" autocomplete="off" required>`)}
        ${field('m-date', h.when, `<input class="input" id="m-date" name="date" type="date" min="${today}" value="${today}" required>`)}
        ${field('m-with', h.withWho, `<select class="input" id="m-with" name="with">${options(COPY.companions)}</select>`)}
        ${field('m-styleA', `<span class="who shape-a">${h.styleA}</span>`, `<select class="input" id="m-styleA" name="styleA">${options(COPY.styles, 'food')}</select>`)}
        ${field('m-styleB', `<span class="who shape-b">${h.styleB}</span>`, `<select class="input" id="m-styleB" name="styleB">${options(COPY.styles, 'view')}</select>`)}
      </div>
      <div class="field"><label for="m-places">${h.places}</label>
        <textarea class="input" id="m-places" name="places" rows="3" placeholder="${h.placesPh}"></textarea>
        <p class="caption">${h.placesHint}</p></div>
      <div class="maker-actions">
        <button class="btn btn-primary" id="m-go">${h.go}</button>
        <button class="btn" type="button" id="m-invite">${h.invite}</button>
      </div>
    </form>
  </div></section>`;

  const form = $('#maker');
  const values = () => Object.fromEntries(new FormData(form));
  const check = (f) => {
    const errors = { 'm-region': !f.region.trim() && h.needRegion, 'm-date': !f.date && h.needDate };
    let first = null;
    for (const [k, msg] of Object.entries(errors)) {
      $(`#${k}`).setAttribute('aria-invalid', msg ? 'true' : 'false');
      $(`#${k}-err`).textContent = msg || '';
      if (msg && !first) first = $(`#${k}`);
    }
    first?.focus();
    return !first;
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = values();
    if (!check(f)) return;
    const btn = $('#m-go');
    btn.disabled = true;
    btn.textContent = h.making;
    try {
      const res = await api('/trips/test', { method: 'POST', body: f });
      session.set(res.id, { token: res.token, member: 'A', region: f.region, date: f.date, test: true });
      if (res.missing?.length) toast(h.missing(res.missing.join(', ')));
      location.hash = `#/t/${res.id}/course`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = h.go;
    }
  };

  // 초대 흐름은 기존 여행 만들기 화면으로 넘기고, 입력한 지역·날짜는 이어서 쓴다
  $('#m-invite').onclick = () => {
    const f = values();
    sessionStorage.setItem('tt.quick', new URLSearchParams({ region: f.region, date: f.date, with: f.with }).toString());
    location.hash = '#/new';
  };
}
