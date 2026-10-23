// M1 여행 만들기 (지역·날짜·출발/종료 지점·이동수단·닉네임)
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { $, actionbar, esc, toast } from '../ui.js';

export function render(main, regionParam) {
  const c = COPY.create;
  const quick = new URLSearchParams(sessionStorage.getItem('tt.quick') || '');
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const region = regionParam ? decodeURIComponent(regionParam) : quick.get('region') || '강릉';
  main.innerHTML = `<div class="wrap narrow page">
    <form id="create" class="stack" novalidate>
      <h1>${c.title}</h1>
      ${field('region', c.region, `<input class="input" id="region" name="region" value="${esc(region)}" required autocomplete="off">`)}
      ${field('date', c.date, `<input class="input" id="date" name="date" type="date" min="${today}" value="${esc(quick.get('date') || today)}" required>`)}
      ${field('start', c.start, `<input class="input" id="start" name="start" placeholder="예: 강릉역" autocomplete="off">`)}
      ${field('end', c.end, `<input class="input" id="end" name="end" placeholder="예: 숙소 이름" autocomplete="off">`)}
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="strong" style="margin-bottom:6px">${c.transport}</legend>
        <label class="choice on" style="max-width:240px"><input type="radio" name="transport" value="car" checked><span class="check" aria-hidden="true"></span>${c.car}</label>
        <p class="caption">${c.otherSoon}</p></fieldset>
      ${field('nickname', c.nickname, `<input class="input" id="nickname" name="nickname" maxlength="12" required autocomplete="nickname">`, c.nickHint)}
    </form></div>
    ${actionbar(`<button class="btn btn-primary" form="create">${c.submit}</button>`)}`;

  $('#create').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const errors = { region: !f.region.trim() && c.needRegion, date: !f.date && c.needDate, nickname: !f.nickname.trim() && c.needNick };
    let first = null;
    for (const [k, msg] of Object.entries(errors)) {
      const input = $(`#${k}`);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      $(`#${k}-err`).textContent = msg || '';
      if (msg && !first) first = input;
    }
    if (first) return first.focus();
    const btn = $('.actionbar .btn-primary');
    btn.disabled = true;
    try {
      const res = await api('/trips', { method: 'POST', body: f });
      session.set(res.id, { token: res.token, member: 'A', region: f.region, date: f.date });
      sessionStorage.removeItem('tt.quick');
      location.hash = `#/t/${res.id}/invite`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };
}

function field(id, label, input, hint = '') {
  return `<div class="field"><label for="${id}">${label}</label>${input}
    ${hint ? `<p class="caption">${hint}</p>` : ''}<p class="field-error" id="${id}-err" aria-live="polite"></p></div>`;
}
