"""카카오 REST API 호출. REST 키는 서버에서만 쓰고 브라우저로 내려보내지 않는다."""
import json
import urllib.error
import urllib.parse
import urllib.request

from .env import rest_key

LOCAL = "https://dapi.kakao.com/v2/local/search"
NAVI = "https://apis-navi.kakaomobility.com/v1/directions"
_route_cache = {}


class KakaoError(Exception):
    pass


def _get(url, params):
    key = rest_key()
    if not key:
        raise KakaoError("no-key")
    req = urllib.request.Request(
        url + "?" + urllib.parse.urlencode(params),
        headers={"Authorization": f"KakaoAK {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as res:
            return json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise KakaoError(str(e)) from e


def _to_place(doc):
    return {
        "id": doc["id"],
        "name": doc["place_name"],
        "lat": float(doc["y"]),
        "lng": float(doc["x"]),
        "category": doc.get("category_group_code") or "",
        "categoryName": (doc.get("category_name") or "").split(" > ")[-1],
        "address": doc.get("road_address_name") or doc.get("address_name") or "",
        "url": doc.get("place_url") or "",
        "demo": False,
    }


def keyword(query, x=None, y=None, radius=None, category=None, page=1):
    params = {"query": query, "size": 15, "page": page}
    if x and y:
        params.update({"x": x, "y": y})
        if radius:
            params["radius"] = radius
    if category:
        params["category_group_code"] = category
    return [_to_place(d) for d in _get(LOCAL + "/keyword.json", params).get("documents", [])]


def category(code, x, y, radius=5000, page=1, sort="accuracy"):
    params = {"category_group_code": code, "x": x, "y": y, "radius": radius,
              "size": 15, "page": page, "sort": sort}
    return [_to_place(d) for d in _get(LOCAL + "/category.json", params).get("documents", [])]


def region_center(region):
    docs = keyword(region)
    if not docs:
        raise KakaoError("region-not-found")
    return {"lat": docs[0]["lat"], "lng": docs[0]["lng"]}


def route(a, b):
    """자동차 경로 거리(m)·시간(초). 실패하면 None — 임의 값을 만들지 않는다."""
    cache_key = (round(a["lat"], 5), round(a["lng"], 5), round(b["lat"], 5), round(b["lng"], 5))
    if cache_key in _route_cache:
        return _route_cache[cache_key]
    try:
        data = _get(NAVI, {"origin": f'{a["lng"]},{a["lat"]}', "destination": f'{b["lng"]},{b["lat"]}'})
        r = data["routes"][0]
        if r.get("result_code") != 0:
            return None
        out = {"distance": r["summary"]["distance"], "duration": r["summary"]["duration"]}
    except (KakaoError, KeyError, IndexError):
        return None
    _route_cache[cache_key] = out
    return out


def dedupe(places):
    """로컬 API는 페이지가 겹쳐 올 수 있어 장소 id로 중복을 지운다."""
    seen, out = set(), []
    for p in places:
        if p["id"] not in seen:
            seen.add(p["id"])
            out.append(p)
    return out
