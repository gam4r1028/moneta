# -*- coding: utf-8 -*-
"""Генерация фирменных PNG-иконок «Копейки» без внешних ассетов."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, math

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, stops):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.62 + y * 0.38) / (size - 1)
            # многоцветный градиент
            pos = t * (len(stops) - 1)
            i = min(int(pos), len(stops) - 2)
            c = lerp(stops[i], stops[i + 1], pos - i)
            px[x, y] = c
    return img


def font(size, bold=True):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def make_icon(size, maskable=False):
    S = size * 4
    base = gradient(S, [(0x4F, 0xAC, 0xFE), (0x00, 0x7A, 0xFF), (0x58, 0x56, 0xD6), (0xAF, 0x52, 0xDE)])
    base = base.convert("RGBA")

    # мягкие световые пятна
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-S * .25, -S * .35, S * .72, S * .55), fill=(255, 255, 255, 62))
    gd.ellipse((S * .40, S * .55, S * 1.20, S * 1.30), fill=(255, 255, 255, 26))
    glow = glow.filter(ImageFilter.GaussianBlur(S // 18))
    base.alpha_composite(glow)

    # лёгкая сетка из бликов
    d = ImageDraw.Draw(base, "RGBA")
    for i in range(7):
        y = int(S * (0.12 + i * 0.13))
        d.arc((int(-S * .25), y, int(S * 1.25), y + int(S * .8)), 195, 345,
              fill=(255, 255, 255, 12), width=max(2, S // 360))

    # монета
    safe = 0.68 if maskable else 0.80
    coin = int(S * safe * 0.62)
    cx, cy = S // 2, S // 2
    box = (cx - coin // 2, cy - coin // 2, cx + coin // 2, cy + coin // 2)

    # тень монеты
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((box[0] - S*.012, box[1] + S*.035, box[2] + S*.012, box[3] + S*.06), fill=(9, 25, 63, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S // 55))
    base.alpha_composite(shadow)

    # тело монеты — золотой градиент
    coin_img = Image.new("RGBA", (coin, coin), (0, 0, 0, 0))
    cp = coin_img.load()
    gold_top, gold_mid, gold_bot = (255, 239, 159), (255, 198, 71), (221, 142, 27)
    for yy in range(coin):
        for xx in range(coin):
            t = (xx + yy) / (2 * (coin - 1))
            if t < .52:
                c = lerp(gold_top, gold_mid, t / .52)
            else:
                c = lerp(gold_mid, gold_bot, (t - .52) / .48)
            # диагональный блик
            sheen = max(0, 1 - abs((xx - yy * .35) / coin - .30) * 4.2)
            c = tuple(min(255, int(v + sheen * 24)) for v in c)
            cp[xx, yy] = (*c, 255)
    mask = Image.new("L", (coin, coin), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((0, 0, coin - 1, coin - 1), fill=255)
    coin_img.putalpha(mask)
    cd = ImageDraw.Draw(coin_img)
    # внутреннее кольцо
    inset = int(coin * .085)
    cd.ellipse((inset, inset, coin - inset, coin - inset), outline=(183, 112, 15, 115), width=max(3, coin // 50))
    cd.arc((inset, inset, coin - inset, coin - inset), 205, 330, fill=(255, 252, 224, 210), width=max(3, coin // 55))
    base.alpha_composite(coin_img, (cx - coin // 2, cy - coin // 2))

    # символ «К» с небольшой монетной насечкой
    f = font(int(coin * .56))
    text = "К"
    td = ImageDraw.Draw(base)
    tb = td.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    tx = cx - tw / 2 - tb[0]
    ty = cy - th / 2 - tb[1] - int(coin * .015)
    # тень буквы
    td.text((tx + max(2, coin // 90), ty + max(3, coin // 80)), text, font=f, fill=(130, 77, 7, 135))
    td.text((tx, ty), text, font=f, fill=(255, 251, 228, 255))

    # маленькая искра
    sx, sy = int(cx + coin * .46), int(cy - coin * .43)
    r = max(4, int(S * .022))
    td.ellipse((sx - r // 2, sy - r // 2, sx + r // 2, sy + r // 2), fill=(255, 255, 255, 235))
    td.line((sx - r * 2, sy, sx + r * 2, sy), fill=(255, 255, 255, 185), width=max(2, r // 4))
    td.line((sx, sy - r * 2, sx, sy + r * 2), fill=(255, 255, 255, 185), width=max(2, r // 4))

    # скругление для обычных иконок; maskable оставляем квадратной заливкой
    if not maskable:
        radius = int(S * .225)
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), radius=radius, fill=255)
        base.putalpha(m)

    return base.resize((size, size), Image.LANCZOS).convert("RGBA")


# Основные размеры + apple touch
for s in (192, 512):
    make_icon(s).save(os.path.join(OUT, f"icon-{s}.png"), optimize=True)
make_icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
make_icon(180).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
make_icon(64).save(os.path.join(OUT, "favicon-64.png"), optimize=True)
make_icon(32).save(os.path.join(OUT, "favicon-32.png"), optimize=True)
print("Иконки готовы:", ", ".join(sorted(os.listdir(OUT))))
