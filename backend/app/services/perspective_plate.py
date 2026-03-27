"""
Perspective plate for cloud AI (OpenAI / Gemini) vs in-browser Improve.

Architecture (phased):
- Improve: geometry + tight crop in the browser (localEnhance) — no generative corners.
- Cloud: apply the same *uncropped* geometry on the server → white triangular voids remain,
  then the model receives an explicit CORNER OUTPAINT block in the prompt so it can
  synthesize walls/floor/ceiling continuation at full frame quality.

Phase 1 (this module): Pillow affine matching TS DOMMatrix order for straighten + auto roll.
Phase 2: optional auto_rotation_rad from the client (same Sobel estimator as frontend).

correct_distortion: no plate here — source is already a full-rect lens-style remap; prompt only.
"""

from __future__ import annotations

import io
import math
import os
import tempfile
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image

MAX_CANVAS_PIXELS = 100_000_000

# Must match frontend/src/lib/localEnhance.ts
_AUTO_SCALE = 0.88
_STRAIGHTEN_SCALE = 0.86
_STRAIGHTEN_ROT_DEG = -1.1
_SHEAR = (1.0, 0.024, -0.03, 1.0)  # a, b, c, d for canvas transform(a,b,c,d,e,f)

QUAD_PERSPECTIVE_MODES = frozenset(
    {"align_verticals_auto", "level_horizon_auto", "straighten"}
)


def clamp_dimensions(w: int, h: int, max_px: int = MAX_CANVAS_PIXELS) -> Tuple[int, int]:
    if w <= 0 or h <= 0:
        return 1, 1
    if w * h <= max_px:
        return w, h
    s = math.sqrt(max_px / (w * h))
    return max(1, int(w * s)), max(1, int(h * s))


def _mul33(a: list, b: list) -> list:
    return [
        [
            a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
            a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
            a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2],
        ],
        [
            a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
            a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
            a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2],
        ],
        [
            a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
            a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
            a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2],
        ],
    ]


def _trans(tx: float, ty: float) -> list:
    return [[1.0, 0.0, tx], [0.0, 1.0, ty], [0.0, 0.0, 1.0]]


def _scale(sx: float, sy: float) -> list:
    return [[sx, 0.0, 0.0], [0.0, sy, 0.0], [0.0, 0.0, 1.0]]


def _rot_deg(deg: float) -> list:
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return [[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]]


def _shear_canvas() -> list:
    a, b, c, d = _SHEAR[0], _SHEAR[1], _SHEAR[2], _SHEAR[3]
    return [[a, c, 0.0], [b, d, 0.0], [0.0, 0.0, 1.0]]


def _inverse_affine_3x3(m: list) -> list:
    a, b, c = m[0][0], m[0][1], m[0][2]
    d, e, f = m[1][0], m[1][1], m[1][2]
    det = a * e - b * d
    if abs(det) < 1e-18:
        raise ValueError("Singular perspective matrix")
    inv_det = 1.0 / det
    ai, bi = e * inv_det, -b * inv_det
    di, ei = -d * inv_det, a * inv_det
    tx = -(ai * c + bi * f)
    ty = -(di * c + ei * f)
    return [[ai, bi, tx], [di, ei, ty], [0.0, 0.0, 1.0]]


def _forward_matrix(
    cw: int, ch: int, perspective: str, auto_rotation_rad: Optional[float]
) -> list:
    """Same post-multiply chain as DOMMatrix in localEnhance.ts."""
    m = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    if perspective in ("align_verticals_auto", "level_horizon_auto"):
        rad = float(auto_rotation_rad or 0.0)
        deg = math.degrees(rad)
        m = _mul33(m, _trans(cw / 2, ch / 2))
        m = _mul33(m, _scale(_AUTO_SCALE, _AUTO_SCALE))
        m = _mul33(m, _rot_deg(deg))
        return m
    if perspective == "straighten":
        m = _mul33(m, _trans(cw / 2, ch / 2))
        m = _mul33(m, _scale(_STRAIGHTEN_SCALE, _STRAIGHTEN_SCALE))
        m = _mul33(m, _rot_deg(_STRAIGHTEN_ROT_DEG))
        m = _mul33(m, _shear_canvas())
        return m
    raise ValueError(f"No quad matrix for perspective={perspective}")


def _pillow_affine_from_matrix(m: list, iw: int, ih: int) -> Tuple[float, float, float, float, float, float]:
    """
    Pillow AFFINE: for each output pixel (x_out, y_out), sample input at
    (x_in, y_in) = (a*x_out + b*y_out + c, d*x_out + e*y_out + f).
    Forward maps local (lx, ly) = (ix - iw/2, iy - ih/2) to output (ox, oy).
    """
    inv = _inverse_affine_3x3(m)
    a0, b0, c0 = inv[0][0], inv[0][1], inv[0][2]
    d0, e0, f0 = inv[1][0], inv[1][1], inv[1][2]
    half_w, half_h = iw / 2.0, ih / 2.0
    pa = a0
    pb = b0
    pc = c0 + half_w
    pd = d0
    pe = e0
    pf = f0 + half_h
    return (pa, pb, pc, pd, pe, pf)


def should_apply_perspective_plate(perspective: Optional[str], auto_rotation_rad: Optional[float]) -> bool:
    if not perspective or perspective not in QUAD_PERSPECTIVE_MODES:
        return False
    if perspective == "straighten":
        return True
    return auto_rotation_rad is not None


def render_perspective_plate_png_bytes(
    image_path: str, perspective: str, auto_rotation_rad: Optional[float] = None
) -> bytes:
    """Uncropped plate: same geometry as Improve, white voids preserved for AI outpainting."""
    with Image.open(image_path) as im:
        if im.mode == "RGBA":
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")

        iw0, ih0 = im.size
        cw, ch = clamp_dimensions(iw0, ih0)
        if (cw, ch) != (iw0, ih0):
            im = im.resize((cw, ch), Image.Resampling.LANCZOS)
        iw, ih = im.size

        m = _forward_matrix(cw, ch, perspective, auto_rotation_rad)
        aff = _pillow_affine_from_matrix(m, iw, ih)
        out = im.transform(
            (cw, ch),
            Image.Transform.AFFINE,
            aff,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(255, 255, 255),
        )
        buf = io.BytesIO()
        out.save(buf, format="PNG", compress_level=3)
        return buf.getvalue()


def write_perspective_plate_tempfile(image_path: str, perspective: str, auto_rotation_rad: Optional[float]) -> str:
    data = render_perspective_plate_png_bytes(image_path, perspective, auto_rotation_rad)
    fd, path = tempfile.mkstemp(suffix=".png", prefix="plate_")
    try:
        Path(path).write_bytes(data)
    finally:
        os.close(fd)
    return path
