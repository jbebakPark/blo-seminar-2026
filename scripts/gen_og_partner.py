# -*- coding: utf-8 -*-
"""파트너 와인카드(A~D)용 고정 미리보기 이미지. 월간 세미나와 무관 — build_invite.py가 건드리지 않는다.
한 번 만들면 끝: python scripts/gen_og_partner.py  → assets/og-partner-wide.png"""
from PIL import Image, ImageDraw, ImageFont
import os
B = 'C:/Windows/Fonts/malgunbd.ttf'; R = 'C:/Windows/Fonts/malgun.ttf'
NAVY, GOLD, BLUE, INK, PALE = (13,26,46), (201,168,76), (16,80,160), (13,26,46), (240,244,251)
W, H = 1200, 630
im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
F = lambda s, f=B: ImageFont.truetype(f, s)
d.rectangle([0, 0, 180, H], fill=NAVY)
d.rectangle([180, 0, W, 8], fill=GOLD)
d.text((28, 250), 'GFC', font=F(62), fill=GOLD)
d.text((28, 330), 'BUSINESS', font=F(18), fill='white')
d.text((28, 354), 'CONSULTANT', font=F(18), fill='white')
d.rounded_rectangle([210, 40, 600, 84], radius=6, fill=BLUE)
d.text((228, 48), '기업재무컨설턴트 직무 안내', font=F(26), fill='white')
d.text((210, 130), '내 일을 내가 설계하는', font=F(66), fill=INK)
d.text((210, 214), '전문직 컨설턴트의 길', font=F(66), fill=INK)
d.rectangle([210, 304, 880, 310], fill=GOLD)
d.rounded_rectangle([210, 350, 1000, 500], radius=4, fill=PALE)
d.rectangle([210, 350, 216, 500], fill=BLUE)
d.text((246, 372), '설명만 들어 보셔도 됩니다', font=F(36), fill=BLUE)
d.text((246, 432), '궁금한 점은 소개해 드린 분께 편하게 문의하세요', font=F(28, R), fill=INK)
d.text((210, 560), '지인 소개 안내 자료', font=F(26, R), fill=(70, 82, 112))
d.rounded_rectangle([960, 540, 1180, 600], radius=8, fill=BLUE)
d.text((984, 552), "자세히 보기  >", font=F(28), fill='white')
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'og-partner-wide.png')
im.save(out); print('saved', out)
