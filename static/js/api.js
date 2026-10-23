// 서버 호출과 여행방 세션(내 토큰) 보관. 토큰은 내 브라우저에만 두고 링크에는 넣지 않는다.
const KEY = (id) => `tt.trip.${id}`;

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 사생활 모드 등에서는 저장을 건너뛴다 */ }
}

export const session = {
  get: (id) => read(KEY(id)),
  set(id, data) {
    write(KEY(id), data);
    const list = (read('tt.trips') || []).filter((t) => t.id !== id);
    list.unshift({ id, region: data.region, date: data.date, test: !!data.test });
    write('tt.trips', list.slice(0, 10));
  },
  list: () => read('tt.trips') || [],
  flag: (name) => read(`tt.flag.${name}`),
  setFlag: (name) => write(`tt.flag.${name}`, true),
  draft: (id) => read(`tt.draft.${id}`),
  setDraft: (id, v) => write(`tt.draft.${id}`, v),
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, trip } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (trip) {
    const s = session.get(trip);
    if (s) headers['X-Member-Token'] = s.token;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, '연결이 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || '잠시 문제가 생겼어요. 다시 시도해 주세요');
  return data;
}

let configCache;
export async function config() {
  configCache ||= api('/config').catch(() => ({ jsKey: '', hasRestKey: false }));
  return configCache;
}

let questionsCache;
export async function questions() {
  questionsCache ||= api('/questions').then((d) => d.questions);
  return questionsCache;
}
