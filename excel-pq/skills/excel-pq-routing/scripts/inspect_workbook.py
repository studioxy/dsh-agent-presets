#!/usr/bin/env python3
"""Inspect an Excel workbook for features that file libraries (openpyxl/pandas) cannot round-trip.

Usage: python inspect_workbook.py <file.xlsx|xlsm|xlsb|xltx>
Prints JSON. No third-party dependencies (zipfile only).
"""
import json
import re
import sys
import zipfile
from pathlib import Path


def has_datamashup(z, name):
    """Power Query lives in a customXml part whose root is DataMashup (often UTF-16)."""
    try:
        head = z.read(name)[:4096]
    except KeyError:
        return False
    return b"DataMashup" in head or "DataMashup".encode("utf-16-le") in head


def inspect(path):
    p = Path(path)
    ext = p.suffix.lower()
    out = {"file": str(p), "ext": ext}

    if ext in (".xlsb", ".xls"):
        out.update(
            safe_for_headless_write=False,
            route="excel-live",
            reason=f"{ext} is a binary format; openpyxl cannot read it. Use the live Excel engine.",
            features={},
        )
        return out
    if not zipfile.is_zipfile(p):
        out.update(error="not a valid OOXML zip container (corrupt, password-protected or not Excel)")
        return out

    with zipfile.ZipFile(p) as z:
        names = z.namelist()

        def count(prefix, suffix=""):
            return sum(1 for n in names if n.startswith(prefix) and n.endswith(suffix))

        custom_items = [n for n in names if re.fullmatch(r"customXml/item\d+\.xml", n)]
        wbxml = z.read("xl/workbook.xml").decode("utf-8", "ignore") if "xl/workbook.xml" in names else ""
        features = {
            "sheets": len(re.findall(r"<sheet\s", wbxml)),
            "power_query": any(has_datamashup(z, n) for n in custom_items),
            "connections": "xl/connections.xml" in names,
            "pivot_tables": count("xl/pivotTables/", ".xml"),
            "data_model": "xl/model/item.data" in names,
            "vba": "xl/vbaProject.bin" in names,
            "slicers": count("xl/slicers/") + count("xl/slicerCaches/"),
            "external_links": count("xl/externalLinks/", ".xml"),
            "charts": count("xl/charts/", ".xml"),
            "drawings_or_images": count("xl/drawings/", ".xml") + count("xl/media/"),
            "tables": count("xl/tables/", ".xml"),
            "defined_names": len(re.findall(r"<definedName\s", wbxml)),
        }

    # Verified by round-trip test: openpyxl drops these parts on save.
    fragile = [k for k in ("power_query", "connections", "data_model", "slicers", "vba") if features[k]]
    # Re-serialised by openpyxl (kept, but fidelity is not guaranteed / cannot be edited or refreshed).
    caution = [k for k in ("pivot_tables", "external_links", "charts", "drawings_or_images") if features[k]]
    out["features"] = features
    out["fragile_features"] = fragile
    out["caution_features"] = caution
    out["safe_for_headless_write"] = not fragile
    if fragile:
        out["route"] = "excel-live for writes; letin / excel-files for read-only analysis"
        out["reason"] = (
            "openpyxl/pandas drop these parts on save: " + ", ".join(fragile)
            + ". Do not write with them. Run roundtrip_check.py to confirm for this file."
        )
    elif caution:
        out["route"] = "headless write allowed with care; excel-live preferred"
        out["reason"] = (
            "openpyxl keeps but re-serialises: " + ", ".join(caution)
            + ". Pivots cannot be refreshed or edited headless. Run roundtrip_check.py, then compare the result visually or via the live engine."
        )
    else:
        out["route"] = "headless-ok"
    return out


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(json.dumps(inspect(sys.argv[1]), indent=2, ensure_ascii=False))
