#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OG 이미지 제목 오타 수정 스크립트

기존 og-kakao-wide.png / og-kakao-vertical.png 파일에서
'대항해의 이타'로 잘못된 텍스트를 덮어쓰고
정상 텍스트('대항해의 시대')로 교체합니다.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# 폰트 설정 (환경에 따라 경로를 수정할 수 있음)
import platform
import urllib.request

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
os.makedirs(FONT_DIR, exist_ok=True)

NOTO_REGULAR = os.path.join(FONT_DIR, "NotoSansKR-Regular.otf")
NOTO_BOLD = os.path.join(FONT_DIR, "NotoSansKR-Bold.otf")
NOTO_REGULAR_URL = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Regular.otf"
NOTO_BOLD_URL = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Bold.otf"

def download_if_missing(path, url):
    if os.path.exists(path):
        return
    try:
        print(f"[INFO] Downloading font: {os.path.basename(path)}")
        urllib.request.urlretrieve(url, path)
    except Exception as e:
        print(f"[WARN] Unable to download font {os.path.basename(path)}: {e}")


def find_font(candidates):
    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None

if platform.system() == "Windows":
    FONT_BASE = r"C:\Windows\Fonts"
    F_BLACK = find_font([
        os.path.join(FONT_BASE, "malgunsl.ttf"),
        os.path.join(FONT_BASE, "malgunbd.ttf"),
        os.path.join(FONT_BASE, "malgun.ttf"),
    ])
else:
    FONT_BASE = "/usr/share/fonts/truetype/nanum/"
    F_BLACK = find_font([
        os.path.join(FONT_BASE, "NanumSquare_acEB.ttf"),
        os.path.join(FONT_BASE, "NanumSquareBold.ttf"),
    ])

if not (F_BLACK and os.path.exists(F_BLACK)):
    download_if_missing(NOTO_BOLD, NOTO_BOLD_URL)
    if os.path.exists(NOTO_BOLD):
        F_BLACK = NOTO_BOLD

print("[INFO] fix_og_typo: using font:", F_BLACK)

TASKS = [
    {
        "path": "assets/og-kakao-wide.png",
        "title_pos": (100, 80),
        "font_size": 60,
        "bg": (18, 26, 39),
    },
    {
        "path": "assets/og-kakao-vertical.png",
        "title_pos": (60, 140),
        "font_size": 80,
        "bg": (18, 26, 39),
    },
]

TEXT = "피지컬 AI와 로봇\n대항해의 시대"

for task in TASKS:
    path = task["path"]
    if not os.path.exists(path):
        print(f"[SKIP] 파일을 찾을 수 없습니다: {path}")
        continue

    img = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(img)

    if F_BLACK and os.path.exists(F_BLACK):
        try:
            font = ImageFont.truetype(F_BLACK, task["font_size"])
        except Exception as e:
            print(f"[WARN] 폰트 로드 실패, 기본 폰트 사용: {e}")
            font = ImageFont.load_default()
    else:
        print("[WARN] 한글 폰트를 찾을 수 없어 기본 폰트 사용")
        font = ImageFont.load_default()

    x, y = task["title_pos"]
    W, H = img.size

    # 덮어쓰기 영역 (대략)
    w = W - x - 80
    h = task["font_size"] * 3
    draw.rectangle([x - 20, y - 20, x + w, y + h], fill=task["bg"])

    # 텍스트 그리기 (중앙 정렬)
    lines = TEXT.split("\n")
    # 높이 계산: pillow 최신 버전에서는 textbbox 사용
    bbox = draw.textbbox((0, 0), lines[0], font=font)
    line_h = (bbox[3] - bbox[1]) + 10
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((x + (w - tw) / 2, y + i * line_h), line, font=font, fill=(255, 255, 255))

    img.save(path, optimize=True)
    print(f"[FIXED] {path}")
