// 여행방 화면 공통: 불러오기·권한 오류 처리·주기적 새로고침
import { api, session } from './api.js';
import { errorView, loading } from './ui.js';

export async function loadTrip(main, id) {
  if (!session.get(id)) {
    main.innerHTML = errorView({ status: 403 });
    return null;
  }
  main.innerHTML = `<div class="wrap page">${loading()}</div>`;
  try {
    return await api(`/trips/${id}`, { trip: id });
  } catch (err) {
    main.innerHTML = errorView(err, true);
    main.querySelector('[data-retry]')?.addEventListener('click', () => location.reload());
    return null;
  }
}

// 두 사람 화면을 맞추기 위한 짧은 주기 새로고침. 화면을 떠나면 멈춘다
export function poll(id, ms, onTrip) {
  let alive = true;
  const tick = async () => {
    if (!alive) return;
    if (!document.hidden) {
      try { onTrip(await api(`/trips/${id}`, { trip: id })); } catch { /* 다음 주기에 다시 시도 */ }
    }
    if (alive) timer = setTimeout(tick, ms);
  };
  let timer = setTimeout(tick, ms);
  return () => { alive = false; clearTimeout(timer); };
}

// 여행 상태에 맞는 다음 화면
export function nextRoute(trip) {
  if (trip.confirmed) return 'go';
  if (trip.compare) return trip.course ? 'course' : 'compare';
  return 'survey';
}
