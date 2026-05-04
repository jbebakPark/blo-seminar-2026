#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BLO 월별 자동 빌드 스크립트
data/current-seminar.json 하나만 수정하면 실행됩니다.

생성물:
  - invite.html       (invite.template.html + JSON → 완성본)
  - assets/og-kakao-wide.png
  - assets/og-kakao-vertical.png
"""

import json
import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def load_data():
    path = os.path.join(BASE_DIR, "data", "current-seminar.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)

# ─────────────────────────────────────────────
# 연간 세미나 고정 일정 (변경 시 여기만 수정)
# ─────────────────────────────────────────────
ANNUAL_SCHEDULE = [
    # (month, day, quarter, label, title, speaker)
    (1,  13, 1, "1Q", "AI시대, 인간의 판단력은 어디로?",          "송길영 작가 · 이동우 교수"),
    (2,  24, 1, "1Q", "인류의 새로운 도전, 우주 탐사와 그 너머",  "강성주 박사"),
    (3,  24, 1, "1Q", "피지컬 AI와 로봇 대항해의 시대",            "조규진 교수 · 서울대학교 기계공학과"),
    (4,  21, 2, "2Q", "AI 반도체가 주도하는 금융시장",             "김선우 애널리스트 · 메리츠증권"),
    (5,  19, 2, "2Q", None, None),   # current-seminar.json 에서 읽음
    (6,  16, 2, "2Q", None, None),
    (7,  21, 3, "3Q", None, None),
    (8,  18, 3, "3Q", None, None),
    (9,  15, 3, "3Q", None, None),
    (10, 20, 4, "4Q", None, None),
    (11, 17, 4, "4Q", None, None),
    (12, 15, 4, "4Q", None, None),
]

Q_LABELS = {
    1: "1Q · Tech Insight, 차세대 혁신 기술",
    2: "2Q · Money Insight, 변화하는 자산 시장",
    3: "3Q · Human Insight, 리더십과 비즈니스",
    4: "4Q · Future Insight, 2027 전망",
}
MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]


# ─────────────────────────────────────────────
# HTML 생성 헬퍼
# ─────────────────────────────────────────────

def speakers_html(d):
    speakers = d.get("speakers", [])
    parts_parts = []
    rows = []
    for sp in speakers:
        part = sp.get("part","")
        parts_parts.append(part)
        part_class = sp.get("partClass","")
        circle_class = sp.get("circleClass","")
        name = sp.get("name","")
        title = sp.get("title","")
        creds = sp.get("credentials",[])
        cred_html = "".join(f'<span class="sp-cred">{c}</span>' for c in creds)
        badge_cls = f"part-badge {part_class}".strip()
        circle_cls = f"sp-circle {circle_class}".strip()
        rows.append(f"""  <div class="speaker-row">
    <div class="{badge_cls}">{part}</div>
    <div class="{circle_cls}">
      <div class="sp-circle-name">{name}</div>
      <div class="sp-circle-title">{title}</div>
    </div>
    <div class="sp-detail">
      <div class="sp-name">{name} <span>{title}</span></div>
      <div class="sp-creds">{cred_html}</div>
    </div>
  </div>""")
    return "\n".join(rows), " + ".join(parts_parts)


def body_html(d):
    paras = d.get("bodyParagraphs", [])
    return "\n".join(f"  <p>{p}</p>" for p in paras)


def hero_h1(d):
    l1 = d.get("titleLine1","")
    l2 = d.get("titleLine2","")
    l3 = d.get("titleLine3","")
    em = d.get("titleLine1Em", False)
    line1 = f"<em>{l1}</em>" if em else l1
    parts = [line1]
    if l2: parts.append(l2)
    if l3: parts.append(l3)
    return "<br>".join(parts)


def schedule_html(d):
    cur_month = int(d.get("month", "1"))
    cur_title   = d.get("titleLine1","") + " " + d.get("titleLine2","") + " " + d.get("titleLine3","")
    cur_title   = cur_title.strip()
    speakers    = d.get("speakers", [])
    cur_speaker = " · ".join(f"{sp['name']} {sp['title']} ({sp['part']})" for sp in speakers)

    # 분기별로 패널 생성
    panels = {1:[], 2:[], 3:[], 4:[]}
    active_q = 1
    for (mo, day, q, qlabel, title, speaker) in ANNUAL_SCHEDULE:
        if mo == cur_month:
            active_q = q
            title   = cur_title
            speaker = cur_speaker
            status_class = "current"
            date_str = f"{mo}/{day} (화) 오전 7:30"
            status_html = '<span class="sched-status now">▶ 신청중</span>'
            panels[q].append(f"""      <div class="sched-item current">
        <div class="sched-dot"></div>
        <div>
          <div class="sched-date">{date_str}</div>
          {status_html}
          <div class="sched-title-text">{title}</div>
          <div class="sched-speaker">{speaker}</div>
        </div>
      </div>""")
        elif mo < cur_month:
            date_str = f"{mo}/{day} (화)"
            title   = title or f"{MONTH_NAMES[mo-1]} 강연"
            speaker = speaker or ""
            speaker_html = f'\n          <div class="sched-speaker">{speaker}</div>' if speaker else ""
            panels[q].append(f"""      <div class="sched-item completed">
        <div class="sched-dot"></div>
        <div>
          <div class="sched-date">{date_str}</div>
          <div class="sched-title-text">{title}</div>{speaker_html}
          <span class="sched-status done">✓ 완료</span>
        </div>
      </div>""")
        else:
            date_str = f"{mo}/{day} (화)"
            title   = title or f"{MONTH_NAMES[mo-1]} 강연 (추후 공지)"
            panels[q].append(f"""      <div class="sched-item upcoming">
        <div class="sched-dot"></div>
        <div>
          <div class="sched-date">{date_str}</div>
          <div class="sched-title-text">{title}</div>
          <span class="sched-status soon">예정</span>
        </div>
      </div>""")

    html_parts = []
    for q in [1, 2, 3, 4]:
        active_class = " active" if q == active_q else ""
        items = "\n".join(panels[q])
        html_parts.append(f"""  <!-- Q{q} 패널 -->
  <div class="q-panel{active_class}" id="qpanel{q}">
    <div class="sched-quarter">
      <div class="sched-q-label">{Q_LABELS[q]}</div>
{items}
    </div>
  </div>""")
    return "\n\n".join(html_parts)


def parts_label(d):
    speakers = d.get("speakers",[])
    return " + ".join(sp.get("part","") for sp in speakers) if len(speakers) > 1 else "단독"


def watch_date(d):
    mo = d.get("month","5")
    # ANNUAL_SCHEDULE에서 해당 달의 day 찾기
    for (month, day, *_) in ANNUAL_SCHEDULE:
        if str(month) == str(int(mo)):
            return f"{int(mo)}/{day}(화)"
    return f"{int(mo)}월 강연일"


# ─────────────────────────────────────────────
# invite.html 빌드
# ─────────────────────────────────────────────

def build_invite(d):
    tmpl_path = os.path.join(BASE_DIR, "invite.template.html")
    out_path  = os.path.join(BASE_DIR, "invite.html")

    with open(tmpl_path, encoding="utf-8") as f:
        html = f.read()

    sp_html, sp_title_parts = speakers_html(d)
    sp_title = f"강사 소개 · {sp_title_parts}" if sp_title_parts else "강사 소개"

    replacements = {
        "{{OG_TITLE}}":             d.get("ogTitle",""),
        "{{OG_DESC}}":              d.get("ogDescription",""),
        "{{OG_VER}}":               str(d.get("ogImageVersion","1")),
        "{{PAGE_TITLE}}":           d.get("ogTitle","").replace(" | 세미나","") or "2030 BLO",
        "{{HERO_TAG}}":             d.get("heroTag",""),
        "{{HERO_MONTH}}":           d.get("month",""),
        "{{HERO_LABEL}}":           d.get("heroLabel",""),
        "{{HERO_H1}}":              hero_h1(d),
        "{{HERO_SUB}}":             d.get("subtitle",""),
        "{{SPEAKERS_TITLE}}":       sp_title_parts + " 부" if sp_title_parts else "강사 소개",
        "{{SPEAKERS_HTML}}":        sp_html,
        "{{EVENT_DATE}}":           d.get("eventDate",""),
        "{{EVENT_TIME_PARTS}}":     d.get("eventTimeParts",""),
        "{{OFFLINE_DEADLINE_SHORT}}": d.get("offlineDeadlineShort",""),
        "{{BODY_HTML}}":            body_html(d),
        "{{OFFLINE_DEADLINE}}":     d.get("offlineDeadline",""),
        "{{SEMINAR_TIME}}":         d.get("seminarTime",""),
        "{{PARTS_LABEL}}":          parts_label(d),
        "{{WATCH_DATE}}":           watch_date(d),
        "{{SCHEDULE_HTML}}":        schedule_html(d),
        "{{STICKY_CTA}}":           d.get("stickyCta",""),
    }

    for key, val in replacements.items():
        html = html.replace(key, val)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✅ invite.html 생성 완료: {out_path}")


# ─────────────────────────────────────────────
# OG 이미지 빌드 (gen_og_image.py 재사용)
# ─────────────────────────────────────────────

def build_og_images(d):
    """gen_og_image.py의 함수들을 data 기반으로 호출"""
    import importlib.util, sys as _sys

    og_script = os.path.join(BASE_DIR, "scripts", "gen_og_image.py")
    spec = importlib.util.spec_from_file_location("gen_og", og_script)
    gen_og = importlib.util.module_from_spec(spec)

    # __file__ 주입
    gen_og.__file__ = og_script
    spec.loader.exec_module(gen_og)

    assets_dir = os.path.join(BASE_DIR, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    gen_og.make_wide_og(os.path.join(assets_dir, "og-kakao-wide.png"))
    gen_og.make_vertical_card(os.path.join(assets_dir, "og-kakao-vertical.png"))


# ─────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("BLO 월별 자동 빌드 시작")
    print("=" * 50)

    d = load_data()
    month_kor = d.get("monthKor","?")
    print(f"  대상 월: {d.get('year','')}년 {month_kor} ({d.get('titleLine1','')} {d.get('titleLine2','')})")
    print()

    print("[1/2] invite.html 빌드 중...")
    build_invite(d)

    print("[2/2] OG 이미지 생성 중...")
    try:
        build_og_images(d)
    except Exception as e:
        print(f"  ⚠️ OG 이미지 생성 실패 (Pillow 미설치?): {e}")
        print("  → pip install Pillow 후 재시도하거나 GitHub Actions에서 자동 처리됩니다.")

    print()
    print("=" * 50)
    print(f"✅ {month_kor} 빌드 완료!")
    print("   git add invite.html assets/og-kakao-wide.png assets/og-kakao-vertical.png")
    print("   git commit -m 'feat: {month_kor} 세미나 자동 빌드'")
    print("   git push  →  GitHub Actions가 자동 배포합니다")
    print("=" * 50)
