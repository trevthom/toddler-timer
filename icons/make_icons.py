"""
Generates the PWA app icons for Toddler Timer.

Run from the project root:  python3 icons/make_icons.py

Produces:
  icons/icon-192.png   (any)
  icons/icon-512.png   (any + maskable; art kept inside the centre 80% safe zone)

Tweak COLORS below to restyle the icon, then re-run.
"""
from PIL import Image, ImageDraw

MASTER = 512  # master size; the 192 icon is downscaled from this

COLORS = {
    "bg_top":    (255, 201, 60),   # sunny yellow
    "bg_bottom": (255, 122, 89),   # coral
    "sand":      (255, 255, 255),  # the "sand" inside the glass
    "glass":     (255, 255, 255),  # hourglass frame
    "glass_fill":(255, 255, 255, 70),
}


def vertical_gradient(size, top, bottom):
    base = Image.new("RGB", (size, size), top)
    top_r, top_g, top_b = top
    bot_r, bot_g, bot_b = bottom
    px = base.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top_r + (bot_r - top_r) * t)
        g = int(top_g + (bot_g - top_g) * t)
        b = int(top_b + (bot_b - top_b) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return base


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_hourglass(img):
    """Draw a simple, chunky hourglass roughly within the centre safe zone."""
    d = ImageDraw.Draw(img, "RGBA")
    cx = MASTER / 2
    # Safe zone for maskable icons is the centre ~80%. Keep art inside ~60%.
    half_w = MASTER * 0.20      # half width of the glass at top/bottom
    top_y = MASTER * 0.24
    bot_y = MASTER * 0.76
    mid_y = MASTER / 2
    neck = MASTER * 0.018       # half width of the pinch in the middle
    lw = max(6, int(MASTER * 0.022))
    g = COLORS["glass"]

    # Top and bottom caps (rounded bars)
    cap_h = MASTER * 0.045
    d.rounded_rectangle(
        [cx - half_w - lw, top_y - cap_h, cx + half_w + lw, top_y + cap_h],
        radius=cap_h, fill=g)
    d.rounded_rectangle(
        [cx - half_w - lw, bot_y - cap_h, cx + half_w + lw, bot_y + cap_h],
        radius=cap_h, fill=g)

    # Glass outline (two triangles meeting at the neck), drawn as thick lines
    top_left = (cx - half_w, top_y)
    top_right = (cx + half_w, top_y)
    bot_left = (cx - half_w, bot_y)
    bot_right = (cx + half_w, bot_y)
    neck_t = (cx - neck, mid_y)
    neck_b = (cx + neck, mid_y)
    d.line([top_left, neck_t, bot_left], fill=g, width=lw, joint="curve")
    d.line([top_right, neck_b, bot_right], fill=g, width=lw, joint="curve")

    # Sand: a filled triangle in the TOP bulb (lots of time left)
    sand = COLORS["sand"]
    inset = lw * 1.2
    d.polygon([
        (cx - half_w + inset, top_y + inset),
        (cx + half_w - inset, top_y + inset),
        (cx, mid_y - 2),
    ], fill=sand)
    # A little pile of sand already fallen in the bottom bulb
    pile_h = (bot_y - mid_y) * 0.35
    pile_w = half_w * 0.62
    d.polygon([
        (cx - pile_w, bot_y - inset),
        (cx + pile_w, bot_y - inset),
        (cx, bot_y - inset - pile_h),
    ], fill=sand)


def build():
    img = vertical_gradient(MASTER, COLORS["bg_top"], COLORS["bg_bottom"]).convert("RGBA")
    draw_hourglass(img)

    # 512: maskable wants full-bleed background, so do NOT round the 512 art itself;
    # the platform applies its own mask. We keep the gradient full-bleed.
    img.save("icons/icon-512.png")

    # 192: round the corners a little for the "any" purpose so it looks tidy
    small = img.resize((192, 192), Image.LANCZOS)
    mask = rounded_mask(192, radius=int(192 * 0.22))
    rounded = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
    rounded.paste(small, (0, 0), mask)
    rounded.save("icons/icon-192.png")

    print("Wrote icons/icon-512.png and icons/icon-192.png")


if __name__ == "__main__":
    build()
