#!/usr/bin/env python3
"""Build a crisp JellyGlance star-roster PNG (PFP left of each name)."""
from __future__ import annotations

import json
import math
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Brand
PURPLE = (170, 92, 195)
PURPLE_DIM = (120, 70, 145)
GOLD = (245, 200, 90)
BG = (18, 19, 22)
SURFACE = (28, 30, 36)
TEXT = (245, 246, 250)
MUTED = (148, 153, 163)
HAIRLINE = (48, 51, 60)

SCALE = 2  # render @2x for Discord sharpness
W = 540 * SCALE
PAD = 28 * SCALE
AVATAR = 40 * SCALE
LOGO = 40 * SCALE
HEADER = 78 * SCALE
ROW = 52 * SCALE


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    size *= SCALE
    paths = (
        [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        if bold
        else [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def fetch(url: str, size: int) -> Image.Image | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "JellyGlance-StarRoster/1.2"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            img = Image.open(BytesIO(resp.read())).convert("RGBA")
        return img.resize((size, size), Image.Resampling.LANCZOS)
    except Exception:
        return None


def circle(img: Image.Image, size: int) -> Image.Image:
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.putalpha(mask)
    return out


def avatar_for(url: str, login: str) -> Image.Image:
    for candidate in (url, f"https://github.com/{login}.png?size=160"):
        if not candidate:
            continue
        img = fetch(candidate, AVATAR)
        if img is not None:
            return circle(img, AVATAR)
    ph = Image.new("RGBA", (AVATAR, AVATAR), (70, 74, 84, 255))
    return circle(ph, AVATAR)


def logo() -> Image.Image | None:
    here = Path(__file__).resolve()
    for path in (
        here.parents[2] / ".github/assets/icon-b-192.png",
        Path(".github/assets/icon-b-192.png"),
    ):
        if path.exists():
            try:
                return circle(Image.open(path).convert("RGBA"), LOGO)
            except Exception:
                pass
    img = fetch(
        "https://raw.githubusercontent.com/Nerdy-Technician/JellyGlance/main/.github/assets/icon-b-192.png",
        LOGO,
    )
    return circle(img, LOGO) if img else None


def star_glyph(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill) -> None:
    pts = []
    for i in range(10):
        a = math.radians(-90 + i * 36)
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    draw.polygon(pts, fill=fill)


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: build-star-roster.py <users.json> <out.png>", file=sys.stderr)
        return 2

    users = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    if not isinstance(users, list):
        users = []

    f_title = font(20, bold=True)
    f_sub = font(12)
    f_name = font(15, bold=True)
    f_badge = font(11, bold=True)
    f_foot = font(11)

    n = max(1, len(users))
    h = PAD + HEADER + n * ROW + PAD // 2 + 22 * SCALE

    canvas = Image.new("RGBA", (W, h), BG + (255,))
    draw = ImageDraw.Draw(canvas)

    # Card
    draw.rounded_rectangle((0, 0, W - 1, h - 1), radius=20 * SCALE, fill=SURFACE)
    # Subtle left brand rail
    draw.rectangle((0, 0, 5 * SCALE, h), fill=PURPLE)

    # Header: logo + titles
    logo_img = logo()
    lx = PAD
    ly = PAD - 2 * SCALE
    if logo_img:
        canvas.paste(logo_img, (lx, ly + 4 * SCALE), logo_img)
        tx = lx + LOGO + 14 * SCALE
    else:
        tx = lx

    draw.text((tx, ly + 2 * SCALE), "New GitHub stars", font=f_title, fill=TEXT)
    draw.text(
        (tx, ly + 30 * SCALE),
        "Thanks for starring & helping push JellyGlance forward",
        font=f_sub,
        fill=MUTED,
    )

    # Compact count chip
    badge = f"{len(users)}"
    bb = draw.textbbox((0, 0), badge, font=f_badge)
    bw = (bb[2] - bb[0]) + 34 * SCALE
    bh = 24 * SCALE
    bx1 = W - PAD
    bx0 = bx1 - bw
    by0 = ly + 10 * SCALE
    by1 = by0 + bh
    draw.rounded_rectangle((bx0, by0, bx1, by1), radius=bh // 2, fill=PURPLE)
    star_glyph(draw, bx0 + 13 * SCALE, (by0 + by1) / 2, 6 * SCALE, GOLD)
    draw.text((bx0 + 24 * SCALE, by0 + 5 * SCALE), badge, font=f_badge, fill=TEXT)

    # Hairline
    y = PAD + HEADER - 10 * SCALE
    draw.line((PAD, y, W - PAD, y), fill=HAIRLINE, width=SCALE)

    # Rows — flat list, no nested cards
    y += 6 * SCALE
    if not users:
        draw.text((PAD, y + 14 * SCALE), "No stargazer profiles resolved", font=f_name, fill=MUTED)

    for i, user in enumerate(users):
        login = str(user.get("login") or "unknown")
        avatar_url = str(user.get("avatar_url") or "")

        # light hover strip only on alternate? skip — keep flat
        av = avatar_for(avatar_url, login)
        ay = y + (ROW - AVATAR) // 2
        canvas.paste(av, (PAD, ay), av)

        # Name vertically centered with avatar
        nb = draw.textbbox((0, 0), f"@{login}", font=f_name)
        nh = nb[3] - nb[1]
        ny = ay + (AVATAR - nh) // 2 - 2 * SCALE
        draw.text((PAD + AVATAR + 14 * SCALE, ny), f"@{login}", font=f_name, fill=TEXT)

        # soft gold star far right
        star_glyph(draw, W - PAD - 10 * SCALE, y + ROW / 2, 7 * SCALE, GOLD)

        # hairline between rows (not after last)
        if i < len(users) - 1:
            ly_line = y + ROW - SCALE
            draw.line((PAD + AVATAR + 14 * SCALE, ly_line, W - PAD, ly_line), fill=HAIRLINE, width=SCALE)

        y += ROW

    # Footer
    draw.text((PAD, h - PAD // 2 - 8 * SCALE), "jellyglance.com", font=f_foot, fill=MUTED)

    canvas.convert("RGB").save(out, format="PNG", optimize=True)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
