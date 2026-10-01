"""Marshrut chizig'i ustida hisob-kitob: nuqtani yo'lga proyeksiyalash (yo'l boshidan masofa, yo'ldan chetlanish)."""
import math

K_LAT = 111.0


class Polyline:
    def __init__(self, points):
        pts = [(float(a), float(b)) for a, b in points]
        self.segs, cum = [], 0.0
        for (a1, o1), (a2, o2) in zip(pts, pts[1:]):
            k_lo = 111.0 * math.cos(math.radians((a1 + a2) / 2))
            dx, dy = (o2 - o1) * k_lo, (a2 - a1) * K_LAT
            L = math.hypot(dx, dy)
            self.segs.append((a1, o1, dx, dy, L, cum, k_lo))
            cum += L
        self.total_km = cum
        lats, lngs = [p[0] for p in pts], [p[1] for p in pts]
        self.bbox = (min(lats), min(lngs), max(lats), max(lngs))

    def project(self, lat, lng):
        """-> (yo'l boshidan km, yo'ldan chetlanish km)"""
        best = None
        for a1, o1, dx, dy, L, c0, k_lo in self.segs:
            px, py = (lng - o1) * k_lo, (lat - a1) * K_LAT
            t = 0.0 if L == 0 else max(0.0, min(1.0, (px * dx + py * dy) / (L * L)))
            off = math.hypot(px - t * dx, py - t * dy)
            if best is None or off < best[1]:
                best = (c0 + t * L, off)
        return best or (0.0, 0.0)

    def expanded_bbox(self, km):
        s, w, n, e = self.bbox
        d_la = km / 111.0
        d_lo = km / (111.0 * max(0.2, math.cos(math.radians((s + n) / 2))))
        return s - d_la, w - d_lo, n + d_la, e + d_lo
