"""Marshrut geometriyasi: nuqtani yo'lga «yopishtirish» va yo'l bo'yidagi obyektlarni topish (tekis proyeksiya, km)."""
import math

K_LAT = 111.0


def prepare(line):
    """line: [(lat, lng), ...] (≤ ~500 nuqta) -> segmentlar ro'yxati va umumiy uzunlik (km)"""
    segs, cum = [], 0.0
    for (a1, o1), (a2, o2) in zip(line, line[1:]):
        k_lo = K_LAT * math.cos(math.radians((a1 + a2) / 2))
        dx, dy = (o2 - o1) * k_lo, (a2 - a1) * K_LAT
        L = math.hypot(dx, dy)
        segs.append((a1, o1, dx, dy, L, cum, k_lo))
        cum += L
    return segs, cum


def snap(segs, lat, lng):
    """-> (yo'ldan uzoqlik km, yo'l boshidan masofa km)"""
    best = None
    for a1, o1, dx, dy, L, c0, k_lo in segs:
        px, py = (lng - o1) * k_lo, (lat - a1) * K_LAT
        t = 0.0 if L == 0 else max(0.0, min(1.0, (px * dx + py * dy) / (L * L)))
        off = math.hypot(px - t * dx, py - t * dy)
        if best is None or off < best[0]:
            best = (off, c0 + t * L)
    return best or (float("inf"), 0.0)


def simplify(points, limit=500):
    step = max(1, len(points) // limit)
    out = points[::step]
    if out[-1] != points[-1]:
        out.append(points[-1])
    return out


def bbox(line, buf_km):
    la = [p[0] for p in line]; lo = [p[1] for p in line]
    d_la = buf_km / K_LAT
    d_lo = buf_km / (K_LAT * math.cos(math.radians(sum(la) / len(la))))
    return min(la) - d_la, max(la) + d_la, min(lo) - d_lo, max(lo) + d_lo


def along(segs, objs, buf_km, getpos):
    """objs ichidan yo'lga buf_km dan yaqinlarini topadi: [(obj, along_km, off_km)], yo'l bo'yicha tartiblangan"""
    out = []
    for o in objs:
        la, lo = getpos(o)
        if la is None or lo is None:
            continue
        off, al = snap(segs, la, lo)
        if off <= buf_km:
            out.append((o, al, off))
    out.sort(key=lambda x: x[1])
    return out
