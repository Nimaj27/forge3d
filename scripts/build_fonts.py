#!/usr/bin/env python3
"""Génère les polices TTF statiques de Forge3D dans public/fonts.

Usage (rarement nécessaire, les TTF sont déjà versionnées) :
    pip install fonttools
    python3 -I scripts/build_fonts.py

Sources : dépôt github.com/google/fonts (licences OFL / Apache 2.0).
Les polices variables sont figées au bon poids, puis réduites au latin
(ASCII, Latin-1, Latin étendu A, ponctuation typographique).
"""
import io
import pathlib
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
BASE = "https://raw.githubusercontent.com/google/fonts/main/"

FONTS = [
    # (fichier de sortie, chemin source, axes à figer)
    ("Cinzel-Black.ttf", "ofl/cinzel/Cinzel%5Bwght%5D.ttf", {"wght": 900}),
    ("Inter-Bold.ttf", "ofl/inter/Inter%5Bopsz,wght%5D.ttf", {"wght": 700, "opsz": 14}),
    ("BebasNeue-Regular.ttf", "ofl/bebasneue/BebasNeue-Regular.ttf", None),
    ("RobotoSlab-Bold.ttf", "apache/robotoslab/RobotoSlab%5Bwght%5D.ttf", {"wght": 700}),
]

LICENSES = [
    ("Cinzel-OFL.txt", "ofl/cinzel/OFL.txt"),
    ("Inter-OFL.txt", "ofl/inter/OFL.txt"),
    ("BebasNeue-OFL.txt", "ofl/bebasneue/OFL.txt"),
    ("RobotoSlab-LICENSE.txt", "apache/robotoslab/LICENSE.txt"),
]

UNICODES = "U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2212"


def fetch(path: str) -> bytes:
    with urllib.request.urlopen(BASE + path, timeout=60) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lic_dir = OUT / "licenses"
    lic_dir.mkdir(exist_ok=True)
    for name, src, axes in FONTS:
        font = TTFont(io.BytesIO(fetch(src)))
        if axes:
            font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
        opts = subset.Options()
        opts.hinting = False
        opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        sub = subset.Subsetter(options=opts)
        sub.populate(unicodes=subset.parse_unicodes(UNICODES))
        sub.subset(font)
        font.save(OUT / name)
        print(f"{name}: {(OUT / name).stat().st_size} octets")
    for name, src in LICENSES:
        (lic_dir / name).write_bytes(fetch(src))


if __name__ == "__main__":
    main()
