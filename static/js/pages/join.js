// 초대 링크로 들어온 사람(B)의 참여
import { api, session } from '../api.js';
import { COPY } from '../copy.js';
import { $, actionbar, toast } from '../ui.js';

export function render(main, id, invite) {
  if (session.get(id)) {
    location.hash = `#/t/${id}/survey`;
    return;
  }
  const j = COPY.join;
  main.innerHTML = `<div class="wrap narrow page stack">
    <h1>${j.title}</h1>
    <p class="muted">${COPY.home.sub}</p>
    <form id="join" class="card stack" novalidate>
      <div class="field"><label for="nickname">${j.nickname}</label>
        <input class="input" id="nickname" name="nickname" maxlength="12" required autocomplete="nickname">
        <p class="field-error" id="nickname-err" aria-live="polite"></p></div>
    </form></div>
    ${actionbar(`<button class="btn btn-primary" form="join">${j.submit}</button>`)}`;

  $('#join').onsubmit = async (e) => {
    e.preventDefault();
    const nickname = $('#nickname').value.trim();
    if (!nickname) {
      $('#nickname').setAttribute('aria-invalid', 'true');
      $('#nickname-err').textContent = COPY.create.needNick;
      return $('#nickname').focus();
    }
    try {
      const res = await api(`/trips/${id}/join`, { method: 'POST', body: { invite, nickname } });
      session.set(id, { token: res.token, member: 'B', region: '', date: '' });
      location.hash = `#/t/${id}/survey`;
    } catch (err) {
      toast(err.message);
    }
  };
}
