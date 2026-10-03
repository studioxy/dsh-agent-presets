#!/usr/bin/env python3
"""Create a timestamped backup and a work copy next to the source file. Never touches the source.

Usage: python make_work_copy.py <file> [--workdir _work] [--backupdir _backup] [--force]
Prints JSON with paths and sha256 of the source.
"""
import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--workdir", default="_work")
    ap.add_argument("--backupdir", default="_backup")
    ap.add_argument("--force", action="store_true", help="overwrite an existing work copy")
    a = ap.parse_args()

    src = Path(a.source).resolve()
    if not src.is_file():
        sys.exit(f"source not found: {src}")
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = src.parent / a.backupdir / f"{src.stem}.{ts}{src.suffix}"
    work = src.parent / a.workdir / f"{src.stem}.work{src.suffix}"
    if work.exists() and not a.force:
        sys.exit(f"work copy already exists (previous session?): {work}. Reuse it, or pass --force.")

    backup.parent.mkdir(parents=True, exist_ok=True)
    work.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, backup)
    shutil.copy2(src, work)
    print(json.dumps({"source": str(src), "backup": str(backup), "work": str(work), "sha256": sha256(src)}, indent=2))


if __name__ == "__main__":
    main()
