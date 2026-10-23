"""온보딩 질문 목록. 서버와 화면이 같은 목록을 쓰도록 여기서만 정의하고 /api/questions로 내려준다."""

ANY = "any"

QUESTIONS = [
    {
        "key": "style", "type": "single", "scale": False, "importance": False,
        "title": "어떤 여행 코스를 좋아해요?",
        "hint": "정답은 없어요. 솔직한 쪽이 제일 멋져요",
        "options": [["many", "많이 보기"], ["relaxed", "여유롭게"], ["food", "맛집 중심"],
                    ["view", "풍경 중심"], [ANY, "상관없어요"]],
    },
    {
        "key": "walking", "type": "single", "scale": True, "importance": True,
        "title": "하루에 얼마나 걸어도 괜찮아요?",
        "hint": "주차하고 걷는 거리까지 생각해 주세요",
        "options": [["low", "조금만"], ["mid", "적당히"], ["high", "많이 걸어도 좋아요"], [ANY, "상관없어요"]],
    },
    {
        "key": "start", "type": "single", "scale": True, "importance": True,
        "title": "하루를 언제 시작하고 싶어요?",
        "hint": "출발 시각을 정할 때 써요",
        "options": [["early", "아침 일찍"], ["morning", "느지막한 아침"], ["noon", "점심 무렵"], [ANY, "상관없어요"]],
    },
    {
        "key": "budget", "type": "single", "scale": True, "importance": True,
        "title": "하루 예산은 어느 정도가 편해요?",
        "hint": "식사·입장료 기준이에요",
        "options": [["low", "아껴서"], ["mid", "보통"], ["high", "넉넉하게"], [ANY, "상관없어요"]],
    },
    {
        "key": "activities", "type": "multi", "scale": False, "importance": False,
        "title": "어떤 걸 하고 싶어요?",
        "hint": "여러 개 골라도 돼요",
        "options": [["nature", "자연·풍경"], ["food", "맛집"], ["cafe", "카페"],
                    ["culture", "문화·전시"], [ANY, "상관없어요"]],
    },
    {
        "key": "rest", "type": "single", "scale": True, "importance": True,
        "title": "얼마나 자주 쉬고 싶어요?",
        "hint": "쉬는 시간을 코스 사이에 끼워 넣어요",
        "options": [["often", "한두 곳마다"], ["sometimes", "가끔"], ["rarely", "거의 안 쉬어도 돼요"], [ANY, "상관없어요"]],
    },
    {
        "key": "mbti", "type": "mbti", "scale": False, "importance": False, "optional": True,
        "title": "MBTI를 알려줄래요?",
        "hint": "재미로만 써요. 건너뛰어도 추천은 똑같이 나와요",
        "options": [],
    },
]

BY_KEY = {q["key"]: q for q in QUESTIONS}

# 필수 조건이 갈릴 때 어느 쪽으로 맞출지. 몸이 힘든 쪽을 기준으로 삼아야 둘 다 버틸 수 있다
CONDITION_RULE = {
    "walking": "low_first",   # 덜 걷는 쪽
    "rest": "low_first",      # 더 자주 쉬는 쪽
    "budget": "low_first",    # 아끼는 쪽
    "start": "high_first",    # 늦게 시작하는 쪽
}


def label(key, value):
    for v, text in BY_KEY[key]["options"]:
        if v == value:
            return text
    return value or "-"


def scale_values(key):
    return [v for v, _ in BY_KEY[key]["options"] if v != ANY]
