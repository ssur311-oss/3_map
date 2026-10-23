"""취향 균형 계산은 이 모듈에서만 한다. 개수는 밖으로 내보내지 않고 문장으로만 돌려준다."""


def _counts(stops):
    out = {"A": 0, "B": 0, "both": 0}
    for s in stops:
        owner = s.get("place", {}).get("owner") if s["kind"] == "place" else None
        if owner in out:
            out[owner] += 1
    return out


def describe(stops, trip):
    c = _counts(stops)
    names = {k: (trip["members"].get(k) or {}).get("nickname", k) for k in ("A", "B")}
    if c["A"] == 0 and c["B"] == 0:
        return {"text": "둘 다 좋아할 만한 곳 위주로 담았어요", "suggest": None}
    if abs(c["A"] - c["B"]) <= 1:
        return {"text": "두 분 취향을 고르게 담았어요", "suggest": None}
    low = "A" if c["A"] < c["B"] else "B"
    # 누가 양보했는지가 아니라 다음에 할 수 있는 행동을 제안한다
    return {"text": "한쪽 취향 장소가 조금 더 많아요",
            "suggest": {"owner": low, "text": f"{names[low]}님 취향 장소를 하나 더 넣어볼까요?"}}
