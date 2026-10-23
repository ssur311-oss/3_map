"""티키타카 트립 개발 서버. 표준 라이브러리만 사용한다.

실행: python server.py  →  http://localhost:8000
"""
import json
import mimetypes
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from app.env import js_key, load_env, rest_key

ROOT = os.path.dirname(os.path.abspath(__file__))
load_env(os.path.join(ROOT, ".env"))

from app import plan, roulette, store, testmode, trips  # noqa: E402  (.env를 먼저 읽어야 함)
from app.questions import QUESTIONS  # noqa: E402
from app.trips import ApiError  # noqa: E402

# 윈도우 레지스트리에 따라 .js가 text/plain으로 나가 ES 모듈이 막히는 경우가 있어 고정한다
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")

TRIP = re.compile(r"^/api/trips/([\w-]+)(?:/([\w-]+))?(?:/([\w-]+))?$")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(ROOT, "static"), **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            raise ApiError(400, "요청 형식이 올바르지 않아요")

    def _dispatch(self, method):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            if method == "GET":
                return super().do_GET()
            return self._send(404, {"error": "없는 주소예요"})
        try:
            self._send(200, self._api(method, url.path, parse_qs(url.query)) or {"ok": True})
        except ApiError as e:
            self._send(e.status, {"error": e.message})
        except Exception as e:  # 예상 못한 오류도 화면이 다음 행동을 안내할 수 있게 JSON으로 돌려준다
            self.log_error("server error: %r", e)
            self._send(500, {"error": "잠시 문제가 생겼어요. 다시 시도해 주세요"})

    def _api(self, method, path, q):
        arg = lambda k: (q.get(k) or [""])[0]  # noqa: E731
        if path == "/api/config":
            return {"jsKey": js_key(), "hasRestKey": bool(rest_key())}
        if path == "/api/questions":
            return {"questions": QUESTIONS}
        if path == "/api/trips" and method == "POST":
            trip, token = trips.create(self._body())
            return {"id": trip["id"], "token": token, "member": "A"}
        if path == "/api/trips/test" and method == "POST":
            return testmode.create_test(self._body())

        m = TRIP.match(path)
        if not m:
            raise ApiError(404, "없는 주소예요")
        trip_id, sub, action = m.groups()
        if sub == "join" and method == "POST":
            b = self._body()
            return {"token": trips.join(trip_id, b.get("invite"), b.get("nickname")), "member": "B"}

        trip = store.get(trip_id)
        if trip is None:
            raise ApiError(404, "여행을 찾지 못했어요")
        me = trips.member_of(trip, self.headers.get("X-Member-Token"))

        if sub is None and method == "GET":
            return trips.view(trip, me)
        if sub == "answers" and method == "PUT":
            return trips.save_answers(trip_id, me, self._body())
        if sub == "invite" and method == "POST":
            return trips.reissue_invite(trip_id, me)
        if sub == "places" and method == "GET":
            trip = plan.ensure_places(trip_id)
            return {"center": trip["center"], "demo": trip["demo"], "places": plan.candidates(trip)}
        if sub == "drafts" and method == "GET":
            trip = plan.ensure_places(trip_id)
            return {"drafts": plan.drafts(trip), "demo": trip["demo"]}
        if sub == "course" and method == "PUT":
            return plan.save_course(trip_id, self._body())
        if sub == "confirm" and method == "POST":
            return plan.confirm(trip_id, me, self._body().get("version"))
        if sub == "arrive" and method == "POST":
            return plan.arrive(trip_id)
        if sub == "search" and method == "GET":
            return {"places": plan.search(trip, arg("q"), arg("code"), arg("lat"), arg("lng"))}
        if sub == "nearby" and method == "GET":
            return {"places": plan.nearby(trip, arg("code"), float(arg("lat")), float(arg("lng")))}
        if sub == "roulette" and method == "POST":
            if action:
                return roulette.act(trip_id, me, action)
            return roulette.open_(trip_id, self._body().get("key") or "")
        raise ApiError(404, "없는 주소예요")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")


def main():
    port = int(os.environ.get("PORT", "8000"))
    if not rest_key():
        print("[안내] KAKAO_REST_API_KEY가 없어 예시 장소 데이터로 동작해요.")
    if not js_key():
        print("[안내] KAKAO_JS_KEY가 없어 지도 대신 간이 지도(방문 순서 그림)로 보여줘요.")
    print(f"티키타카 트립 → http://localhost:{port}")
    ThreadingHTTPServer((os.environ.get("HOST", "127.0.0.1"), port), Handler).serve_forever()


if __name__ == "__main__":
    main()
