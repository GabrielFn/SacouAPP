"""Turns the silhouette drawn by Gabriel (Gemini, black on a painted checkerboard) into Sacou icons."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

NAVY = (15, 27, 45)
ORANGE = (255, 90, 31)
YELLOW = (255, 200, 61)
CREAM = (246, 241, 231)

SIZE = 1024
# Dark ink: fully opaque at or below DARK, fully transparent at or above LIGHT (soft, anti-aliased edge).
DARK, LIGHT = 60, 150
# The ball, seen in the source: a separate disc near the top right.
BALL_CENTER, BALL_RADIUS = (795, 135), 60

gray = np.asarray(Image.open(SRC).convert("L"), dtype=np.float32)
alpha = np.clip((LIGHT - gray) / (LIGHT - DARK), 0, 1)

h, w = alpha.shape
yy, xx = np.mgrid[0:h, 0:w]
in_ball = (xx - BALL_CENTER[0]) ** 2 + (yy - BALL_CENTER[1]) ** 2 <= BALL_RADIUS**2
ball_alpha = np.where(in_ball, alpha, 0)
body_alpha = np.where(in_ball, 0, alpha)

ys, xs = np.nonzero(alpha > 0.5)
top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
print("content box", left, top, right, bottom)


def crop(a: np.ndarray) -> Image.Image:
    return Image.fromarray((a[top : bottom + 1, left : right + 1] * 255).astype(np.uint8), "L")


body = crop(body_alpha)
ball = crop(ball_alpha)


def layer(fill_body, fill_ball, content: float) -> Image.Image:
    """The figure and ball on a transparent 1024 square, the content box `content` of the side, centred."""
    box = int(SIZE * content)
    scale = box / max(body.width, body.height)
    size = (round(body.width * scale), round(body.height * scale))
    b = body.resize(size, Image.LANCZOS).filter(ImageFilter.SMOOTH)
    o = ball.resize(size, Image.LANCZOS).filter(ImageFilter.SMOOTH)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pos = ((SIZE - size[0]) // 2, (SIZE - size[1]) // 2)
    canvas.paste(Image.new("RGBA", size, fill_body + (255,)), pos, b)
    canvas.paste(Image.new("RGBA", size, fill_ball + (255,)), pos, o)
    return canvas


def full(bg, fill_body, fill_ball, disc=None) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), bg + (255,))
    if disc:
        r = int(SIZE * 0.36)
        ImageDraw.Draw(img).ellipse(
            (SIZE // 2 - r, SIZE // 2 - r, SIZE // 2 + r, SIZE // 2 + r), fill=disc + (255,)
        )
    img.alpha_composite(layer(fill_body, fill_ball, 0.72))
    return img


variants = {
    "a": (ORANGE, NAVY, YELLOW, None),
    "b": (NAVY, CREAM, YELLOW, None),
    "c": (CREAM, NAVY, YELLOW, ORANGE),
}
for name, (bg, fb, fo, disc) in variants.items():
    full(bg, fb, fo, disc).convert("RGB").save(OUT / f"icone-{name}.png")
    # Adaptive icon foreground: content inside the 66/108 safe zone.
    layer(fb, fo, 0.50).save(OUT / f"icone-{name}-foreground.png")

# One sheet to compare: each option big, at 96 and at 48, with the Android round mask.
sheet = Image.new("RGB", (3 * 420 + 80, 560), (255, 255, 255))
for i, name in enumerate(variants):
    icon = Image.open(OUT / f"icone-{name}.png")
    x = 40 + i * 420
    big = icon.resize((360, 360), Image.LANCZOS)
    mask = Image.new("L", (360, 360), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 359, 359), radius=80, fill=255)
    sheet.paste(big, (x, 40), mask)
    for size, dx in ((96, 0), (48, 120)):
        small = icon.resize((size, size), Image.LANCZOS)
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
        sheet.paste(small, (x + dx, 430 + (96 - size) // 2), m)
sheet.save(OUT / "comparacao.png")
print("ok")
