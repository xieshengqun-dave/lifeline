"""Generate every app icon / splash / logo size from the four new masters.

Masters live in assets/brand/source/ (supplied 2026-09-17). Re-run after
replacing a master:  python3 scripts/make-brand-assets.py

  patient icon      1254x1254 opaque, full bleed
  operator icon     1254x1254 opaque, but with pre-rounded black corners
  patient lockup    transparent RGBA
  operator lockup   transparent RGBA
"""
import os
from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = f"{REPO}/assets/brand/source"
SRC = {
    "patient_icon": f"{MASTERS}/patient-icon.png",
    "operator_icon": f"{MASTERS}/operator-icon.png",
    "patient_lockup": f"{MASTERS}/patient-lockup.png",
    "operator_lockup": f"{MASTERS}/operator-lockup.png",
}
ICON = 1024


def trim(im, pad=8):
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(bbox)
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    out.paste(im, (pad, pad))
    return out


def split_mark(lockup):
    """The symbol is left of the first vertical gap of fully-transparent columns."""
    alpha = lockup.getchannel("A")
    w, h = lockup.size
    col_has = [any(alpha.getpixel((x, y)) > 8 for y in range(0, h, 2)) for x in range(w)]
    started = False
    gap = 0
    for x, has in enumerate(col_has):
        if has:
            if started and gap >= 10:
                return trim(lockup.crop((0, 0, x - gap, h)))
            started = True
            gap = 0
        elif started:
            gap += 1
    raise RuntimeError("no gap between symbol and wordmark")


def fit_width(im, max_w):
    if im.width <= max_w:
        return im
    return im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)


