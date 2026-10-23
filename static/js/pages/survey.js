// M2 각자 답하기 (한 화면 한 질문) + 데스크톱 오른쪽 스타일 미리보기 + 제출 후 기다리기
import { api, questions, session } from '../api.js';
import { COPY } from '../copy.js';
import { $, $$, OTHER, actionbar, esc, nameOf, reducedMotion, toast } from '../ui.js';
import { loadTrip, poll } from '../trip.js';
import { styleSummary } from '../style-summary.js';

export async function render(main, id) {
  const trip = await loadTrip(main, id);
  if (!trip) return;
  session.set(id, { ...session.get(id), region: trip.region, date: trip.date });
  if (trip.mySubmitted) return waiting(main, id, trip);

  const qs = await questions();
  const s = COPY.survey;
  const answers = { ...trip.myAnswers };
  answers._must ||= [];
  let step = Math.min(trip.myStep || 0, qs.length);   // 0 = 안내 화면, 1..n = 질문

  const save = (submit = false) => api(`/trips/${id}/answers`, { method: 'PUT', trip: id, body: { answers, step, submit } });

  const draw = () => {
    if (step === 0) {
      main.innerHTML = `<div class="wrap narrow page stack">
        <h1>${s.introTitle}</h1><p class="notice">${s.intro}</p></div>
        ${actionbar(`<button class="btn btn-primary" id="next">${s.start}</button>`)}`;
      $('#next').onclick = () => { step = 1; draw(); };
      return;
    }
    const q = qs[step - 1];
    const last = step === qs.length;
    main.innerHTML = `<div class="wrap page"><div class="split">
      <section class="stack" aria-labelledby="q-title">
        <div class="row"><div class="progress" style="flex:1" role="progressbar" aria-valuemin="0" aria-valuemax="${qs.length}" aria-valuenow="${step}" aria-label="질문 진행"><span style="width:${(step / qs.length) * 100}%"></span></div>
          <span class="caption">${step}/${qs.length}</span></div>
        <h1 id="q-title">${esc(q.title)}</h1>
        <p class="muted">${esc(q.hint)}</p>
        ${q.type === 'mbti' ? mbtiInput(answers.mbti) : choiceList(q, answers[q.key])}
        ${q.importance ? importance(q, answers) : ''}
      </section>
      <aside class="card sticky-side stack" aria-label="${s.previewTitle}">${preview(qs, answers)}</aside>
    </div></div>
    ${actionbar(`<button class="btn" id="prev">${s.prev}</button>
      ${q.optional ? `<button class="btn" id="skip">${s.skip}</button>` : ''}
      <button class="btn btn-primary" id="next" ${isAnswered(q, answers) ? '' : 'disabled'}>${last ? s.submit : s.next}</button>`)}`;
    bind(q, last);
  };

  const bind = (q, last) => {
    $$('.choice input').forEach((input) => input.addEventListener('change', () => {
      if (q.type === 'multi') {
        let v = $$('.choice input:checked').map((i) => i.value);
        // '상관없어요'와 다른 선택은 함께 두지 않는다
        if (input.value === 'any' && input.checked) v = ['any'];
        else v = v.filter((x) => x !== 'any');
        answers[q.key] = v;
      } else {
        answers[q.key] = input.value;
        if (input.value === 'any') answers._must = answers._must.filter((k) => k !== q.key);
      }
      draw();
      if (!reducedMotion()) $(`.choice input[value="${input.value}"]`)?.closest('.choice').classList.add('bounce');
      $(`.choice input[value="${input.value}"]`)?.focus();
    }));
    $$('[name="must"]').forEach((input) => input.addEventListener('change', () => {
      answers._must = answers._must.filter((k) => k !== q.key);
      if (input.value === 'must') answers._must.push(q.key);
    }));
    $('#mbti')?.addEventListener('input', (e) => {
      answers.mbti = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      $('#next').disabled = !isAnswered(q, answers);
    });
    $('#prev').onclick = () => { step -= 1; draw(); };
    $('#skip')?.addEventListener('click', () => { delete answers.mbti; next(last); });
    $('#next').onclick = () => next(last);
  };

  const next = async (last) => {
    try {
      if (last) {
        await save(true);
        // 같은 주소라 hashchange가 안 생기므로 라우터를 직접 다시 돌려 기다리기 화면(폴링 정리 포함)으로 간다
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }
      step += 1;
      await save();
      draw();
    } catch (err) { toast(err.message); }
  };
  draw();
}

function isAnswered(q, a) {
  if (q.optional) return !a.mbti || a.mbti.length === 4;
  return q.type === 'multi' ? (a[q.key] || []).length > 0 : !!a[q.key];
}

function choiceList(q, value) {
  const multi = q.type === 'multi';
  return `<div class="choices" role="${multi ? 'group' : 'radiogroup'}" aria-labelledby="q-title">${q.options.map(([v, t]) => {
    const on = multi ? (value || []).includes(v) : value === v;
    return `<label class="choice ${on ? 'on' : ''}"><input type="${multi ? 'checkbox' : 'radio'}" name="q" value="${v}" ${on ? 'checked' : ''}>
      <span class="check" aria-hidden="true"></span><span>${esc(t)}</span></label>`;
  }).join('')}</div>`;
}

function importance(q, a) {
  if (!a[q.key] || a[q.key] === 'any') return '';
  const must = a._must.includes(q.key);
  return `<fieldset class="row" style="border:0;padding:0;margin:0"><legend class="caption" style="margin-bottom:6px">이 조건은 얼마나 중요해요?</legend>
    <label class="chip" style="min-height:44px"><input type="radio" name="must" value="nice" ${must ? '' : 'checked'}> ${COPY.survey.nice}</label>
    <label class="chip" style="min-height:44px"><input type="radio" name="must" value="must" ${must ? 'checked' : ''}> ${COPY.survey.must}</label></fieldset>`;
}

function mbtiInput(v) {
  return `<div class="field"><label for="mbti" class="sr-only">MBTI</label>
    <input class="input" id="mbti" maxlength="4" placeholder="${COPY.survey.mbtiPh}" value="${esc(v || '')}" autocomplete="off" style="max-width:200px;text-transform:uppercase"></div>`;
}

function preview(qs, a) {
  const sum = styleSummary(qs, a);
  return `<p class="caption">${COPY.survey.previewTitle}</p><h2>${esc(sum.title)}</h2>
    <div class="chips">${sum.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
}

function waiting(main, id, trip) {
  const partner = OTHER[trip.me];
  if (trip.compare) { location.hash = `#/t/${id}/compare`; return; }
  const draw = (t) => {
    main.innerHTML = `<div class="wrap narrow page stack">
      <p class="badge-done">${COPY.survey.submitted}</p>
      <h1>${t.members[partner].joined ? esc(COPY.wait(nameOf(t, partner))) : COPY.waitJoin}</h1>
      ${!t.members[partner].joined && t.me === 'A' ? `<a class="btn" href="#/t/${id}/invite">${COPY.invite.title}</a>` : ''}
      <div class="loading" role="status">상대 답을 기다리는 중이에요</div>
    </div>`;
  };
  draw(trip);
  return poll(id, 3000, (t) => (t.compare ? (location.hash = `#/t/${id}/compare`) : draw(t)));
}
