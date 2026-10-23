// 지도 컨트롤러. 카카오 JS SDK가 있으면 실제 지도, 없으면 방문 순서만 보여주는 간이 지도로 그린다.
// 두 경우 모두 같은 핀 DOM(pinEl)을 써서 색 + 도형 + 글자 규칙을 지킨다.
import { config } from './api.js';
import { esc, reducedMotion } from './ui.js';

let sdkPromise;
function loadSdk(key) {
  sdkPromise ||= new Promise((resolve, reject) => {
    if (window.kakao?.maps) return window.kakao.maps.load(() => resolve(window.kakao));
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao)) : reject());
    s.onerror = reject;
    document.head.append(s);
  });
  return sdkPromise;
}

const INNER = { A: '●', B: '◆', both: '●◆', neutral: '<span>•</span>' };

export function pinEl(pin, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `pin pin-${pin.kind.toLowerCase()}`;
  b.dataset.id = pin.id;
  b.setAttribute('aria-label', pin.alt || pin.title);
  let inner = INNER[pin.kind] || '';
  if (pin.kind === 'search') inner = `<span>${esc(pin.label)}</span>`;
  if (pin.kind === 'util') inner = esc(pin.label);
  if (pin.kind === 'stop') {
    // 코스 장소는 실제 지도 위에서도 바로 읽히게 번호 + 이름 + 취향 도형을 함께 단 말풍선으로 그린다
    const owner = (pin.owner || 'neutral').toLowerCase();
    b.classList.add(`owner-${owner}`);
    const name = (pin.title || '').replace(/^\[|\]$/g, '');
    inner = `<i>${INNER[pin.owner] || '•'}</i><b>${esc(pin.label)}</b>${esc(name.length > 6 ? `${name.slice(0, 6)}…` : name)}`;
  }
  b.innerHTML = `<span class="pin-body" aria-hidden="true">${inner}</span>`;
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick?.(pin.id); });
  return b;
}

function markSelected(root, id, pins) {
  root.querySelectorAll('.pin').forEach((el) => {
    const on = el.dataset.id === id;
    el.classList.toggle('selected', on);
    el.querySelector('.pin-bubble')?.remove();
    // 코스 핀은 이미 이름을 달고 있어 말풍선을 겹쳐 띄우지 않는다
    if (on && !el.classList.contains('pin-stop')) {
      const p = pins.find((x) => x.id === id);
      el.insertAdjacentHTML('beforeend', `<span class="pin-bubble" aria-hidden="true">${esc(p?.title)}</span>`);
    }
  });
}

export async function createMap(el, { onPinClick, firstDrop = false } = {}) {
  const { jsKey } = await config();
  el.innerHTML = '<div class="map-canvas"></div>';
  const canvas = el.firstElementChild;
  let kakao = null;
  if (jsKey) {
    try { kakao = await loadSdk(jsKey); } catch { kakao = null; }
  }
  return kakao ? kakaoMap(kakao, canvas, onPinClick, firstDrop) : miniMap(canvas, onPinClick, firstDrop);
}

function dropDelay(pin, i) {
  // 지도 첫 진입: 공통 핀이 먼저, 사람별 핀은 그다음 (가이드 7-5 ①)
  return (pin.kind === 'both' ? 0 : 250) + Math.min(i, 12) * 30;
}

function kakaoMap(kakao, canvas, onPinClick, firstDrop) {
  const map = new kakao.maps.Map(canvas, { center: new kakao.maps.LatLng(37.5665, 126.978), level: 7 });
  let overlays = [], line = null, pins = [], dropped = !firstDrop;
  return {
    real: true,
    render({ pins: next, route = [], fit = true }) {
      overlays.forEach((o) => o.setMap(null));
      line?.setMap(null);
      pins = next;
      const bounds = new kakao.maps.LatLngBounds();
      overlays = pins.map((p, i) => {
        const node = pinEl(p, onPinClick);
        if (!dropped && !reducedMotion()) { node.classList.add('drop'); node.style.animationDelay = `${dropDelay(p, i)}ms`; }
        const pos = new kakao.maps.LatLng(p.lat, p.lng);
        bounds.extend(pos);
        return new kakao.maps.CustomOverlay({ position: pos, content: node, xAnchor: 0.5, yAnchor: 1, zIndex: p.kind === 'stop' ? 3 : 2, map });
      });
      dropped = true;
      if (route.length > 1) {
        // 직선은 실제 길이 아니라 방문 순서다. 점선으로 그려 구분한다
        line = new kakao.maps.Polyline({ map, path: route.map((r) => new kakao.maps.LatLng(r.lat, r.lng)), strokeWeight: 3, strokeColor: '#1E2433', strokeOpacity: 0.9, strokeStyle: 'shortdash' });
      }
      if (fit && pins.length) map.setBounds(bounds, 40, 40, 40, 40);
    },
    select(id) {
      markSelected(canvas, id, pins);
      const p = pins.find((x) => x.id === id);
      if (p) map.panTo(new kakao.maps.LatLng(p.lat, p.lng));
    },
    zoom(d) { map.setLevel(map.getLevel() + d, { animate: !reducedMotion() }); },
    relayout() { map.relayout(); },
    center() { const c = map.getCenter(); return { lat: c.getLat(), lng: c.getLng() }; },
  };
}

function miniMap(canvas, onPinClick, firstDrop) {
  canvas.classList.add('mini-map');
  let pins = [], dropped = !firstDrop, last = null;
  const api = {
    real: false,
    render({ pins: next, route = [] }) {
      pins = next;
      last = { pins: next, route };
      const all = [...pins, ...route];
      if (!all.length) { canvas.innerHTML = ''; return; }
      const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng);
      const [minLa, maxLa, minLn, maxLn] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
      const pos = (p) => ({
        // 코스 핀은 이름표가 넓어 가장자리에서 잘리지 않게 좌우 여백을 넉넉히 둔다
        x: 14 + ((p.lng - minLn) / ((maxLn - minLn) || 1)) * 72,
        y: 14 + (1 - (p.lat - minLa) / ((maxLa - minLa) || 1)) * 70,
      });
      const pts = route.map(pos).map((q) => `${q.x},${q.y}`).join(' ');
      canvas.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}" fill="none" stroke="#1E2433" stroke-width="3" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/></svg>
        <p class="note">간이 지도예요. 위치는 대략적인 배치이고 선은 방문 순서예요</p>`;
      pins.forEach((p, i) => {
        const node = pinEl(p, onPinClick);
        const q = pos(p);
        node.style.left = `${q.x}%`;
        node.style.top = `${q.y}%`;
        if (!dropped && !reducedMotion()) { node.classList.add('drop'); node.style.animationDelay = `${dropDelay(p, i)}ms`; }
        canvas.append(node);
      });
      dropped = true;
    },
    select(id) { markSelected(canvas, id, pins); },
    zoom() {},
    relayout() { if (last) api.render(last); },
    center() { return pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : null; },
  };
  return api;
}
