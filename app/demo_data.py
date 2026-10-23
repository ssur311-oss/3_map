"""카카오 키가 없거나 호출이 실패할 때 쓰는 예시 장소. 화면에 '예시'로 표시해 실제 정보와 구분한다."""

DEMO_CENTER = {"lat": 37.7650, "lng": 128.9050}

_RAW = [
    ("d1", "[해변]", "AT4", 37.7720, 128.9470),
    ("d2", "[호수 산책로]", "AT4", 37.7950, 128.8960),
    ("d3", "[전망대]", "AT4", 37.7480, 128.9320),
    ("d4", "[미술관]", "CT1", 37.7610, 128.8990),
    ("d5", "[전통 가옥]", "CT1", 37.7790, 128.8790),
    ("d6", "[순두부 식당]", "FD6", 37.7900, 128.9150),
    ("d7", "[물회 식당]", "FD6", 37.7700, 128.9420),
    ("d8", "[시장 분식]", "FD6", 37.7540, 128.8970),
    ("d9", "[바다 카페]", "CE7", 37.7740, 128.9450),
    ("d10", "[골목 카페]", "CE7", 37.7580, 128.8950),
    ("d11", "[소나무 숲]", "AT4", 37.7860, 128.9200),
    ("d12", "[작은 박물관]", "CT1", 37.7690, 128.9100),
]

_UTIL = [
    ("u1", "[주차장]", "PK6", 0.0010, 0.0012),
    ("u2", "[편의점]", "CS2", -0.0012, 0.0008),
    ("u3", "[약국]", "PM9", 0.0015, -0.0010),
    ("u4", "[병원]", "HP8", -0.0020, -0.0015),
]


def _place(pid, name, cat, lat, lng):
    return {"id": pid, "name": name, "lat": lat, "lng": lng, "category": cat,
            "categoryName": "", "address": "예시 주소", "url": "", "demo": True}


def places():
    return [_place(*row) for row in _RAW]


def nearby(lat, lng, code):
    return [_place(pid, name, cat, lat + dy, lng + dx)
            for pid, name, cat, dy, dx in _UTIL if cat == code]


def search(query):
    q = (query or "").strip()
    return [p for p in places() if q and q in p["name"]] or places()[:3]
