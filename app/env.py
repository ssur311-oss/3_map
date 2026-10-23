"""`.env` 로더. 외부 패키지 없이 쓰기 위해 직접 파싱한다."""
import os


def load_env(path):
    if not os.path.exists(path):
        return
    # 메모장으로 저장하면 BOM이 붙을 수 있어 utf-8-sig로 읽는다
    with open(path, encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            # `.env.example`이 `KEY = value`처럼 공백을 두고 있어 양쪽을 다듬는다
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def rest_key():
    key = os.environ.get("KAKAO_REST_API_KEY", "")
    return "" if key in ("", "your-key") else key


def js_key():
    key = os.environ.get("KAKAO_JS_KEY", "")
    return "" if key in ("", "your-key") else key
