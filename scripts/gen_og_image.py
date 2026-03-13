#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BLO 세미나 OG 이미지 생성기 (카카오톡 공유용)
1200×630 가로형 + 630×1200 세로형
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ── 폰트 경로 ──────────────────────────────────────
FONT_BASE  = "/usr/share/fonts/truetype/nanum/"
F_BLACK    = FONT_BASE + "NanumSquare_acEB.ttf"   # 제목용 ExtraBold
F_BOLD     = FONT_BASE + "NanumSquareB.ttf"        # 소제목 Bold
F_REGULAR  = FONT_BASE + "NanumBarunGothic.ttf"    # 본문 Regular
F_BOLD2    = FONT_BASE + "NanumBarunGothicBold.ttf"

# ── 색상 팔레트 ────────────────────────────────────
NAVY       = (13, 26, 46)       # #0D1A2E
BLUE       = (16, 80, 160)      # #1050A0
LIGHT_BLUE = (26, 111, 232)     # #1A6FE8
GOLD       = (201, 168, 76)     # #C9A84C
WHITE      = (255, 255, 255)
LIGHT_GRAY = (240, 244, 250)    # #F0F4FA
MID_GRAY   = (180, 195, 215)
TEXT_DARK  = (20, 35, 60)       # 본문 진한색
TEXT_MID   = (60, 85, 120)


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()


