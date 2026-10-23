"""여행방 저장소. MVP는 JSON 파일 하나로 시작하고, DB가 정해지면 이 모듈만 바꾼다."""
import json
import os
import threading

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "trips.json")
_lock = threading.Lock()


def _read():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def _write(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    # 쓰는 도중 서버가 꺼져도 파일이 깨지지 않도록 교체 방식으로 저장한다
    os.replace(tmp, DATA_FILE)


def get(trip_id):
    with _lock:
        return _read().get(trip_id)


def create(trip):
    with _lock:
        data = _read()
        data[trip["id"]] = trip
        _write(data)


def update(trip_id, fn):
    """fn(trip)이 trip을 직접 고친다. 두 사람이 동시에 눌러도 순서대로 반영되게 락 안에서 처리."""
    with _lock:
        data = _read()
        trip = data.get(trip_id)
        if trip is None:
            return None, None
        result = fn(trip)
        _write(data)
        return trip, result
