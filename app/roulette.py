"""룰렛. 결과는 서버에서 한 번만 정하고 두 사람에게 같은 값을 보여준다. 개인별 이력은 남기지 않는다."""
import random

from . import store
from .compare import roulette_options
from .course import build, straight_m
from .places import with_owner
from .trips import ApiError, both_submitted, eff

MAX_SPINS = 3
_rng = random.SystemRandom()


def _trip_options(trip):
    c = trip["course"]
    places = [s["place"] for s in c["stops"] if s["kind"] == "place"]
    left = places[trip["goIndex"]:]
    if not left:
        raise ApiError(409, "남은 장소가 없어요")
    nxt = left[0]
    used = {p["id"] for p in places}
    # 너무 멀면 남은 시간 안에 못 가므로 다음 장소 5km 안의 후보만 넣는다
    near = [p for p in with_owner(trip.get("places") or [], eff(trip))
            if p["id"] not in used and straight_m(nxt, p) <= 5000]
    near.sort(key=lambda p: straight_m(nxt, p))
    alts, note = [], None
    for side in ("A", "B"):
        alts += [p for p in near if p["owner"] == side][:1]
    alts += [p for p in near if p["owner"] == "both"][:1]
    sides = {p["owner"] for p in alts}
    if alts and not ({"A", "B"} <= sides or "both" in sides):
        note = "근처에 한쪽 취향 후보만 있어서 그쪽 장소만 들어갔어요"
    opts = [{"id": f'stop:{p["id"]}', "label": f'{p["name"]} 먼저 가기', "owner": p["owner"]}
            for p in left[1:3]]
    opts += [{"id": f'alt:{p["id"]}', "label": f'{p["name"]}(으)로 바꾸기', "owner": p["owner"]}
             for p in alts]
    opts += [{"id": "skip", "label": "이 장소 건너뛰기", "owner": None},
             {"id": "rest", "label": "쉬는 시간 넣기", "owner": None}]
    return opts, f'{nxt["name"]} 대신 어떻게 할까요?', note


def open_(trip_id, key):
    def fn(trip):
        if not both_submitted(trip):
            raise ApiError(409, "두 사람의 답이 모두 끝나야 룰렛을 쓸 수 있어요")
        if key == "trip":
            if not trip["confirmed"]:
                raise ApiError(409, "확정된 코스가 있어야 해요")
            opts, title, note = _trip_options(trip)
        elif key.startswith("diff:"):
            opts, title = roulette_options(key[5:], trip["members"]["A"]["answers"],
                                           trip["members"]["B"]["answers"])
            note = None
        else:
            raise ApiError(400, "알 수 없는 룰렛이에요")
        trip["roulette"] = {"key": key, "title": title, "note": note, "options": opts,
                            "ready": {"A": False, "B": False}, "again": {"A": False, "B": False},
                            "accepted": {"A": False, "B": False},
                            "result": None, "spins": 0, "max": MAX_SPINS, "applied": False}

    store.update(trip_id, fn)


def act(trip_id, me, action):
    def fn(trip):
        r = trip["roulette"]
        if not r:
            raise ApiError(409, "열린 룰렛이 없어요")
        # 테스트 모드는 두 사람이 한 화면을 같이 보는 상황이라, 한 번 누르면 둘 다 누른 것으로 친다
        sides = ("A", "B") if trip.get("test") else (me,)
        if action == "ready":
            for s in sides:
                r["ready"][s] = True
            if all(r["ready"].values()) and r["result"] is None:
                r["result"] = _rng.choice(r["options"])["id"]
                r["spins"] += 1
        elif action == "again":
            if r["spins"] >= MAX_SPINS:
                raise ApiError(409, f"다시 돌리기는 {MAX_SPINS}번까지예요")
            for s in sides:
                r["again"][s] = True
            if all(r["again"].values()):
                r.update(result=None, ready={"A": False, "B": False},
                         again={"A": False, "B": False}, accepted={"A": False, "B": False})
        elif action == "accept":
            for s in sides:
                r["accepted"][s] = True
            if all(r["accepted"].values()) and not r["applied"]:
                _apply(trip, r)
                r["applied"] = True
        elif action == "close":
            trip["roulette"] = None
        else:
            raise ApiError(400, "알 수 없는 동작이에요")

    store.update(trip_id, fn)


def _apply(trip, r):
    if r["key"].startswith("diff:"):
        trip["decisions"][r["key"][5:]] = r["result"]
        return
    c, res = trip["course"], r["result"]
    place_idx = [i for i, s in enumerate(c["stops"]) if s["kind"] == "place"]
    at = place_idx[trip["goIndex"]]
    stops = c["stops"]
    if res == "skip":
        stops.pop(at)
    elif res == "rest":
        stops.insert(at, {"kind": "rest", "minutes": 30})
    elif res.startswith("stop:"):
        j = next(i for i, s in enumerate(stops) if s["kind"] == "place" and s["place"]["id"] == res[5:])
        stops.insert(at, stops.pop(j))
    elif res.startswith("alt:"):
        p = next(p for p in with_owner(trip["places"], eff(trip)) if p["id"] == res[4:])
        stops[at] = {"kind": "place", "place": p}
    # 두 사람이 모두 '이걸로 갈게요'를 눌렀으므로 확정 상태는 유지하고 버전만 올린다
    rebuilt = build(c["type"], stops, eff(trip), trip)
    trip["course"] = {**rebuilt, "version": c["version"] + 1, "confirmedBy": ["A", "B"]}
