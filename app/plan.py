"""후보 장소·코스 초안·코스 수정·확정·여행 중 진행."""
from . import demo_data, kakao, store
from .course import TYPES, build, draft
from .places import UTIL_CODES, clean, load_candidates, with_owner
from .trips import ApiError, both_submitted, eff


def _require_both(trip):
    if not both_submitted(trip):
        raise ApiError(409, "아직 두 사람의 답이 모두 끝나지 않았어요")


def ensure_places(trip_id):
    """후보 장소는 처음 한 번만 불러와 여행방에 저장한다 (로컬 API 쿼터 절약)."""
    trip = store.get(trip_id)
    if trip.get("places"):
        return trip
    center, places, demo = load_candidates(trip["region"])

    def fn(t):
        t["center"], t["places"], t["demo"] = center, places, demo

    trip, _ = store.update(trip_id, fn)
    return trip


def candidates(trip):
    _require_both(trip)
    return with_owner(trip["places"], eff(trip))


def drafts(trip):
    _require_both(trip)
    cands = with_owner(trip["places"], eff(trip))
    return [draft(kind, cands, eff(trip), trip) for kind in TYPES]


def _owned_stops(trip, stops):
    """수정본의 장소 주인은 화면 값을 믿지 않고 서버에서 다시 붙인다."""
    out = []
    for s in stops[:12]:
        if s.get("kind") == "rest":
            out.append({"kind": "rest", "minutes": max(10, min(120, int(s.get("minutes") or 30)))})
        elif s.get("kind") == "place":
            p = with_owner([clean(s["place"])], eff(trip))[0]
            out.append({"kind": "place", "place": p})
    return out


def save_course(trip_id, body):
    kind = body.get("type") if body.get("type") in TYPES else "fair"

    def fn(trip):
        _require_both(trip)
        stops = _owned_stops(trip, body.get("stops") or [])
        if not any(s["kind"] == "place" for s in stops):
            raise ApiError(400, "장소를 한 곳 이상 넣어주세요")
        version = (trip["course"] or {}).get("version", 0) + 1
        course = build(kind, stops, eff(trip), trip)
        # 코스를 고치면 버전을 올리고 두 사람 확인을 처음부터 다시 받는다
        trip["course"] = {**course, "version": version, "confirmedBy": []}
        trip["confirmed"] = False
        trip["goIndex"] = 0

    store.update(trip_id, fn)


def confirm(trip_id, me, version):
    def fn(trip):
        c = trip["course"]
        if not c:
            raise ApiError(409, "아직 저장된 코스가 없어요")
        if c["version"] != version:
            raise ApiError(409, "코스가 바뀌었어요. 바뀐 내용을 보고 다시 확인해 주세요")
        if trip.get("test"):
            # 테스트 모드는 상대가 없으니 혼자 두 사람 몫을 확인한다
            c["confirmedBy"] = ["A", "B"]
        elif me not in c["confirmedBy"]:
            c["confirmedBy"].append(me)
        trip["confirmed"] = len(c["confirmedBy"]) == 2

    store.update(trip_id, fn)


def arrive(trip_id):
    def fn(trip):
        if not trip["confirmed"]:
            raise ApiError(409, "확정된 코스가 없어요")
        total = len([s for s in trip["course"]["stops"] if s["kind"] == "place"])
        trip["goIndex"] = min(trip["goIndex"] + 1, total)

    store.update(trip_id, fn)


def search(trip, query, code, lat, lng):
    if trip.get("demo"):
        places = demo_data.search(query)
    else:
        try:
            if query:
                places = kakao.keyword(query, lng, lat, radius=10000, category=code or None)
            else:
                places = kakao.category(code or "AT4", lng, lat, radius=5000, sort="distance")
        except kakao.KakaoError:
            raise ApiError(502, "장소를 검색하지 못했어요. 잠시 뒤 다시 시도해 주세요")
    return with_owner(kakao.dedupe(places)[:15], eff(trip)) if both_submitted(trip) else places


def nearby(trip, code, lat, lng):
    if code not in UTIL_CODES:
        raise ApiError(400, "지원하지 않는 시설이에요")
    if trip.get("demo"):
        return demo_data.nearby(lat, lng, code)
    try:
        return kakao.category(code, lng, lat, radius=1500, sort="distance")[:5]
    except kakao.KakaoError:
        raise ApiError(502, "주변 시설을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요")
