# 티키타카 트립

취향이 다른 두 사람이 각자 답하면 공통 취향과 차이를 보여주고, 두 사람 취향을 고르게 담은 국내 하루 코스를 제안하는 반응형 웹.

- 기술 스택: HTML · CSS · JavaScript(ES 모듈) · Python 3.10+ (표준 라이브러리만, 추가 설치 없음)
- 디자인: `design-guilde_v2.md` / 화면 구성: `반반여행_와이어프레임_화면설명.md`

## 실행

```bash
python server.py
# → http://localhost:8000
```

`.env` (커밋 금지, `.env.example` 참고)

| 키 | 용도 | 어디서 쓰나 |
|---|---|---|
| `KAKAO_REST_API_KEY` | 장소 검색 · 자동차 길찾기 | 서버(`app/kakao.py`)에서만. 브라우저로 내려가지 않음 |
| `KAKAO_JS_KEY` | 지도 표시 | 브라우저. 카카오 개발자 콘솔에 `http://localhost:8000` 도메인 등록 필요 |

- REST 키가 없거나 호출이 실패하면 **예시 장소**로 동작하고 화면에 `예시` 표시가 붙습니다.
- JS 키가 없으면 지도 대신 **간이 지도**(대략적인 배치 + 방문 순서 점선)로 보여줍니다.
- 길찾기 API가 실패하면 이동 시간을 지어내지 않고 직선거리만 표시합니다.

## 두 사람 테스트 방법

1. 브라우저 A에서 `같이 여행 만들기` → 초대 링크 복사
2. 다른 브라우저(또는 시크릿 창)에서 링크 열기 → 닉네임 입력
3. 둘 다 답하기 → 비교 · 룰렛 → 코스 → 둘 다 확인하면 확정 → 여행 화면

## 구조

```
server.py            HTTP 서버 · API 라우팅
app/
  env.py             .env 로더
  store.py           여행방 저장 (data/trips.json, DB 정해지면 이 파일만 교체)
  questions.py       온보딩 질문 목록 (화면도 /api/questions로 같은 목록 사용)
  trips.py           여행방 생성·초대·권한·답 저장, 상대 원본 답 숨기기
  compare.py         공통/차이 요약, 필수 조건 반영
  places.py          후보 장소 불러오기, 누구 취향인지(owner) 붙이기
  course.py          코스 초안 3종, 동선 순서, 이동 부담
  fairness.py        취향 균형 계산 (문장으로만 내보냄)
  plan.py            코스 저장·확정·도착·검색·주변 시설
  roulette.py        룰렛 (서버에서 한 번 정함, 두 사람 동의로 적용)
  kakao.py           카카오 로컬 · 모빌리티 REST 호출
  demo_data.py       키가 없을 때 쓰는 예시 장소
static/
  index.html
  css/               tokens(디자인 토큰) · base · components · layout · screens · map
  js/app.js          라우터 · 네비 · 단계 표시
  js/copy.js         화면 문구 모음
  js/map.js          카카오 지도 / 간이 지도, 핀
  js/pages/*.js      화면별 (home, create, invite, join, survey, compare, course, go …)
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/trips` | 여행 만들기 (A) |
| POST | `/api/trips/{id}/join` | 초대 링크로 참여 (B) |
| GET | `/api/trips/{id}` | 여행방 상태 (상대 원본 답·MBTI 제외) |
| PUT | `/api/trips/{id}/answers` | 답 저장/제출 |
| GET | `/api/trips/{id}/places` · `/drafts` | 후보 장소 · 코스 초안 3종 (둘 다 제출 후) |
| PUT | `/api/trips/{id}/course` | 코스 저장 (버전 +1, 확인 초기화) |
| POST | `/api/trips/{id}/confirm` | 최신 버전 확인 |
| POST | `/api/trips/{id}/roulette[/ready·again·accept·close]` | 룰렛 |
| GET | `/api/trips/{id}/search` · `/nearby` | 장소 검색 · 주변 시설 |

모든 여행방 API는 `X-Member-Token` 헤더로 권한을 검사합니다.
