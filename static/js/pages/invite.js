// M1 초대 링크 공유 + 두 사람 참여 상태
import { api } from '../api.js';
import { COPY } from '../copy.js';
import { $, actionbar, esc, nameOf, toast } from '../ui.js';
import { loadTrip, poll } from '../trip.js';

export async function render(main, id) {
  const trip = await loadTrip(main, id);
  if (!trip) return;
  const v = COPY.invite;

  const draw = (t) => {
    const link = t.invite ? `${location.origin}/${t.invite.path}` : '';
    const status = (side, shape) => `<li class="row"><span class="who ${shape}">${esc(t.members[side].nickname || (side === 'B' ? '동행자' : ''))}</span>
      <span class="tag">${t.members[side].joined ? v.joined : v.waiting}</span></li>`;
    main.innerHTML = `<div class="wrap narrow page stack">
      <h1>${v.title}</h1>
      <div class="card stack">
        <p><span class="strong">${esc(t.region)}</span> · ${esc(t.date)} · 자동차${t.startName ? ` · ${esc(t.startName)} 출발` : ''}</p>
        <ul class="stack" style="padding:0;margin:0;list-style:none">${status('A', 'shape-a')}${status('B', 'shape-b')}</ul>
      </div>
      ${t.members.B.joined ? `<p class="notice">${esc(nameOf(t, 'B'))}님이 들어왔어요. 이제 각자 답하러 가요</p>` : link ? `
      <div class="card stack">
        <label class="strong" for="link">초대 링크</label>
        <input class="input" id="link" value="${esc(link)}" readonly>
        <div class="row"><button class="btn" id="copy">${v.copy}</button>
          ${navigator.share ? `<button class="btn" id="share">${v.share}</button>` : ''}
          ${t.me === 'A' ? `<button class="link-btn" id="reissue">${v.reissue}</button>` : ''}</div>
        <p class="caption">${v.safe}</p>
      </div>` : ''}
    </div>
    ${actionbar(`<a class="btn btn-primary" href="#/t/${id}/survey">${v.next}</a>`)}`;

    $('#copy')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); } catch { $('#link').select(); document.execCommand('copy'); }
      toast(v.copied);
    });
    $('#share')?.addEventListener('click', () => navigator.share({ title: COPY.brand, text: '같이 여행 코스 짜볼래요?', url: link }).catch(() => {}));
    $('#reissue')?.addEventListener('click', async () => {
      try {
        await api(`/trips/${id}/invite`, { method: 'POST', trip: id });
        draw(await api(`/trips/${id}`, { trip: id }));
        toast(v.reissued);
      } catch (err) { toast(err.message); }
    });
  };
  draw(trip);
  let joined = trip.members.B.joined;
  return poll(id, 4000, (t) => { if (t.members.B.joined !== joined) { joined = t.members.B.joined; draw(t); } });
}
