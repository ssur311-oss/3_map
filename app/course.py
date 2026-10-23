"""코스 초안 3종 만들기와 동선 계산. 우선순위: 필수 조건 → 양쪽 만족 → 이동 부담 → 취향 균형."""
import math

from . import fairness, kakao

STAY_MIN = {"AT4": 60, "CT1": 70, "FD6": 60, "CE7": 40}
START_MIN = {"early": 9 * 60, "morning": 10 * 60 + 30, "noon": 12 * 60}
TYPES = {
    "fair": {"title": "공평형", "summary": "두 분 취향을 번갈아 담았어요"},
    "less-walk": {"title": "이동 부담 낮춤", "summary": "가까운 곳끼리 묶어 이동을 줄였어요"},
    "relaxed": {"title": "느긋한 코스", "summary": "한 곳에 오래 머물고 자주 쉬어요"},
}


def straight_m(a, b):
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = p2 - p1, math.radians(b["lng"] - a["lng"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(h)))


def _select(cands, n, first_owner, near=None):
    pool = {k: [p for p in cands if p["owner"] == k] for k in ("both", "A", "B", "neutral")}
    if near:
        for k in pool:
            pool[k].sort(key=lambda p: straight_m(near, p))
    picks = pool["both"][: max(1, n // 3)]
    turn = [first_owner, "B" if first_owner == "A" else "A"]
    i = 0
    while len(picks) < n and (pool["A"] or pool["B"]):
        side = turn[i % 2]
        i += 1
        rest = [p for p in pool[side] if p not in picks]
        if rest:
            picks.append(rest[0])
            pool[side].remove(rest[0])
        elif not [p for p in pool[turn[i % 2]] if p not in picks]:
            break
    for p in pool["both"] + pool["neutral"]:
        if len(picks) >= n:
            break
        if p not in picks:
            picks.append(p)
    # 식사는 필수 조건에 가깝게 다룬다. 음식점이 하나도 없으면 마지막 장소를 음식점으로 바꾼다
    if picks and not any(p["category"] == "FD6" for p in picks):
        food = [p for p in cands if p["category"] == "FD6" and p not in picks]
        if food:
            food.sort(key=lambda p: ("both", "A", "B", "neutral").index(p["owner"]))
            picks[-1] = food[0]
    return picks


def _order(picks, origin, meal_idx):
    left, out, cur = list(picks), [], origin or (picks[0] if picks else None)
    while left:
        nxt = min(left, key=lambda p: straight_m(cur, p))
        out.append(nxt)
        left.remove(nxt)
        cur = nxt
    food = next((p for p in out if p["category"] == "FD6"), None)
    if food:
        out.remove(food)
        out.insert(min(meal_idx, len(out)), food)
    return out


def _with_rest(places, rest, relaxed):
    every = {"often": 2, "sometimes": 3}.get(rest, 0)
    if relaxed and not every:
        every = 3
    stops = []
    for i, p in enumerate(places):
        stops.append({"kind": "place", "place": p})
        if every and (i + 1) % every == 0 and i + 1 < len(places):
            stops.append({"kind": "rest", "minutes": 30 if relaxed else 20})
    return stops


def draft(kind, cands, eff, trip):
    n = 4 if kind != "fair" or eff["walking"] == "low" else 5
    first = "A" if sum(map(ord, trip["id"])) % 2 == 0 else "B"
    origin = trip.get("start") or None
    near = (origin or trip.get("center")) if kind == "less-walk" else None
    picks = _select(cands, n, first, near)
    meal_idx = {"noon": 0, "morning": 1}.get(eff["start"], 2)
    ordered = _order(picks, origin, meal_idx)
    stops = _with_rest(ordered, eff["rest"], kind == "relaxed")
    return build(kind, stops, eff, trip)


def from_places(picks, eff, trip):
    """사용자가 직접 고른 장소로 코스를 만든다. 순서는 사용자가 아니라 앱이 정한다."""
    meal_idx = {"noon": 0, "morning": 1}.get(eff["start"], 2)
    stops = _with_rest(_order(picks, trip.get("start"), meal_idx), eff["rest"], False)
    return build("fair", stops, eff, trip)


def build(kind, stops, eff, trip):
    """초안이든 편집본이든 같은 방식으로 이동 정보·시간표·균형 설명을 붙인다."""
    relaxed = kind == "relaxed"
    points = ([trip["start"]] if trip.get("start") else []) + \
             [s["place"] for s in stops if s["kind"] == "place"] + \
             ([trip["end"]] if trip.get("end") else [])
    legs = []
    for a, b in zip(points, points[1:]):
        r = kakao.route(a, b)
        legs.append({"straight": straight_m(a, b),
                     "distance": r["distance"] if r else None,
                     "duration": r["duration"] if r else None})
    known = all(l["duration"] is not None for l in legs)

    minute = START_MIN.get(eff["start"], 10 * 60) + (30 if relaxed else 0)
    leg_i = 1 if trip.get("start") else 0
    if trip.get("start") and legs:
        minute += (legs[0]["duration"] or 0) // 60
    for s in stops:
        if s["kind"] == "rest":
            s["stay"] = s["minutes"] * 60
        else:
            base = STAY_MIN.get(s["place"]["category"], 50)
            s["stay"] = int(base * (1.3 if relaxed else 1)) * 60
        s["time"] = f"{minute // 60:02d}:{minute % 60:02d}" if known else None
        minute += s["stay"] // 60
        if s["kind"] == "place":
            if leg_i < len(legs):
                minute += (legs[leg_i]["duration"] or 0) // 60
            leg_i += 1

    count = len([s for s in stops if s["kind"] == "place"])
    km = sum((l["distance"] or l["straight"]) for l in legs) / 1000
    score = count + km / 15
    level = "가벼움" if score <= 5 else "보통" if score <= 7 else "무거움"
    drive = sum(l["duration"] or 0 for l in legs) // 60
    burden = {
        "level": level, "steps": {"가벼움": 1, "보통": 2, "무거움": 3}[level],
        "text": (f"자동차로 약 {drive}분 (추정) · 장소 {count}곳" if known
                 else f"직선거리 약 {km:.1f}km · 실제 이동 시간은 불러오지 못했어요"),
    }
    notes = []
    if eff["walking"] == "low" and count >= 5:
        notes.append({"kind": "walking", "text": "걷는 양이 편한 범위보다 조금 많을 수 있어요"})
    return {
        "type": kind, **TYPES[kind], "stops": stops, "legs": legs, "timesKnown": known,
        "burden": burden, "balance": fairness.describe(stops, trip), "notes": notes,
    }
