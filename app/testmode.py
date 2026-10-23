"""테스트 모드: 친구 초대 없이 혼자서 두 사람 몫을 채우고 바로 코스 지도까지 가 본다.

실제 여행방과 같은 저장·계산 경로를 그대로 쓰고, trip["test"]로만 구분한다.
"""
from . import demo_data, kakao, store
from .course import from_places
from .places import clean, with_owner
from .plan import ensure_places
from .trips import ApiError, create, eff

# 선호 코스 유형만 고르면 나머지 답은 무난한 값으로 채운다. 유형끼리 하나씩 겹치게 해 '둘 다' 핀도 보이게 한다
STYLE_ACTS = {
    "food": ["food", "cafe"],
    "view": ["nature", "cafe"],
    "many": ["nature", "culture", "food"],
    "relaxed": ["cafe", "nature"],
}
MAX_PLACES = 6


def _answers(style, companion):
    parent = companion == "parent"
    return {
        "style": style if style in STYLE_ACTS else "food",
        "walking": "low" if parent else "mid",
        "start": "morning",
        "budget": "mid",
        "activities": STYLE_ACTS.get(style, STYLE_ACTS["food"]),
        "rest": "often" if parent else "sometimes",
    }


def _names(raw):
    if isinstance(raw, str):
        raw = raw.replace("\n", ",").split(",")
    names = [str(n).strip()[:30] for n in (raw or [])]
    return [n for n in names if n][:MAX_PLACES]


def _find(trip, name):
    if trip.get("demo"):
        bare = lambda p: p["name"].strip("[]")  # noqa: E731
        hits = [p for p in demo_data.places() if bare(p) in name or name in bare(p)]
        return hits[0] if hits else None
    c = trip["center"]
    try:
        # 지역 이름을 붙여 찾고, 없으면 지역 중심 반경 안에서 다시 찾는다
        hits = kakao.keyword(f'{trip["region"]} {name}') or \
            kakao.keyword(name, c["lng"], c["lat"], radius=20000)
    except kakao.KakaoError:
        return None
    return hits[0] if hits else None


def create_test(body):
    trip, token = create({**body, "nickname": "A"})
    companion = body.get("with")

    def fill(t):
        t["test"] = True
        t["members"]["B"] = {"nickname": "B", "token": "", "answers": {}, "step": 0, "submitted": False}
        for side, style in (("A", body.get("styleA")), ("B", body.get("styleB"))):
            t["members"][side].update(answers=_answers(style, companion), submitted=True)

    store.update(trip["id"], fill)
    trip = ensure_places(trip["id"])

    names = _names(body.get("places"))
    found, missing, seen = [], [], set()
    for name in names:
        p = _find(trip, name)
        if p and p["id"] not in seen:
            seen.add(p["id"])
            found.append(p)
        elif not p:
            missing.append(name)
    if names and not found:
        raise ApiError(404, "입력한 장소를 찾지 못했어요. 장소 이름을 조금 더 정확히 적어주세요")

    if found:
        # 경로 계산은 시간이 걸려 저장 락 밖에서 먼저 만든다
        course = from_places(with_owner([clean(p) for p in found], eff(trip)), eff(trip), trip)

        def save(t):
            t["course"] = {**course, "version": 1, "confirmedBy": []}

        store.update(trip["id"], save)
    return {"id": trip["id"], "token": token, "member": "A", "missing": missing}
