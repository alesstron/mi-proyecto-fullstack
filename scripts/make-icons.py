"""Genera los iconos PNG de la PWA a partir de la brújula del logo.

Sin dependencias: rasteriza con supermuestreo (antialiasing) y escribe PNG con zlib.
Uso: python scripts/make-icons.py
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

BG = (255, 247, 240)      # arena
INK = (27, 42, 58)        # tinta océano
ACCENT = (216, 31, 91)    # bugambilia


def inside_poly(x, y, pts):
    """Punto en polígono (ray casting)."""
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def color_at(u, v, scale, rounded):
    """Color en coordenadas normalizadas 0..64 del diseño (igual que icon.svg)."""
    # Contenido escalado alrededor del centro (los maskable necesitan zona segura)
    x = 32 + (u - 32) / scale
    y = 32 + (v - 32) / scale
    if rounded:
        # Esquinas redondeadas rx=14 (solo en el icono "any")
        r = 14
        cx = min(max(u, r), 64 - r)
        cy = min(max(v, r), 64 - r)
        if (u - cx) ** 2 + (v - cy) ** 2 > r * r:
            return None
    d = math.hypot(x - 32, y - 32)
    if inside_poly(x, y, [(32, 15), (38, 32), (32, 49), (26, 32)]) and d > 3.2:
        return ACCENT
    if d <= 3.2:
        return INK
    if abs(d - 21) <= 1.75:
        return INK
    return BG


def render(size, scale=1.0, rounded=True, ss=4):
    rows = []
    for py in range(size):
        row = bytearray([0])  # filtro PNG "None"
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (px + (sx + 0.5) / ss) * 64 / size
                    v = (py + (sy + 0.5) / ss) * 64 / size
                    c = color_at(u, v, scale, rounded)
                    if c is not None:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] / n
            if a:
                row += bytes([round(acc[0] / (acc[3] / 255)), round(acc[1] / (acc[3] / 255)), round(acc[2] / (acc[3] / 255)), round(a)])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"  {path.name} ({size}x{size})")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print("Generando iconos en", OUT)
    write_png(OUT / "favicon-32.png", 32, render(32))
    write_png(OUT / "icon-192.png", 192, render(192))
    write_png(OUT / "icon-512.png", 512, render(512, ss=3))
    # Maskable: fondo completo y contenido dentro del 80 % central (zona segura)
    write_png(OUT / "maskable-512.png", 512, render(512, scale=1.25, rounded=False, ss=3))
    # iOS aplica su propia máscara: sin esquinas ni transparencia
    write_png(OUT / "apple-touch-icon.png", 180, render(180, rounded=False))
