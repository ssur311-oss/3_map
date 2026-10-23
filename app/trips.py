"""여행방 상태 변경. 권한 검사와 '상대 원본 답 숨기기'는 모두 여기서 처리한다."""
import secrets
import time

from . import kakao, store
from .compare import compare, effective
from .questions import QUESTIONS

INVITE_TTL = 7 * 24 * 3600
OTHER = {"A": "B", "B": "A"}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _now():
    return int(time.time())


def _geocode(name):
    if not name:
        return None
    try:
        hit = kakao.keyword(name)
        if hit:
            return {"name": name, "lat": hit[0]["lat"], "lng": hit[0]["lng"]}
    except kakao.KakaoError:
        pass
    return None


def create(body):
    nickname = (body.get("nickname") or "").strip()[:12]
    region = (body.get("region") or "").strip()[:20]
    if not nickname or not region or not body.get("date"):
        raise ApiError(400, "지역·날짜·닉네임을 모두 입력해 주세요")
    token = secrets.token_urlsafe(24)
    trip = {
        "id": secrets.token_urlsafe(8),
        "region": region, "date": str(body["date"])[:10],
        "transport": "car",
        "startName": (body.get("start") or "")[:40], "endName": (body.get("end") or "")[:40],
        "start": _geocode(f'{region} {body.get("start")}' if body.get("start") else ""),
        "end": _geocode(f'{region} {body.get("end")}' if body.get("end") else ""),
        "invite": {"token": secrets.token_urlsafe(16), "expires": _now() + INVITE_TTL},
        "members": {"A": _member(nickname, token), "B": None},
        "decisions": {}, "roulette": None, "course": None, "confirmed": False, "goIndex": 0,
        "createdAt": _now(),
    }
    store.create(trip)
    return trip, token


def _member(nickname, token):
    return {"nickname": nickname, "token": token, "answers": {}, "step": 0, "submitted": False}


def join(trip_id, invite, nickname):
    nickname = (nickname or "").strip()[:12]
    if not nickname:
        raise ApiError(400, "닉네임을 입력해 주세요")
    token = secrets.token_urlsafe(24)

    def fn(trip):
        inv = trip["invite"]
        if inv["token"] != invite or inv["expires"] < _now():
            raise ApiError(410, "초대 링크가 만료됐어요. 여행을 만든 분께 새 링크를 받아주세요")
        if trip["members"]["B"]:
            raise ApiError(409, "이미 두 사람이 모두 참여한 여행이에요")
        trip["members"]["B"] = _member(nickname, token)

    trip, _ = store.update(trip_id, fn)
    if trip is None:
        raise ApiError(404, "여행을 찾지 못했어요")
    return token


def member_of(trip, token):
    for side in ("A", "B"):
        m = trip["members"].get(side)
        if m and token and secrets.compare_digest(m["token"], token):
            return side
    raise ApiError(403, "이 여행방에 들어올 권한이 없어요")


def both_submitted(trip):
    return all(trip["members"].get(s) and trip["members"][s]["submitted"] for s in ("A", "B"))


def eff(trip):
    a, b = trip["members"]["A"]["answers"], trip["members"]["B"]["answers"]
    return effective(a, b, trip["decisions"])


def view(trip, me):
    """상대의 원본 답·MBTI·진행 위치는 넣지 않는다. 둘 다 제출한 뒤에도 비교 요약만 준다."""
    members = {}
    for side in ("A", "B"):
        m = trip["members"].get(side)
        members[side] = {"nickname": m["nickname"], "joined": True, "submitted": m["submitted"]} \
            if m else {"nickname": None, "joined": False, "submitted": False}
    mine = trip["members"][me]
    out = {
        "id": trip["id"], "region": trip["region"], "date": trip["date"],
        "startName": trip["startName"], "endName": trip["endName"],
        "start": trip.get("start"), "end": trip.get("end"), "center": trip.get("center"),
        "me": me, "members": members,
        "myAnswers": mine["answers"], "myStep": mine["step"], "mySubmitted": mine["submitted"],
        "compare": None, "decisions": trip["decisions"], "roulette": trip["roulette"],
        "course": trip["course"], "confirmed": trip["confirmed"], "goIndex": trip["goIndex"],
        "demo": trip.get("demo", False), "test": trip.get("test", False),
    }
    if both_submitted(trip):
        out["compare"] = compare(trip["members"]["A"]["answers"], trip["members"]["B"]["answers"],
                                 trip["decisions"])
    if me == "A" and not trip["members"]["B"]:
        out["invite"] = {"path": f'#/join/{trip["id"]}/{trip["invite"]["token"]}',
                         "expires": trip["invite"]["expires"]}
    return out


def save_answers(trip_id, me, body):
    allowed = {q["key"] for q in QUESTIONS} | {"_must"}
    answers = {k: v for k, v in (body.get("answers") or {}).items() if k in allowed}

    def fn(trip):
        m = trip["members"][me]
        if m["submitted"] and not body.get("edit"):
            raise ApiError(409, "이미 제출했어요")
        m["answers"] = answers
        m["step"] = int(body.get("step") or 0)
        if body.get("submit"):
            m["submitted"] = True
            # 답을 바꾸면 이전 코스는 더 이상 두 사람 조건과 맞지 않을 수 있어 확인을 초기화한다
            if trip["course"]:
                trip["course"]["confirmedBy"] = []
                trip["confirmed"] = False

    store.update(trip_id, fn)


def reissue_invite(trip_id, me):
    if me != "A":
        raise ApiError(403, "여행을 만든 분만 새 링크를 만들 수 있어요")

    def fn(trip):
        trip["invite"] = {"token": secrets.token_urlsafe(16), "expires": _now() + INVITE_TTL}

    store.update(trip_id, fn)
