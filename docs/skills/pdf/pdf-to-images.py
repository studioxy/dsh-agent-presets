#!/usr/bin/env python
"""Render PDF pages to PNG images.

Replaces convert_pdf_to_images.py, which depends on pdf2image and therefore on the poppler native
binaries. Neither is available on this machine and poppler cannot be installed with pip. pypdfium2
ships its own PDF engine, so this needs nothing beyond the virtualenv.

Usage:
    python pdf-to-images.py <input.pdf> <output-dir> [--scale 2] [--pages 1,3]
"""
import argparse
import pathlib
import sys

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("pypdfium2 is missing. Run this with the venv interpreter, see LOCAL-SETUP.md.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Render PDF pages to PNG.")
    ap.add_argument("input", help="path to the source PDF")
    ap.add_argument("outdir", help="directory to write page images into")
    ap.add_argument("--scale", type=float, default=2.0, help="render scale, default 2 (about 144 dpi)")
    ap.add_argument("--pages", default="", help="comma-separated 1-based page numbers, default all")
    args = ap.parse_args()

    src = pathlib.Path(args.input)
    if not src.is_file():
        sys.exit(f"no such file: {src}")

    out = pathlib.Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    doc = pdfium.PdfDocument(str(src))
    total = len(doc)

    wanted = None
    if args.pages.strip():
        try:
            wanted = [int(p) for p in args.pages.split(",") if p.strip()]
        except ValueError:
            sys.exit("--pages expects comma-separated numbers, for example 1,3")
        bad = [p for p in wanted if p < 1 or p > total]
        if bad:
            sys.exit(f"page out of range 1..{total}: {bad}")

    indices = [p - 1 for p in wanted] if wanted else range(total)
    written = []
    for i in indices:
        image = doc[i].render(scale=args.scale).to_pil()
        path = out / f"page-{i + 1}.png"
        image.save(path)
        written.append(path)
        print(f"page {i + 1}/{total}  {image.size[0]}x{image.size[1]} px  -> {path.name}")

    print(f"wrote {len(written)} of {total} page(s) to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
