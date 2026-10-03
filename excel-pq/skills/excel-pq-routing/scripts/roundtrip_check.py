#!/usr/bin/env python3
"""Show which package parts are lost when a workbook is loaded and re-saved with openpyxl.

Usage: python roundtrip_check.py <file.xlsx|xlsm>
Never modifies the source. Requires openpyxl.
"""
import json
import sys
import tempfile
import zipfile
from pathlib import Path

import openpyxl

SIGNIFICANT = (
    "customXml/", "xl/connections", "xl/pivot", "xl/model/", "xl/vbaProject",
    "xl/charts/", "xl/drawings/", "xl/media/", "xl/slicer", "xl/externalLinks/",
)


def parts(p):
    with zipfile.ZipFile(p) as z:
        return set(z.namelist())


def main(src):
    src = Path(src)
    wb = openpyxl.load_workbook(src, keep_vba=src.suffix.lower() == ".xlsm")
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / ("roundtrip" + src.suffix)
        wb.save(out)
        before, after = parts(src), parts(out)
    lost = sorted(before - after)
    significant = [n for n in lost if n.startswith(SIGNIFICANT)]
    print(json.dumps(
        {
            "file": str(src),
            "lost_parts": lost,
            "significant_losses": significant,
            "verdict": "UNSAFE: do not write with openpyxl" if significant else "no significant package parts lost",
        },
        indent=2,
    ))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
