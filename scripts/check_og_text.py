#!/usr/bin/env python3

from PIL import Image

paths = [
    "assets/og-kakao-wide.png",
    "assets/og-kakao-vertical.png",
]

out = []
for p in paths:
    try:
        img = Image.open(p)
    except Exception as e:
        out.append(f"{p}: ERROR open {e}")
        continue
    w, h = img.size
    # sample a few points where title text should exist (approx)
    samples = [
        (200, 110),
        (250, 130),
        (350, 130),
        (450, 130),
        (550, 130),
    ]
    vals = []
    for (x, y) in samples:
        if x < w and y < h:
            vals.append(f"({x},{y})={img.getpixel((x,y))}")
        else:
            vals.append(f"({x},{y})=out_of_bounds")
    out.append(f"{p} {w}x{h} -> " + "; ".join(vals))

with open("scripts/check_og_text.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
