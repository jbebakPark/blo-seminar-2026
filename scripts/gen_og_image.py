#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BLO 세미나 OG 이미지 생성기 (카카오톡 공유용)
1200×630 가로형 + 630×1380 세로형

모든 텍스트 내용은 data/current-seminar.json에서 읽어옵니다.
"""

from PIL import Image, ImageDraw, ImageFont
import os
import json
import platform
import urllib.request

# ── 폰트 경로 ──────────────────────────────────────
FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
os.makedirs(FONT_DIR, exist_ok=True)

NOTO_REGULAR = os.path.join(FONT_DIR, "NotoSansKR-Regular.otf")
NOTO_BOLD = os.path.join(FONT_DIR, "NotoSansKR-Bold.otf")
NOTO_REGULAR_URL = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Regular.otf"
NOTO_BOLD_URL = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansKR-Bold.otf"

LOCAL_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
LOCAL_MALGUNBD = os.path.join(LOCAL_FONT_DIR, "malgunbd.ttf")


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


if os.path.exists(LOCAL_MALGUNBD):
    F_BLACK = LOCAL_MALGUNBD
    F_BOLD = LOCAL_MALGUNBD
    F_BOLD2 = LOCAL_MALGUNBD
    F_REGULAR = LOCAL_MALGUNBD
else:
    if platform.system() == "Windows":
        FONT_BASE = r"C:\Windows\Fonts"
        F_BLACK   = find_font([os.path.join(FONT_BASE, "malgunbd.ttf"), os.path.join(FONT_BASE, "malgun.ttf")])
        F_BOLD    = find_font([os.path.join(FONT_BASE, "malgunbd.ttf"), os.path.join(FONT_BASE, "malgun.ttf")])
        F_REGULAR = find_font([os.path.join(FONT_BASE, "malgun.ttf"), os.path.join(FONT_BASE, "gulim.ttc")])
        F_BOLD2   = find_font([os.path.join(FONT_BASE, "malgunbd.ttf"), os.path.join(FONT_BASE, "gulim.ttc")])
    elif platform.system() == "Darwin":
        FONT_BASE = "/Library/Fonts"
        F_BLACK   = find_font([os.path.join(FONT_BASE, "Apple SD Gothic Neo Bold.ttf")])
        F_BOLD    = F_BLACK
        F_REGULAR = find_font([os.path.join(FONT_BASE, "Apple SD Gothic Neo.ttf")])
        F_BOLD2   = F_BLACK
    else:
        FONT_BASE  = "/usr/share/fonts/truetype/nanum/"
        F_BLACK    = find_font([os.path.join(FONT_BASE, "NanumSquare_acEB.ttf"), os.path.join(FONT_BASE, "NanumSquareBold.ttf")])
        F_BOLD     = find_font([os.path.join(FONT_BASE, "NanumSquareB.ttf"), os.path.join(FONT_BASE, "NanumSquareBold.ttf")])
        F_REGULAR  = find_font([os.path.join(FONT_BASE, "NanumBarunGothic.ttf"), os.path.join(FONT_BASE, "NanumGothic.ttf")])
        F_BOLD2    = find_font([os.path.join(FONT_BASE, "NanumBarunGothicBold.ttf"), os.path.join(FONT_BASE, "NanumGothicBold.ttf")])

if not (F_REGULAR and os.path.exists(F_REGULAR)):
    download_if_missing(NOTO_REGULAR, NOTO_REGULAR_URL)
    if os.path.exists(NOTO_REGULAR):
        F_REGULAR = NOTO_REGULAR

if not (F_BOLD and os.path.exists(F_BOLD)):
    download_if_missing(NOTO_BOLD, NOTO_BOLD_URL)
    if os.path.exists(NOTO_BOLD):
        F_BOLD = NOTO_BOLD

if not (F_BOLD2 and os.path.exists(F_BOLD2)):
    F_BOLD2 = F_BOLD or F_REGULAR
if not (F_BLACK and os.path.exists(F_BLACK)):
    F_BLACK = F_BOLD or F_REGULAR

print("[INFO] Fonts used:")
print(f"  F_BLACK  = {F_BLACK}")
print(f"  F_BOLD   = {F_BOLD}")
print(f"  F_REGULAR= {F_REGULAR}")
print(f"  F_BOLD2  = {F_BOLD2}")

# ── 색상 팔레트 ────────────────────────────────────
NAVY       = (13, 26, 46)
BLUE       = (16, 80, 160)
LIGHT_BLUE = (26, 111, 232)
GOLD       = (201, 168, 76)
WHITE      = (255, 255, 255)
LIGHT_GRAY = (240, 244, 250)
MID_GRAY   = (180, 195, 215)
TEXT_DARK  = (20, 35, 60)
TEXT_MID   = (60, 85, 120)


def load_font(path, size):
    if not path or not os.path.exists(path):
        return ImageFont.load_default()
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def draw_multiline_centered(draw, text, x_center, y, font, fill, line_height=None):
    lines = text.split('\n')
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        w = bbox[2] - bbox[0]
        lh = line_height or (bbox[3] - bbox[1] + 8)
        draw.text((x_center - w // 2, y + i * lh), line, font=font, fill=fill)
    return y + len(lines) * (line_height or 40)


def draw_rounded_rect(draw, xy, radius, fill, outline=None, outline_width=1):
    x1, y1, x2, y2 = xy
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + radius*2, y1 + radius*2], fill=fill)
    draw.ellipse([x2 - radius*2, y1, x2, y1 + radius*2], fill=fill)
    draw.ellipse([x1, y2 - radius*2, x1 + radius*2, y2], fill=fill)
    draw.ellipse([x2 - radius*2, y2 - radius*2, x2, y2], fill=fill)
    if outline:
        draw.rectangle([x1 + radius, y1, x2 - radius, y1 + outline_width], fill=outline)
        draw.rectangle([x1 + radius, y2 - outline_width, x2 - radius, y2], fill=outline)
        draw.rectangle([x1, y1 + radius, x1 + outline_width, y2 - radius], fill=outline)
        draw.rectangle([x2 - outline_width, y1 + radius, x2, y2 - radius], fill=outline)


def load_seminar_data():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    path = os.path.join(base_dir, "data", "current-seminar.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ══════════════════════════════════════════════════
# 가로형 OG 이미지 1200×630 (카톡 링크 미리보기용)
# ══════════════════════════════════════════════════
def make_wide_og(out_path, d):
    W, H = 1200, 630
    img  = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    month_num   = d.get("ogSidebarMonth",   d.get("month", "05"))
    month_label = d.get("ogSidebarMonthLabel", d.get("monthLabel", "MAY"))
    month_kor   = d.get("monthKor", "?월")
    title1      = d.get("ogWideTitle1", "")
    title2      = d.get("ogWideTitle2", "")
    subtitle    = d.get("ogWideSubtitle", "")
    info_date   = d.get("ogWideInfoDate", "")
    info_speaker= d.get("ogWideInfoSpeaker", "")
    chips       = d.get("ogWideChips", [])
    og_deadline = d.get("ogOfflineDeadline", "")

    # ── 왼쪽 네이비 사이드바 (180px) ──
    draw.rectangle([0, 0, 180, H], fill=NAVY)

    fnum = load_font(F_BLACK, 110)
    draw.text((18, 60), month_num, font=fnum, fill=GOLD)

    fbadge_s = load_font(F_BOLD, 14)
    draw.text((18, 185), "2030", font=fbadge_s, fill=WHITE)
    draw.text((18, 202), "BUSINESS", font=load_font(F_BOLD, 11), fill=MID_GRAY)
    draw.text((18, 217), "LIVE ON", font=load_font(F_BOLD, 11), fill=MID_GRAY)

    fy = load_font(F_REGULAR, 13)
    draw.text((18, 255), d.get("year", "2026"), font=fy, fill=MID_GRAY)
    draw.text((18, 272), month_label, font=fy, fill=MID_GRAY)

    for i, (h_ratio, opacity) in enumerate([(0.55, 80), (0.72, 120), (0.85, 160), (0.65, 100), (0.78, 130)]):
        bar_h = int(H * h_ratio)
        bar_y = H - bar_h - 10
        alpha_color = tuple(int(c + (255-c)*opacity/255) for c in LIGHT_BLUE)
        draw.rectangle([152 + i*5, bar_y, 156 + i*5, H], fill=alpha_color)

    # ── 오른쪽 메인 영역 ──
    MX = 200

    draw.rectangle([MX, 0, W, 6], fill=GOLD)

    fbadge = load_font(F_BOLD, 16)
    badge_text = f"2030 BLO  {month_kor} 세미나"
    bb = draw.textbbox((0,0), badge_text, font=fbadge)
    bw = bb[2] - bb[0] + 28
    draw_rounded_rect(draw, [MX, 20, MX + bw, 48], 4, BLUE)
    draw.text((MX + 14, 26), badge_text, font=fbadge, fill=WHITE)

    ft1 = load_font(F_BOLD, 48)
    ft2 = load_font(F_BOLD, 46)
    draw.text((MX, 65),  title1, font=ft1, fill=NAVY)
    draw.text((MX, 118), title2, font=ft2, fill=NAVY)

    draw.rectangle([MX, 182, MX + 480, 185], fill=GOLD)

    fsub = load_font(F_BOLD2, 18)
    draw.text((MX, 194), subtitle, font=fsub, fill=LIGHT_BLUE)

    draw.rectangle([MX, 235, MX + 720, 355], fill=LIGHT_GRAY)
    draw.rectangle([MX, 235, MX + 4, 355], fill=BLUE)

    finfo_l = load_font(F_BOLD2, 17)
    finfo_r = load_font(F_REGULAR, 17)

    # 이모지는 여기서 쓰는 한글 폰트(맑은고딕/나눔고딕)에 글리프가 없어
    # 빈 네모(tofu)로 깨져 나오므로 이미지에는 넣지 않는다 (HTML 쪽은 문제없음)
    info_items = [
        ("일  시", info_date),
        ("강  사", info_speaker),
        ("신  청", "www.samsung2030blo.com"),
    ]
    for i, (label, value) in enumerate(info_items):
        y = 248 + i * 34
        draw.text((MX + 18, y), label, font=finfo_l, fill=BLUE)
        draw.text((MX + 140, y), value, font=finfo_r, fill=TEXT_DARK)

    fchip = load_font(F_REGULAR, 14)
    cx = MX
    cy = 370
    for chip in chips:
        cb = draw.textbbox((0,0), chip, font=fchip)
        cw = cb[2] - cb[0] + 20
        if cx + cw > W - 20:
            cx = MX
            cy += 28
        draw_rounded_rect(draw, [cx, cy, cx+cw, cy+22], 11, (230, 238, 252))
        draw.text((cx+10, cy+4), chip, font=fchip, fill=BLUE)
        cx += cw + 8

    btn_x1, btn_y1 = W - 240, H - 75
    btn_x2, btn_y2 = W - 20,  H - 25
    draw_rounded_rect(draw, [btn_x1, btn_y1, btn_x2, btn_y2], 8, BLUE)
    fbtn = load_font(F_BOLD2, 18)
    btn_text = "세미나 신청하기 ▶"
    bb2 = draw.textbbox((0,0), btn_text, font=fbtn)
    bw2 = bb2[2] - bb2[0]
    bh2 = bb2[3] - bb2[1]
    draw.text((btn_x1 + (220-bw2)//2, btn_y1 + (50-bh2)//2), btn_text, font=fbtn, fill=WHITE)

    fcode_l = load_font(F_REGULAR, 16)
    draw.text((MX, H-65), "추천인 코드 입력 필요 — 신청 페이지에서 확인", font=fcode_l, fill=TEXT_MID)

    draw.rectangle([0, H-22, W, H], fill=NAVY)
    ffoot = load_font(F_REGULAR, 13)
    draw.text((MX, H-17), "admin-samsung-vvip.web.app/invite", font=ffoot, fill=MID_GRAY)

    img.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) // 1024
    print(f"✅ 가로형 저장: {out_path}  ({size_kb} KB)")


# ══════════════════════════════════════════════════
# 세로형 카드 (카톡 이미지 첨부용)
# ══════════════════════════════════════════════════
def make_vertical_card(out_path, d):
    W, H = 630, 1380

    fb      = load_font(F_BOLD,    13)
    fmn     = load_font(F_BLACK,   80)
    fmy     = load_font(F_BOLD,    15)
    ft      = load_font(F_BLACK,   40)
    ft2     = load_font(F_BLACK,   38)
    fsub    = load_font(F_BOLD2,   17)
    fcard_l = load_font(F_BOLD2,   16)
    fcard_r = load_font(F_REGULAR, 16)
    fprof_t = load_font(F_BLACK,   21)
    fprof_s = load_font(F_BOLD2,   16)
    fprof_r = load_font(F_REGULAR, 14)
    fcode_t = load_font(F_BOLD2,   15)
    fcode_v2 = load_font(F_BOLD2,  16)
    fstep_r = load_font(F_REGULAR, 15)
    fbtn    = load_font(F_BLACK,   21)
    foff    = load_font(F_REGULAR, 14)
    foff_b  = load_font(F_BOLD2,   14)
    ffoot_t = load_font(F_BOLD,    15)
    ffoot_r = load_font(F_REGULAR, 12)

    month_num    = d.get("ogSidebarMonth",    d.get("month", "05"))
    month_label  = d.get("ogSidebarMonthLabel", d.get("monthLabel", "MAY"))
    sidebar_date = d.get("ogSidebarDate", "")
    sidebar_t1   = d.get("ogSidebarTime1", "")
    sidebar_t2   = d.get("ogSidebarTime2", "")
    vtitle1      = d.get("ogVerticalTitle1", "")
    vtitle2      = d.get("ogVerticalTitle2", "")
    vsub1        = d.get("ogVerticalSub1", "")
    vsub2        = d.get("ogVerticalSub2", "")
    card_date    = d.get("ogCardDate", "")
    card_time    = d.get("ogCardTimeLine", "")
    speaker1     = d.get("ogCardSpeaker1", "")
    speaker2     = d.get("ogCardSpeaker2", "")
    prof_title1  = d.get("ogProfileTitle1", "")
    prof_org1    = d.get("ogProfileOrg1", "")
    prof_items1  = d.get("ogProfileItems1", [])
    prof_title2  = d.get("ogProfileTitle2", "")
    prof_org2    = d.get("ogProfileOrg2", "")
    prof_items2  = d.get("ogProfileItems2", [])
    step3        = d.get("ogStep3", "")
    og_deadline  = d.get("ogOfflineDeadline", "")
    subtitle     = d.get("ogWideSubtitle", d.get("subtitle", ""))

    img  = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 5], fill=GOLD)
    SIDE = 120
    # 상단 히어로 밴드 전체를 네이비로 칠한다 (전에는 SIDE 칼럼만 칠해져 있어서,
    # 오른쪽의 흰색 제목 텍스트(vtitle1)가 흰 배경 위에 흰 글씨로 그려져 안 보이던 버그가 있었음)
    draw.rectangle([0, 0, W, 380], fill=NAVY)

    for i, (hr, c) in enumerate([(0.5,40),(0.7,70),(0.9,110),(0.75,70),(0.55,45),(0.85,85)]):
        bh = int(380 * hr)
        lc = tuple(min(255, LIGHT_BLUE[j]+c) for j in range(3))
        draw.rectangle([W-50+i*8, 380-bh, W-46+i*8, 380], fill=lc)

    fb2 = load_font(F_BOLD, 11)
    for ci, ch in enumerate("2030 BLO"):
        draw.text((SIDE//2 - 6, 20 + ci*18), ch, font=fb2, fill=WHITE)

    draw.text((10, 70), month_num, font=fmn, fill=GOLD)

    # 세로로 한 글자씩 쌓는 월 라벨(SEPTEMBER, NOVEMBER 등 긴 이름) — 글자수에 맞춰
    # 줄간격을 줄여서, 아래쪽 sidebar_date(연/월/일) 텍스트와 겹치지 않게 한다.
    label_start_y = 178
    label_bottom_limit = 295  # 이 아래로는 sidebar_date 영역이라 침범 금지
    label_line_h = 18
    if len(month_label) > 0:
        label_line_h = min(18, max(11, (label_bottom_limit - label_start_y) // len(month_label)))
    for ci, ch in enumerate(month_label):
        draw.text((SIDE//2 - 6, label_start_y + ci*label_line_h), ch, font=fb2, fill=MID_GRAY)

    RX = SIDE + 20

    draw.rectangle([RX, 18, RX+180, 18+26], fill=BLUE)
    draw.text((RX+8, 22), "2030 BUSINESS LIVE ON", font=fb, fill=WHITE)

    draw.text((RX, 58),  vtitle1, font=ft,  fill=WHITE)
    draw.text((RX, 108), vtitle2, font=ft2, fill=GOLD)

    draw.rectangle([RX, 162, W-20, 164], fill=GOLD)
    draw.text((RX, 172), vsub1, font=fsub, fill=WHITE)
    draw.text((RX, 194), vsub2, font=fsub, fill=WHITE)

    fi = load_font(F_REGULAR, 12)
    draw.text((8, 300), sidebar_date, font=fi, fill=MID_GRAY)
    draw.text((8, 318), sidebar_t1,   font=fi, fill=MID_GRAY)
    draw.text((8, 336), sidebar_t2,   font=fi, fill=MID_GRAY)

    draw.rectangle([0, 380, W, H], fill=(248, 250, 253))
    draw.rectangle([0, 380, W, 383], fill=BLUE)

    y = 400

    draw.text((24, y), subtitle, font=fsub, fill=LIGHT_BLUE)
    y += 36

    draw.rectangle([24, y, W-24, y+218], fill=WHITE)
    draw.rectangle([24, y, W-24, y+4], fill=BLUE)
    card_items = [
        ("일  시", card_date),
        ("",        card_time),
        ("강  사", speaker1),
        ("",        speaker2),
        ("신  청", "www.samsung2030blo.com"),
        ("장  소", "삼성금융캠퍼스 B2F 비전홀"),
    ]
    cy = y + 16
    for label, value in card_items:
        if label:
            draw.text((36, cy), label, font=fcard_l, fill=BLUE)
            draw.text((144, cy), value, font=fcard_r, fill=TEXT_DARK)
        else:
            draw.text((144, cy), value, font=fcard_r, fill=TEXT_MID)
        cy += 30
    y += 228

    # 강사 프로필 1
    y += 10
    prof1_extra_h = max(0, (len(prof_items1) - 2) * 22)
    prof2_extra_h = max(0, (len(prof_items2) - 1) * 22)
    prof_box_h = 168 + prof1_extra_h + prof2_extra_h
    draw.rectangle([24, y, W-24, y+prof_box_h], fill=WHITE)
    draw.rectangle([24, y, 28, y+prof_box_h], fill=GOLD)
    draw.text((40, y+10),  prof_title1, font=fprof_t, fill=NAVY)
    draw.text((40, y+36),  prof_org1,   font=fprof_s, fill=BLUE)
    for i, item in enumerate(prof_items1):
        draw.text((40, y+58+i*22), item, font=fprof_r, fill=TEXT_DARK)

    divider_y = y + 58 + len(prof_items1) * 22 + 6
    draw.rectangle([40, divider_y, W-40, divider_y+1], fill=(220,230,245))

    p2_y = divider_y + 9
    draw.text((40, p2_y),    prof_title2, font=fprof_t, fill=NAVY)
    draw.text((40, p2_y+26), prof_org2,   font=fprof_s, fill=BLUE)
    for i, item in enumerate(prof_items2):
        draw.text((40, p2_y+48+i*22), item, font=fprof_r, fill=TEXT_DARK)
    y += prof_box_h + 10

    # 추천인 코드 — 보안상 이미지에는 코드값을 담지 않고, 신청 페이지 안내로 대체
    draw_rounded_rect(draw, [24, y, W-24, y+84], 10, (240,246,255))
    draw.rectangle([24, y, 28, y+84], fill=BLUE)
    draw.text((40, y+8),  "온라인 신청 시 반드시 추천인 코드 입력!", font=fcode_t, fill=BLUE)
    code_note = "추천인 코드는 신청 페이지에서 확인하세요"
    cb  = draw.textbbox((0,0), code_note, font=fcode_v2)
    cw  = cb[2]-cb[0]
    draw_rounded_rect(draw, [W//2-cw//2-18, y+28, W//2+cw//2+18, y+76], 8, NAVY)
    draw.text((W//2-cw//2, y+40), code_note, font=fcode_v2, fill=GOLD)
    y += 94

    # 신청 방법
    y += 14
    draw.text((24, y), "온라인 신청 방법", font=load_font(F_BOLD2, 16), fill=NAVY)
    month_day = d.get("ogSidebarDate", "")
    steps = [
        ("①", "samsung2030blo.com 접속"),
        ("②", "추천인 코드 입력 (신청 페이지에서 확인)"),
        ("③", step3),
    ]
    for i, (num, step) in enumerate(steps):
        ys = y+24+i*30
        draw_rounded_rect(draw, [24, ys, 42, ys+22], 4, BLUE)
        draw.text((27, ys+2), num, font=load_font(F_BOLD,13), fill=WHITE)
        draw.text((50, ys+2), step, font=fstep_r, fill=TEXT_DARK)
    y += 120

    # CTA 버튼
    draw_rounded_rect(draw, [24, y, W-24, y+58], 10, BLUE)
    btn_text = "세미나 신청 · 안내 보기  ▶"
    bb = draw.textbbox((0,0), btn_text, font=fbtn)
    draw.text(((W-(bb[2]-bb[0]))//2, y+14), btn_text, font=fbtn, fill=WHITE)
    y += 68

    # 오프라인 문의
    y += 14
    draw.text((24, y),    "오프라인 조찬세미나 문의",         font=foff_b, fill=TEXT_MID)
    draw.text((24, y+22), "010-5137-2327  (박재박 팀장)",    font=foff,   fill=TEXT_DARK)
    draw.text((24, y+42), "카카오톡 오픈채팅 문의 가능",      font=foff,   fill=TEXT_DARK)
    draw.text((24, y+62), f"오프라인 마감: {og_deadline}",    font=foff,   fill=(180,50,50))

    draw.rectangle([0, H-72, W, H], fill=NAVY)
    draw.text((24, H-60), "2030 Business Live ON",              font=ffoot_t, fill=WHITE)
    draw.text((24, H-42), "프리미엄 경영 세미나  ·  삼성금융캠퍼스", font=ffoot_r, fill=MID_GRAY)
    draw.text((24, H-24), "admin-samsung-vvip.web.app/invite",  font=ffoot_r, fill=(100,130,170))

    img.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) // 1024
    print(f"✅ 세로형 저장: {out_path}  ({size_kb} KB)")


if __name__ == "__main__":
    d = load_seminar_data()
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    assets_dir = os.path.join(base_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    make_wide_og(os.path.join(assets_dir, "og-kakao-wide.png"), d)
    make_vertical_card(os.path.join(assets_dir, "og-kakao-vertical.png"), d)
    print("\n🎉 이미지 생성 완료!")
