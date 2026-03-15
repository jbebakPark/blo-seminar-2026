#!/usr/bin/env python3

import pathlib

patterns = {
    'correct': '대항해의 시대'.encode('utf-8'),
    'wrong': '대항해의 이타'.encode('utf-8'),
}

for fn in ['assets/og-kakao-wide.png', 'assets/og-kakao-vertical.png']:
    path = pathlib.Path(fn)
    if not path.exists():
        print(fn, 'missing')
        continue
    data = path.read_bytes()
    found = {k: (v in data) for k, v in patterns.items()}
    print(fn, 'size', path.stat().st_size, found)