def draw_multiline_centered(draw, text, x_center, y, font, fill, line_height=None):
    """여러 줄 텍스트를 중앙 정렬로 그리기"""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        w = bbox[2] - bbox[0]
        lh = line_height or (bbox[3] - bbox[1] + 8)
        draw.text((x_center - w // 2, y + i * lh), line, font=font, fill=fill)
    return y + len(lines) * (line_height or 40)


def draw_rounded_rect(draw, xy, radius, fill, outline=None, outline_width=1):
    """모서리 둥근 사각형"""
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


# ══════════════════════════════════════════════════
# 가로형 OG 이미지 1200×630 (카톡 링크 미리보기용)
# ══════════════════════════════════════════════════
def make_wide_og(out_path):
    W, H = 1200, 630
    img  = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    # ── 왼쪽 네이비 사이드바 (180px) ──
    draw.rectangle([0, 0, 180, H], fill=NAVY)

    # 사이드바: 월 숫자
    fnum = load_font(F_BLACK, 110)
    draw.text((18, 60), "03", font=fnum, fill=GOLD)

    fbadge_s = load_font(F_BOLD, 14)
    fbadge_m = load_font(F_BOLD, 13)
    draw.text((18, 185), "2030", font=fbadge_s, fill=WHITE)
    draw.text((18, 202), "BUSINESS", font=load_font(F_BOLD, 11), fill=MID_GRAY)
    draw.text((18, 217), "LIVE ON", font=load_font(F_BOLD, 11), fill=MID_GRAY)

    # 사이드바: 연도
    fy = load_font(F_REGULAR, 13)
    draw.text((18, 255), "2026", font=fy, fill=MID_GRAY)
    draw.text((18, 272), "MARCH", font=fy, fill=MID_GRAY)

    # 사이드바: 세로 장식선
    for i, (h_ratio, opacity) in enumerate([(0.55, 80), (0.72, 120), (0.85, 160), (0.65, 100), (0.78, 130)]):
        bar_h = int(H * h_ratio)
        bar_y = H - bar_h - 10
        alpha_color = tuple(int(c + (255-c)*opacity/255) for c in LIGHT_BLUE)
        draw.rectangle([152 + i*5, bar_y, 156 + i*5, H], fill=alpha_color)

    # ── 오른쪽 메인 영역 ──
    MX = 200  # 메인 시작 x

    # 상단 골드 포인트 라인
    draw.rectangle([MX, 0, W, 6], fill=GOLD)

    # BLO 뱃지
    fbadge = load_font(F_BOLD, 16)
    badge_text = "2030 BLO  3월 세미나"
    bb = draw.textbbox((0,0), badge_text, font=fbadge)
    bw = bb[2] - bb[0] + 28
    draw_rounded_rect(draw, [MX, 20, MX + bw, 48], 4, BLUE)
    draw.text((MX + 14, 26), badge_text, font=fbadge, fill=WHITE)

    # 메인 제목
    ft1 = load_font(F_BLACK, 50)
    ft2 = load_font(F_BLACK, 48)
    draw.text((MX, 68), "피지컬 AI와 로봇", font=ft1, fill=NAVY)
    draw.text((MX, 126), "대항해의 시대", font=ft2, fill=NAVY)

    # 구분선
    draw.rectangle([MX, 192, MX + 480, 195], fill=GOLD)

    # 부제목
    fsub = load_font(F_BOLD2, 20)
    draw.text((MX, 205), "Physical AI & Robot Navigation Era", font=fsub, fill=LIGHT_BLUE)

    # 이벤트 정보 박스
    draw.rectangle([MX, 245, MX + 720, 355], fill=LIGHT_GRAY)
    draw.rectangle([MX, 245, MX + 4, 355], fill=BLUE)  # 왼쪽 강조선

    finfo_l = load_font(F_BOLD2, 18)
    finfo_r = load_font(F_REGULAR, 18)

    info_items = [
        ("📅  일  시", "2026. 3. 24 (화)  오전 7:30 ~ 9:00"),
        ("🎓  강  사", "조규진 교수  ·  서울대학교 기계공학과"),
        ("💻  신  청", "www.samsung2030blo.com"),
    ]
    for i, (label, value) in enumerate(info_items):
        y = 258 + i * 32
        draw.text((MX + 18, y), label, font=finfo_l, fill=BLUE)
        draw.text((MX + 145, y), value, font=finfo_r, fill=TEXT_DARK)

    # 하단: 강사 프로필 칩들
    fchip = load_font(F_REGULAR, 15)
    chips = ["인간중심 소프트로봇 연구센터장", "IEEE RAS 부회장", "카카오 사외이사", "Harvard 포스닥"]
    cx = MX
    cy = 370
    for chip in chips:
        cb = draw.textbbox((0,0), chip, font=fchip)
        cw = cb[2] - cb[0] + 20
        if cx + cw > W - 20:
            cx = MX
            cy += 30
        draw_rounded_rect(draw, [cx, cy, cx+cw, cy+24], 12, (230, 238, 252))
        draw.text((cx+10, cy+4), chip, font=fchip, fill=BLUE)
        cx += cw + 8

    # 우하단: CTA 버튼
    btn_x1, btn_y1 = W - 240, H - 75
    btn_x2, btn_y2 = W - 20,  H - 25
    draw_rounded_rect(draw, [btn_x1, btn_y1, btn_x2, btn_y2], 8, BLUE)
    fbtn = load_font(F_BOLD2, 18)
    btn_text = "세미나 신청하기 ▶"
    bb2 = draw.textbbox((0,0), btn_text, font=fbtn)
    bw2 = bb2[2] - bb2[0]
    bh2 = bb2[3] - bb2[1]
    draw.text((btn_x1 + (220-bw2)//2, btn_y1 + (50-bh2)//2), btn_text, font=fbtn, fill=WHITE)

    # 추천인 코드
    fcode_l = load_font(F_REGULAR, 16)
    fcode_v = load_font(F_BOLD2, 18)
    draw.text((MX, H-65), "추천인 코드", font=fcode_l, fill=TEXT_MID)
    draw.text((MX + 95, H-67), "9618628", font=fcode_v, fill=GOLD)

    # 하단 바
    draw.rectangle([0, H-22, W, H], fill=NAVY)
    ffoot = load_font(F_REGULAR, 13)
    draw.text((MX, H-17), "admin-samsung-vvip.web.app/invite.html", font=ffoot, fill=MID_GRAY)

    img.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) // 1024
    print(f"✅ 가로형 저장: {out_path}  ({size_kb} KB)")


# ══════════════════════════════════════════════════
# 세로형 카드 630×1200 (카톡 이미지 첨부용)
# ══════════════════════════════════════════════════
def make_vertical_card(out_path):
    W, H = 630, 1200
    img  = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    # ── 상단 헤더 (높이 260) ──
    draw.rectangle([0, 0, W, 260], fill=NAVY)

    # 오른쪽 장식 세로선
    for i, (h_ratio, c) in enumerate([(0.6, 40), (0.8, 70), (1.0, 100), (0.75, 60), (0.55, 40), (0.9, 80)]):
        bar_h = int(260 * h_ratio)
        lc = tuple(min(255, LIGHT_BLUE[j] + c) for j in range(3))
        draw.rectangle([W - 50 + i*8, 260-bar_h, W - 46 + i*8, 260], fill=lc)

    # BLO 뱃지
    fb = load_font(F_BOLD, 13)
    draw.rectangle([24, 24, 24+170, 24+28], fill=BLUE)
    draw.text((30, 28), "2030 BUSINESS LIVE ON", font=fb, fill=WHITE)

    # 월 숫자
    fmn = load_font(F_BLACK, 100)
    draw.text((20, 55), "03", font=fmn, fill=GOLD)

    # 연월 텍스트
    fmy = load_font(F_BOLD, 18)
    draw.text((20, 162), "2026 MARCH", font=fmy, fill=MID_GRAY)

    # 제목
    ft = load_font(F_BLACK, 44)
    draw.text((24, 195), "피지컬 AI와 로봇", font=ft, fill=WHITE)
    ft2 = load_font(F_BLACK, 40)
    draw.text((24, 245), "대항해의 시대", font=ft2, fill=GOLD)

    # ── 본문 영역 ──
    # 배경 그라데이션 효과 (단순 연회색)
    draw.rectangle([0, 260, W, H], fill=(248, 250, 253))

    # 구분선
    draw.rectangle([24, 280, W-24, 283], fill=GOLD)

    # 부제목
    fsub = load_font(F_BOLD2, 19)
    draw.text((24, 294), "Physical AI & Robot Navigation Era", font=fsub, fill=LIGHT_BLUE)

    # ─ 세미나 정보 카드 ─
    draw.rectangle([24, 330, W-24, 510], fill=WHITE)
    draw.rectangle([24, 330, W-24, 331+4], fill=BLUE)  # 상단 강조

    fcard_l = load_font(F_BOLD2, 17)
    fcard_r = load_font(F_REGULAR, 17)

    card_items = [
        ("📅 일  시", "2026. 3. 24 (화)"),
        ("",          "오전 7:30 ~ 9:00"),
        ("",          "재방송 20:00 ~ 22:00"),
        ("🎓 강  사", "조규진 교수"),
        ("",          "서울대학교 기계공학과"),
        ("💻 신  청", "www.samsung2030blo.com"),
        ("📍 장  소", "삼성금융캠퍼스 B2F 비전홀"),
    ]
    y = 345
    prev_had_label = False
    for label, value in card_items:
        if label:
            draw.text((38, y), label, font=fcard_l, fill=BLUE)
            draw.text((145, y), value, font=fcard_r, fill=TEXT_DARK)
            prev_had_label = True
        else:
            draw.text((145, y), value, font=fcard_r, fill=TEXT_MID)
        y += 26

    # ─ 강사 프로필 카드 ─
    draw.rectangle([24, 525, W-24, 690], fill=WHITE)
    draw.rectangle([24, 525, 28, 690], fill=GOLD)  # 왼쪽 강조

    fprof_t = load_font(F_BLACK, 22)
    fprof_s = load_font(F_BOLD2, 17)
    fprof_r = load_font(F_REGULAR, 15)

    draw.text((40, 535), "조규진 교수", font=fprof_t, fill=NAVY)
    draw.text((40, 563), "서울대학교 기계공학과", font=fprof_s, fill=BLUE)

    prof_items = [
        "· 인간중심 소프트로봇 연구센터장",
        "· 카카오 사외이사",
        "· IEEE RAS 부회장",
        "· Harvard Microrobotics Lab 포스닥",
    ]
    for i, item in enumerate(prof_items):
        draw.text((40, 590 + i*24), item, font=fprof_r, fill=TEXT_DARK)

    # ─ 추천인 코드 박스 ─
    draw_rounded_rect(draw, [24, 705, W-24, 790], 10, (240, 246, 255))
    draw.rectangle([24, 705, 28, 790], fill=BLUE)

    fcode_t = load_font(F_BOLD2, 16)
    fcode_v = load_font(F_BLACK, 36)
    draw.text((40, 715), "⚠  온라인 신청 시 반드시 입력하세요", font=fcode_t, fill=BLUE)
    draw.text((40, 738), "추천인 코드", font=fcode_t, fill=TEXT_MID)

    # 코드값 강조
    code_text = "9618628"
    cb = draw.textbbox((0,0), code_text, font=fcode_v)
    cw = cb[2] - cb[0]
    draw_rounded_rect(draw, [W//2 - cw//2 - 16, 732, W//2 + cw//2 + 16, 785], 8, NAVY)
    draw.text((W//2 - cw//2, 737), code_text, font=fcode_v, fill=GOLD)

    # ─ 신청 방법 ─
    fstep_t = load_font(F_BOLD2, 17)
    fstep_r = load_font(F_REGULAR, 16)
    draw.text((24, 810), "온라인 신청 방법", font=fstep_t, fill=NAVY)

    steps = [
        ("①", "samsung2030blo.com 접속"),
        ("②", "추천인 코드 9618628 입력"),
        ("③", "3/24 오전 7:15 생방송 입장"),
    ]
    for i, (num, step) in enumerate(steps):
        y_s = 835 + i * 32
        draw_rounded_rect(draw, [24, y_s, 44, y_s+24], 4, BLUE)
        draw.text((28, y_s+2), num, font=load_font(F_BOLD, 14), fill=WHITE)
        draw.text((52, y_s+2), step, font=fstep_r, fill=TEXT_DARK)

    # ─ CTA 버튼 ─
    btn_y = 950
    draw_rounded_rect(draw, [24, btn_y, W-24, btn_y+62], 10, BLUE)
    fbtn = load_font(F_BLACK, 22)
    btn_text = "세미나 신청 · 안내 보기  ▶"
    bb = draw.textbbox((0,0), btn_text, font=fbtn)
    bw = bb[2] - bb[0]
    draw.text(((W-bw)//2, btn_y+16), btn_text, font=fbtn, fill=WHITE)

    # 오프라인 문의
    foff = load_font(F_REGULAR, 15)
    foff_b = load_font(F_BOLD2, 15)
    draw.text((24, 1030), "오프라인 조찬세미나 문의", font=foff_b, fill=TEXT_MID)
    draw.text((24, 1052), "📞  010-5137-2327  (박재박 팀장)", font=foff, fill=TEXT_DARK)
    draw.text((24, 1074), "💬  카카오톡 오픈채팅 문의 가능", font=foff, fill=TEXT_DARK)
    draw.text((24, 1096), "📅  오프라인 신청 마감: 3/19 (목) 17:00", font=foff, fill=(180, 50, 50))

    # ─ 하단 바 ─
    draw.rectangle([0, H-80, W, H], fill=NAVY)
    ffoot_t = load_font(F_BOLD, 16)
    ffoot_r = load_font(F_REGULAR, 13)
    draw.text((24, H-68), "2030 Business Live ON", font=ffoot_t, fill=WHITE)
    draw.text((24, H-48), "프리미엄 경영 세미나  ·  삼성금융캠퍼스", font=ffoot_r, fill=MID_GRAY)
    draw.text((24, H-28), "admin-samsung-vvip.web.app/invite.html", font=ffoot_r, fill=(100, 130, 170))

    img.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) // 1024
    print(f"✅ 세로형 저장: {out_path}  ({size_kb} KB)")


if __name__ == "__main__":
    os.makedirs("/home/user/webapp/assets", exist_ok=True)
    make_wide_og("/home/user/webapp/assets/og-kakao-wide.png")
    make_vertical_card("/home/user/webapp/assets/og-kakao-vertical.png")
    print("\n🎉 이미지 생성 완료!")
