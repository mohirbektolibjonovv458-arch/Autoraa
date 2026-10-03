"""OSM ranglaridagi sinov plitalari (faqat ko'rinishni tekshirish uchun; haqiqiy plitalar serverda OSM'dan olinadi)."""
import math, os, random, sys
from PIL import Image, ImageDraw
out = sys.argv[1]
def tile(lat, lng, z):
    n = 2 ** z; x = int((lng + 180) / 360 * n); y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n); return x, y
for z in range(10, 17):
    cx, cy = tile(41.311, 69.28, z)
    r = 3 if z < 15 else 4
    for x in range(cx - r, cx + r + 1):
        for y in range(cy - r, cy + r + 1):
            rnd = random.Random(z * 100000 + x * 1000 + y)
            im = Image.new("RGB", (256, 256), "#f2efe9"); d = ImageDraw.Draw(im)
            for _ in range(2):  # park / bino bloklari
                a, b = rnd.randint(0, 200), rnd.randint(0, 200)
                d.rectangle([a, b, a + rnd.randint(30, 90), b + rnd.randint(30, 90)], fill=rnd.choice(["#c8facc", "#d9d0c9", "#e0dfdf"]))
            if (x + y) % 5 == 0:
                d.line([(0, rnd.randint(0, 256)), (256, rnd.randint(0, 256))], fill="#aad3df", width=14)  # kanal / ariq
            for i in range(4):  # ko'chalar
                w = 9 if i == 0 else 5
                if i % 2: p = [(0, rnd.randint(0, 256)), (256, rnd.randint(0, 256))]
                else: p = [(rnd.randint(0, 256), 0), (rnd.randint(0, 256), 256)]
                d.line(p, fill="#c9bfb4", width=w + 3); d.line(p, fill="#fcd6a4" if i == 0 else "#ffffff", width=w)
            pth = os.path.join(out, str(z), str(x)); os.makedirs(pth, exist_ok=True)
            im.save(os.path.join(pth, f"{y}.img"), "PNG")
print("ok")
