#!/usr/bin/env python3
import os

candidates = [
    r"C:\\Windows\\Fonts\\malgun.ttf",
    r"C:\\Windows\\Fonts\\malgunbd.ttf",
    r"C:\\Windows\\Fonts\\NanumGothic.ttf",
    r"C:\\Windows\\Fonts\\NanumGothicBold.ttf",
    r"C:\\Windows\\Fonts\\gulim.ttc",
    r"C:\\Windows\\Fonts\\malgun.ttf",
]

for p in candidates:
    print(p, 'exists' if os.path.exists(p) else 'missing')
