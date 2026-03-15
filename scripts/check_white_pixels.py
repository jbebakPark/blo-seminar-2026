#!/usr/bin/env python3

from PIL import Image

paths = [
    "assets/og-kakao-wide.png",
    "assets/og-kakao-vertical.png",
]

for p in paths:
    img = Image.open(p).convert('RGB')
    w,h = img.size

    found = False
    for y in range(0, min(200, h)):
        for x in range(0, min(800, w)):
            r,g,b = img.getpixel((x,y))
            if r > 240 and g > 240 and b > 240:
                found = True
                break
        if found:
            break

    print(p, 'size', w, 'x', h, '=> white pixels in top area:', found)
