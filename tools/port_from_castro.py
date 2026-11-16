"""Copy files from the CASTRO site (../castro) into NG CASTRO, swapping CASTRO-only
domains/links for NG ones.  Usage:  py tools/port_from_castro.py file1 file2 ...

Text files (.html .css .js) get the replacements below; anything else is copied as is.
"""
import shutil
import sys
from pathlib import Path

NG = Path(__file__).resolve().parents[1]
CASTRO = NG.parent / "castro"

# Order matters: the more specific URLs first.
REPLACEMENTS = [
    ("https://auth.family-castro.fun", "https://auth.family-castro.com"),
    ("https://family-castro.fun/api/join", "https://join.family-castro.com"),
    ("https://api.family-castro.fun", "https://api.family-castro.com"),
    ("https://family-castro.fun", "https://family-castro.com"),
    ("www.family-castro.fun", "www.family-castro.com"),
    ("https://ukraine-gta5.com.ua/", "https://ng-gta5.com/"),
    ("https://ukraine-gta5.com.ua", "https://ng-gta5.com"),
    ("https://discord.gg/Jj2DeAm265", "https://discord.gg/Jtrh5RaTX3"),
    ("/assets/logogta5.png", "/assets/NG.png"),
    ("assets/logogta5.png", "assets/NG.png"),
    ("Ukraine GTA 5 RP", "NG GTA 5"),
    ("Ukraine GTA 5", "NG GTA 5"),
    ("Ukraine GTA5", "NG GTA 5"),
]

TEXT = {".html", ".css", ".js", ".mjs", ".json", ".xml", ".txt"}


def port(rel: str) -> None:
    src, dst = CASTRO / rel, NG / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() not in TEXT:
        shutil.copyfile(src, dst)
        print("copied ", rel)
        return
    text = src.read_text(encoding="utf-8")
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    dst.write_text(text, encoding="utf-8", newline="")
    print("ported ", rel)


if __name__ == "__main__":
    for rel in sys.argv[1:]:
        port(rel.replace("\\", "/"))
