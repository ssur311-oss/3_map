"""후보 장소 불러오기와 '누구 취향인지(owner)' 붙이기."""
from . import demo_data, kakao

# 지도 API와 취향 로직을 분리하기 위해, 카카오 카테고리 → 서비스 취향 태그 변환은 여기서만 한다
TAG = {"AT4": "nature", "CT1": "culture", "FD6": "food", "CE7": "cafe"}
STYLE_TAG = {"view": "nature", "food": "food"}
CANDIDATE_CODES = ["AT4", "CT1", "FD6", "CE7"]
UTIL_CODES = ["PK6", "CS2", "PM9", "HP8"]


def load_candidates(region):
    """지역 중심 좌표와 후보 장소. 카카오 호출이 안 되면 예시 데이터로 대신하고 demo=True로 알린다."""
    try:
        center = kakao.region_center(region)
        found = []
        for code in CANDIDATE_CODES:
            for page in (1, 2):
                found += kakao.category(code, center["lng"], center["lat"], radius=8000, page=page)
        found = kakao.dedupe(found)
        if len(found) >= 4:
            return center, found, False
    except kakao.KakaoError:
        pass
    return demo_data.DEMO_CENTER, demo_data.places(), True


def likes(acts, style, tag):
    return tag in acts or STYLE_TAG.get(style) == tag


def owner_of(place, eff):
    tag = TAG.get(place.get("category"))
    if not tag:
        return "neutral"
    a = likes(eff["actA"], eff["styleA"], tag)
    b = likes(eff["actB"], eff["styleB"], tag)
    if a and b:
        return "both"
    if a:
        return "A"
    if b:
        return "B"
    return "neutral"


def with_owner(places, eff):
    return [dict(p, owner=owner_of(p, eff)) for p in places]


def clean(p):
    """화면에서 보낸 장소 데이터는 필요한 칸만 남겨 저장한다."""
    return {
        "id": str(p.get("id", ""))[:40],
        "name": str(p.get("name", ""))[:60],
        "lat": float(p.get("lat")),
        "lng": float(p.get("lng")),
        "category": str(p.get("category", ""))[:4],
        "categoryName": str(p.get("categoryName", ""))[:30],
        "address": str(p.get("address", ""))[:120],
        "url": str(p.get("url", ""))[:200],
        "demo": bool(p.get("demo", False)),
    }