def avg(im, box):
    px = list(im.crop(box).get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.crop(box).getdata())
    return tuple(sum(c[i] for c in px) // len(px) for i in range(3))


def adaptive(icon, scale, feather=0.08):
    """Android adaptive icon: a background gradient matched to the icon's own
    edge colours + the icon scaled into the safe zone with feathered edges,
    so no square seam shows inside the launcher's circle/squircle mask."""
    s = round(ICON * scale)
    off = (ICON - s) // 2
    small = icon.resize((s, s), Image.LANCZOS)

    k = max(4, s // 40)
    tl = avg(small, (k, k, 2 * k, 2 * k))
    tr = avg(small, (s - 2 * k, k, s - k, 2 * k))
    bl = avg(small, (k, s - 2 * k, 2 * k, s - k))
    br = avg(small, (s - 2 * k, s - 2 * k, s - k, s - k))
    bg = Image.new("RGB", (ICON, ICON))
    bgp = bg.load()
    for y in range(ICON):
        v = min(1.0, max(0.0, (y - off) / s))
        for x in range(ICON):
            u = min(1.0, max(0.0, (x - off) / s))
            bgp[x, y] = tuple(
                round(tl[i] * (1 - u) * (1 - v) + tr[i] * u * (1 - v) + bl[i] * (1 - u) * v + br[i] * u * v)
                for i in range(3)
            )

    f = max(1, round(s * feather))
    mask = Image.new("L", (s, s), 0)
    mp = mask.load()
    for y in range(s):
        dy = min(y, s - 1 - y)
        for x in range(s):
            d = min(dy, x, s - 1 - x)
            mp[x, y] = 255 if d >= f else round(255 * d / f)
    fg = Image.new("RGBA", (ICON, ICON), (0, 0, 0, 0))
    fg.paste(small.convert("RGBA"), (off, off), mask)
    mean = avg(bg, (0, 0, ICON, ICON))
    return fg, bg, "#%02x%02x%02x" % mean


def cutout_adaptive(icon, scale, badge_center, badge_radius, pin_min_green=112):
    """Adaptive icon for artwork on a vignette background (operator icon): a
    feathered square leaves a visible frame, so cut out just the symbol (pin
    + badge) and lay it on a gradient rebuilt from the icon's own corners."""
    from PIL import ImageFilter, ImageChops
    w = icon.width
    g = icon.getchannel("G")
    pin = g.point(lambda v: 255 if v > pin_min_green else 0)
    badge = Image.new("L", (w, w), 0)
    bx, by = badge_center
    ImageDraw.Draw(badge).ellipse((bx - badge_radius, by - badge_radius, bx + badge_radius, by + badge_radius), fill=255)
    mask = ImageChops.lighter(pin, badge)
    # Fill enclosed holes (the white plus inside the pin): flood the outside
    # from a corner, then everything not reached is symbol.
    outside = mask.copy()
    ImageDraw.floodfill(outside, (0, 0), 128)
    mask = outside.point(lambda v: 0 if v == 128 else 255)
    # Drop specks the green threshold picked up from the background.
    # Morphological opening removes the ragged slivers where the pin's dark
    # edge meets the badge.
    mask = (
        mask.filter(ImageFilter.MedianFilter(5))
        .filter(ImageFilter.MinFilter(11))
        .filter(ImageFilter.MaxFilter(11))
        .filter(ImageFilter.GaussianBlur(1.2))
    )

    k = w // 30
    tl = avg(icon, (k, k, 2 * k, 2 * k))
    tr = avg(icon, (w - 2 * k, k, w - k, 2 * k))
    bl = avg(icon, (k, w - 2 * k, 2 * k, w - k))
    br = avg(icon, (w - 2 * k, w - 2 * k, w - k, w - k))
    bg = Image.new("RGB", (ICON, ICON))
    bgp = bg.load()
    for y in range(ICON):
        v = y / (ICON - 1)
        for x in range(ICON):
            u = x / (ICON - 1)
            bgp[x, y] = tuple(
                round(tl[i] * (1 - u) * (1 - v) + tr[i] * u * (1 - v) + bl[i] * (1 - u) * v + br[i] * u * v)
                for i in range(3)
            )

    s = round(ICON * scale)
    off = (ICON - s) // 2
    sym = icon.convert("RGBA")
    sym.putalpha(mask)
    sym = sym.resize((s, s), Image.LANCZOS)
    fg = Image.new("RGBA", (ICON, ICON), (0, 0, 0, 0))
    # Soft drop shadow, standing in for the one the cut-out leaves behind.
    shadow_alpha = sym.getchannel("A").point(lambda a: a * 0.35).filter(ImageFilter.GaussianBlur(10))
    shadow = Image.new("RGBA", (s, s), (0, 20, 30, 255))
    shadow.putalpha(shadow_alpha)
    fg.alpha_composite(shadow, (off, off + 10))
    fg.alpha_composite(sym, (off, off))
    mean = avg(bg, (0, 0, ICON, ICON))
    return fg, bg, "#%02x%02x%02x" % mean, mask


def save(im, path, mode):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.convert(mode).save(path, optimize=True)
    print(f"wrote {os.path.relpath(path, REPO):48} {im.size}")


# ── Masters → normalised square icons ──
patient_icon = Image.open(SRC["patient_icon"]).convert("RGB").resize((ICON, ICON), Image.LANCZOS)

op_raw = Image.open(SRC["operator_icon"]).convert("RGB")
d = 76  # corner radius ~227px → crop 0.3r + margin removes the baked-in black corners
op_cropped = op_raw.crop((d, d, op_raw.width - d, op_raw.height - d))
for corner in [(0, 0), (op_cropped.width - 1, 0), (0, op_cropped.height - 1), (op_cropped.width - 1, op_cropped.height - 1)]:
    assert sum(op_cropped.getpixel(corner)) > 60, f"black corner left at {corner}: {op_cropped.getpixel(corner)}"
operator_icon = op_cropped.resize((ICON, ICON), Image.LANCZOS)

patient_lockup = trim(Image.open(SRC["patient_lockup"]).convert("RGBA"))
operator_lockup = trim(Image.open(SRC["operator_lockup"]).convert("RGBA"))
patient_mark = split_mark(patient_lockup)
operator_mark = split_mark(operator_lockup)

colors = {}
for app, root, icon, lockup, mark, scale in [
    ("patient", REPO, patient_icon, patient_lockup, patient_mark, 0.85),
    ("operator", f"{REPO}/operator-app", operator_icon, operator_lockup, operator_mark, 0.62),
]:
    save(icon, f"{root}/assets/icon.png", "RGB")
    if app == "operator":
        # Badge ring measured on the 1024 icon: centre (775.5, 740.5), outer radius ~177.
        fg, bg, mean, _mask = cutout_adaptive(icon, scale, (775.5, 740.5), 192)
    else:
        fg, bg, mean = adaptive(icon, scale)
    save(fg, f"{root}/assets/adaptive-icon.png", "RGBA")
    save(bg, f"{root}/assets/adaptive-icon-background.png", "RGB")
    colors[app] = mean
    save(icon.resize((48, 48), Image.LANCZOS), f"{root}/assets/favicon.png", "RGB")
    save(fit_width(lockup, 1200), f"{root}/assets/splash.png", "RGBA")
    save(fit_width(lockup, 1200), f"{root}/assets/brand/lifeline-lockup.png", "RGBA")
    save(fit_width(mark, 512), f"{root}/assets/brand/lifeline-mark.png", "RGBA")

# iPhone web app (PWA) + admin dashboard use the patient brand.
for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    save(patient_icon.resize((size, size), Image.LANCZOS), f"{REPO}/public/{name}", "RGB")
save(fit_width(patient_lockup, 1200), f"{REPO}/admin/src/assets/brand/lifeline-lockup.png", "RGBA")
save(fit_width(patient_mark, 512), f"{REPO}/admin/src/assets/brand/lifeline-mark.png", "RGBA")

print("adaptive background colours:", colors)
