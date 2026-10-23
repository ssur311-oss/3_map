"""두 사람 답 비교. 원본 답 대신 '비교 요약'만 만들어 상대에게 보여준다."""
from .questions import ANY, BY_KEY, CONDITION_RULE, QUESTIONS, label, scale_values


def _pick_condition(key, a, b):
    order = scale_values(key)
    ia, ib = order.index(a), order.index(b)
    return a if (ia <= ib) == (CONDITION_RULE[key] == "low_first") else b


def compare(ans_a, ans_b, decisions):
    common, diffs, conditions = [], [], []
    likes = {"both": [], "A": [], "B": []}

    for q in QUESTIONS:
        key = q["key"]
        if q["type"] == "mbti":
            continue
        if q["type"] == "multi":
            a = set(ans_a.get(key) or []) - {ANY}
            b = set(ans_b.get(key) or []) - {ANY}
            for v, text in q["options"]:
                if v in a and v in b:
                    likes["both"].append(text)
                elif v in a:
                    likes["A"].append(text)
                elif v in b:
                    likes["B"].append(text)
            continue

        a, b = ans_a.get(key), ans_b.get(key)
        must_a = key in (ans_a.get("_must") or [])
        must_b = key in (ans_b.get("_must") or [])
        if a == b or ANY in (a, b):
            value = b if a == ANY else a
            text = "둘 다 상관없어요" if value == ANY else label(key, value)
            common.append({"key": key, "title": q["title"], "text": text})
            continue

        item = {
            "key": key, "title": q["title"],
            "A": label(key, a), "B": label(key, b),
            "scale": [label(key, v) for v in scale_values(key)] if q["scale"] else None,
            "posA": scale_values(key).index(a) if q["scale"] else None,
            "posB": scale_values(key).index(b) if q["scale"] else None,
        }
        if (must_a or must_b) and key in CONDITION_RULE:
            item["method"] = "condition"
            item["result"] = label(key, _pick_condition(key, a, b))
            conditions.append(item)
        elif key == "style":
            item["method"] = "course"
        else:
            item["method"] = "roulette"
            if key in decisions:
                item["result"] = label(key, decisions[key])
        diffs.append(item)

    return {"common": common, "diffs": diffs, "conditions": conditions, "likes": likes}


def effective(ans_a, ans_b, decisions):
    """코스 계산에 쓸 최종 조건. 필수 조건 → 룰렛 결정 → 덜 힘든 쪽 순으로 정한다."""
    out = {}
    for key in ("walking", "start", "budget", "rest"):
        a, b = ans_a.get(key, ANY), ans_b.get(key, ANY)
        if key in decisions:
            out[key] = decisions[key]
        elif a == ANY:
            out[key] = b
        elif b == ANY or a == b:
            out[key] = a
        else:
            out[key] = _pick_condition(key, a, b)
    out["styleA"] = ans_a.get("style", ANY)
    out["styleB"] = ans_b.get("style", ANY)
    out["actA"] = set(ans_a.get("activities") or []) - {ANY}
    out["actB"] = set(ans_b.get("activities") or []) - {ANY}
    return out


def roulette_options(key, ans_a, ans_b):
    """갈리는 항목 룰렛 후보. 두 사람 답을 한 칸씩 같은 무게로 넣는다."""
    return [
        {"id": ans_a.get(key), "label": label(key, ans_a.get(key)), "owner": "A"},
        {"id": ans_b.get(key), "label": label(key, ans_b.get(key)), "owner": "B"},
    ], BY_KEY[key]["title"]
