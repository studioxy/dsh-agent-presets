#!/usr/bin/env python3
"""Profile an SAP spreadsheet export for the classic traps (read-only).

Usage: python profile_sap_export.py <file.xlsx> [--sheet NAME] [--header-row N] [--key COL ...] [--max-rows 20000]
Prints JSON: detected header row, per-column findings, and a list of warnings. Requires openpyxl.
"""
import argparse
import json
import re
from collections import Counter

import openpyxl

NBSP = "\u00a0"
DATE_TXT = re.compile(r"^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})$")
DEC_COMMA = re.compile(r"^-?\d{1,3}(?:[ \u00a0.]\d{3})*,\d+-?$|^-?\d+,\d+-?$")
TRAIL_MINUS = re.compile(r"^[\d \u00a0.,]+-$")
LEADING_ZERO = re.compile(r"^0\d+$")
TOTAL_WORDS = ("total", "suma", "razem", "summe", "overall result", "ogółem")


def detect_header(rows):
    cand = []
    for i, r in enumerate(rows[:15]):
        vals = [v for v in r if v not in (None, "")]
        cand.append((i, len(vals), bool(vals) and all(isinstance(v, str) for v in vals)))
    best = max((c[1] for c in cand if c[2]), default=0)
    for i, n, all_str in cand:
        if all_str and n >= 0.8 * best and n > 0:
            return i
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--sheet")
    ap.add_argument("--header-row", type=int, help="1-based; overrides detection")
    ap.add_argument("--key", nargs="*", default=[], help="columns that must be unique, non-null text keys")
    ap.add_argument("--max-rows", type=int, default=20000)
    a = ap.parse_args()

    wb = openpyxl.load_workbook(a.file, read_only=True, data_only=True)
    ws = wb[a.sheet] if a.sheet else wb.worksheets[0]
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        rows.append(list(r))
        if i >= a.max_rows + 30:
            break

    h = (a.header_row - 1) if a.header_row else detect_header(rows)
    header = [str(c).strip() if c is not None else "" for c in rows[h]]
    data = rows[h + 1: h + 1 + a.max_rows]
    warnings = []
    if h > 0:
        warnings.append(f"{h} title/blank row(s) above the header; header detected at row {h + 1}. Do not hardcode this index in M; locate the header by name.")

    total_rows = []
    cols = {}
    for ci, name in enumerate(header):
        if not name:
            continue
        vals = [r[ci] if ci < len(r) else None for r in data]
        nn = [v for v in vals if v not in (None, "")]
        types = Counter(type(v).__name__ for v in nn)
        strs = [v for v in nn if isinstance(v, str)]
        info = {
            "non_null": len(nn),
            "null_pct": round(100 * (1 - len(nn) / max(len(vals), 1)), 1),
            "types": dict(types),
        }
        lz = sum(1 for s in strs if LEADING_ZERO.match(s.strip()))
        if lz:
            info["leading_zero_text"] = lz
            if types.get("int") or types.get("float"):
                warnings.append(f"[{name}] mixes numbers with text that has leading zeros -> key column corrupted by number conversion. Force type text.")
            else:
                warnings.append(f"[{name}] {lz} values have leading zeros. Keep as text; never convert to number.")
        td = sum(1 for s in strs if DATE_TXT.match(s.strip()))
        if td:
            info["dates_as_text"] = td
            warnings.append(f"[{name}] {td} dates stored as text. Parse with explicit format and culture.")
        sap_empty = sum(1 for s in strs if s.strip() == "00.00.0000")
        sentinel = sum(1 for s in strs if s.strip() == "31.12.9999")
        if sap_empty:
            info["sap_empty_date_00.00.0000"] = sap_empty
            warnings.append(f"[{name}] contains 00.00.0000 (SAP empty date) -> map to null.")
        if sentinel:
            info["sentinel_31.12.9999"] = sentinel
            warnings.append(f"[{name}] contains 31.12.9999 (open-ended sentinel) -> decide: null or keep, but do not treat as a real date.")
        dc = sum(1 for s in strs if DEC_COMMA.match(s.strip()))
        if dc:
            info["decimal_comma_text"] = dc
            warnings.append(f"[{name}] {dc} numbers stored as text with decimal comma. Convert with culture pl-PL (or the SAP user's notation).")
        tm = sum(1 for s in strs if TRAIL_MINUS.match(s.strip()))
        if tm:
            info["trailing_minus"] = tm
            warnings.append(f"[{name}] {tm} values have a trailing minus (e.g. 12,00-). Culture-aware parsing alone reads these wrong; use fn_SapNumber.")
        nb = sum(1 for s in strs if NBSP in s)
        if nb:
            info["nbsp"] = nb
            warnings.append(f"[{name}] {nb} values contain non-breaking spaces. Replace char 160 before parsing or comparing.")
        sp = sum(1 for s in strs if s != s.strip())
        if sp:
            info["leading_trailing_space"] = sp
        if any(isinstance(v, float) and abs(v) >= 1e11 for v in nn):
            warnings.append(f"[{name}] very large floats: possible scientific notation on an ID column.")
        cols[name] = info

    for ri, r in enumerate(data):
        texts = [str(v).strip().lower() for v in r if isinstance(v, str)]
        if any(t in ("*", "**") or t.startswith(TOTAL_WORDS) for t in texts):
            total_rows.append(h + 2 + ri)
    if total_rows:
        warnings.append(f"possible subtotal/total rows at sheet rows {total_rows[:10]}. Filter them out before aggregating.")

    key_report = {}
    for k in a.key:
        if k not in header:
            warnings.append(f"key column '{k}' not found in header {header}")
            continue
        ci = header.index(k)
        kv = [r[ci] if ci < len(r) else None for r in data]
        nonnull = [str(v).strip() for v in kv if v not in (None, "")]
        dup = [v for v, c in Counter(nonnull).items() if c > 1]
        key_report[k] = {"rows": len(kv), "nulls": len(kv) - len(nonnull), "distinct": len(set(nonnull)), "duplicate_values": len(dup), "examples": dup[:5]}
        if len(kv) - len(nonnull):
            warnings.append(f"key [{k}] has {len(kv) - len(nonnull)} empty values.")
        if dup:
            warnings.append(f"key [{k}] has {len(dup)} duplicated values (e.g. {dup[:3]}).")

    print(json.dumps(
        {"sheet": ws.title, "header_row": h + 1, "columns_found": [c for c in header if c], "data_rows": len(data),
         "warnings": warnings, "columns": cols, "keys": key_report},
        indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
