#!/usr/bin/env python3
"""Assemble favicon.ico from the rendered PNG favicons.

An .ico is a 6-byte directory header, one 16-byte entry per image, and then
the image payloads laid end to end. Since Vista a payload may be a PNG file
verbatim rather than a headerless BMP, which is what this writes: it means the
icon is assembled from the exact bytes of the PNGs that ship beside it rather
than re-encoded, so the .ico cannot drift from the favicons a browser reaches
for when it can use them. Nothing here is a drawing step and no artwork is
re-traced -- if the mark changes, re-render the PNGs and run this again.

An encoder was the one gap the shark handoff could not fill, and this is why
it did not need to become one: the container is 22 bytes of arithmetic per
image, and stdlib zlib is not even required because the payload is not
touched.

    py scripts/build_favicon_ico.py

Writes favicon.ico at the repo root and copies it to web/public/, which is the
one that is actually served -- Cloudflare Pages builds from web/ and the repo
root is not in the output. The root copy is what 404.html and docs/*.html name
through the same absolute /favicon.ico path once they are served from dist.
"""

import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ["favicon-16.png", "favicon-32.png", "favicon-48.png"]
SRC_DIR = ROOT / "web" / "public"
TARGETS = [ROOT / "favicon.ico", SRC_DIR / "favicon.ico"]

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_size(data):
    """Width and height out of the IHDR, which is always the first chunk.

    Read rather than inferred from the filename: a mislabelled source is
    exactly the kind of thing that produces an icon that looks right in a
    directory listing and wrong in a tab.
    """
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("not a PNG (signature mismatch)")
    if data[12:16] != b"IHDR":
        raise ValueError("first chunk is not IHDR")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def build(images):
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    offset = len(header) + 16 * count

    directory = b""
    for width, height, data in images:
        # 0 means 256 in this field, so anything larger has nowhere to go.
        if width > 256 or height > 256:
            raise ValueError(f"{width}x{height} does not fit an .ico entry")
        directory += struct.pack(
            "<BBBBHHII",
            width % 256,
            height % 256,
            0,      # palette size; 0 for a truecolour image
            0,      # reserved
            1,      # colour planes
            32,     # bits per pixel
            len(data),
            offset,
        )
        offset += len(data)

    return header + directory + b"".join(data for _, _, data in images)


def main():
    images = []
    for name in SOURCES:
        path = SRC_DIR / name
        if not path.exists():
            print(f"build_favicon_ico: MISSING {path}", file=sys.stderr)
            return 1
        data = path.read_bytes()
        width, height = png_size(data)
        images.append((width, height, data))
        print(f"  + {name}  {width}x{height}  {len(data)} bytes")

    blob = build(images)
    for target in TARGETS:
        target.write_bytes(blob)
        print(f"build_favicon_ico: wrote {target.relative_to(ROOT)} ({len(blob)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
