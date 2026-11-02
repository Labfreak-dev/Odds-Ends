#!/usr/bin/env python3
"""Floor grid detector: flags a tiled checkerboard floor in a gameplay screenshot.
Blurred Lab colour -> 2-class k-means (material regions, cobble detail ignored) -> region contours ->
polygon fit. A tiled floor's regions are bounded by long straight seams; a blended floor's are organic.
score = share of region-boundary length lying on straight segments longer than 12% of the view
(segments on the crop border excluded). FAIL when score > 0.35 with >= 4 long seams. Usage: floorgrid.py img [img...]"""
import sys, cv2, numpy as np
def score(path):
    im = cv2.imread(path); h, w = im.shape[:2]; s = 1170 / max(w, h)
    im = cv2.resize(im, (int(w * s), int(h * s))); h, w = im.shape[:2]
    roi = im[int(h*.12):int(h*.92), int(w*.18):int(w*.74)] if w > h else im[int(h*.08):int(h*.88)]
    H, W = roi.shape[:2]
    lab = cv2.GaussianBlur(cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32), (0, 0), 5)
    _, lbl, cen = cv2.kmeans(lab.reshape(-1, 3), 2, None, (3, 20, .5), 3, cv2.KMEANS_PP_CENTERS)
    if np.linalg.norm(cen[0] - cen[1]) < 12: return 0.0, 0
    m = lbl.reshape(H, W).astype(np.uint8) * 255
    m = cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    straight = total = 0.0; n = 0; minL = 0.12 * max(W, H)
    for mm in (m, 255 - m):
        cs, _ = cv2.findContours(mm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        for c in cs:
            if cv2.contourArea(c) < 0.02 * W * H: continue
            poly = cv2.approxPolyDP(c, 2.5, True).reshape(-1, 2)
            for i in range(len(poly)):
                (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
                L = float(np.hypot(int(x2) - int(x1), int(y2) - int(y1)))
                onBorder = (min(x1, x2) <= 3 and max(x1, x2) <= 3) or (min(x1, x2) >= W - 4) or (max(y1, y2) <= 3) or (min(y1, y2) >= H - 4)
                if onBorder: continue
                total += L
                if L >= minL: straight += L; n += 1
    return (straight / total if total > 0 else 0.0), n
if __name__ == '__main__':
    bad = 0
    for p in sys.argv[1:]:
        sc, n = score(p); f = sc > 0.35 and n >= 4; bad += f
        print(f"floorgrid {p} seams={n} score={sc:.2f} {'FAIL tiled floor' if f else 'ok'}")
    sys.exit(1 if bad else 0)
