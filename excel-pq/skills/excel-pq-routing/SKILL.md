---
name: excel-pq-routing
description: Decide which tool path to use BEFORE touching any Excel workbook. Use this skill first whenever a task involves an .xlsx, .xlsm, .xlsb or .xltx file, Power Query or M code, queries, refresh, pivots, the data model, VBA, or a SAP export opened in Excel, even if the user only says fix this spreadsheet or update the report. It inspects the file for features that file libraries destroy on save (Power Query, connections, data model, slicers, VBA) and routes the work to the live Excel engine, the Power Query server, or headless file tools, so nothing is silently lost.
---

# Excel / Power Query routing

Excel work splits into two worlds that must never be mixed up:

- **Headless (file level)**: openpyxl, pandas, `excel-files` MCP. Works anywhere, no Excel needed. It rewrites the whole package, so anything the library does not understand is deleted on save. It cannot refresh Power Query, cannot recalculate by itself, cannot create real PivotTables.
- **Live (COM)**: `excel-live` MCP drives the real Excel application (Windows + Excel 2016+). It can refresh queries, recalculate, run DAX/VBA, and leaves everything it does not touch intact.

`pq` (letin) is a specialist for M code. It reads queries straight from a closed file without starting Excel, and edits them through Excel when asked to write.

## Step 1: inspect the file (always, before any write)

```bash
python scripts/inspect_workbook.py <file>
python scripts/roundtrip_check.py <file>     # only when you consider writing headless
```

`inspect_workbook.py` reports sheets, Power Query, connections, data model, pivots, slicers, VBA, external links, charts, images.
It splits findings into:

- **fragile** (power_query, connections, data_model, slicers, vba): openpyxl drops these on save. This was confirmed by a round-trip test. Headless write is forbidden.
- **caution** (pivot_tables, external_links, charts, drawings_or_images): openpyxl keeps them but re-serialises them. Pivots cannot be edited or refreshed headless. Fidelity is not guaranteed.

`roundtrip_check.py` proves it on the actual file: it re-saves a temp copy and lists the package parts that vanished. Trust it over any assumption.

## Step 2: route

| Workbook contains | Task | Use |
|---|---|---|
| nothing fragile or cautious | read / analyse | `excel-files` (read-only) or pandas |
| nothing fragile or cautious | edit / create | the `xlsx` skill (openpyxl + `recalc.py`) |
| caution features only | edit values or formatting | `excel-live` preferred; headless only after `roundtrip_check.py` is clean |
| Power Query / connections | list, lint, explain, refactor M, diff, export to git | `pq` |
| Power Query / connections | refresh, load, verify output | `excel-live` |
| pivots, data model, slicers, VBA | any write | `excel-live` only |
| `.xlsb` / `.xls` | anything | `excel-live` only |
| no Windows or no Excel available | read Power Query | `pq` on the closed file (reads the DataMashup part, no Excel needed) |
| no Windows or no Excel available | write to a fragile workbook | stop and tell the user why; offer read-only analysis |

If the workbook is new and you create it from scratch, the headless path is fine, and the `xlsx` skill rules apply (formulas not hardcoded values, recalc with zero errors, no XLOOKUP/FILTER/UNIQUE in files that LibreOffice must verify).

## Step 3: rules that apply on every route

1. Apply `xlsx-safety` before the first write (work copy, plan, verification).
2. **One writer at a time.** Never let `pq` and `excel-live` edit the same workbook concurrently. Finish, save or close the first, then use the second. State which server currently owns the file.
3. Read before write. Use the cheapest tool that answers the question: `inspect_workbook.py`, then `pq` `list_queries` and `dependency_graph`, then reading ranges. Do not dump whole sheets into context; page or aggregate.
4. SAP exports go through `sap-export-intake` first. Power Query authoring goes through `pq-conventions`.
5. A write path you could not verify is a failed task. Verification is part of the route (see `xlsx-safety`).

## Tool budget

`excel-live` exposes about 31 tools with 326 operations. If your harness supports it, give orchestrator-tier models the MCP server and give cheaper worker models only `excel-files` (read-only) plus the `excelcli` command line, which is far cheaper in tokens. Do not load both `excel-live` and a second full Excel MCP server; their tool lists overlap and compete for the same context.
