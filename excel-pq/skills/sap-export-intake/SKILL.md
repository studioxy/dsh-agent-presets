---
name: sap-export-intake
description: Safe intake of SAP spreadsheet exports (ALV grid, list exports, XLSX or CSV from SAP GUI) into Excel, Power Query or pandas. Use this skill whenever a file comes from SAP or mentions deliveries, shipments, materials, VBELN, TKNUM, MATNR, handling units, 00.00.0000 dates, ALV exports, or when numbers lose leading zeros, dates come out as text, decimals use a comma, negatives have a trailing minus, or header rows sit under title lines. Profiles the file first, then applies the right type and culture rules in Power Query or Python, and reconciles row counts.
---

# SAP export intake

SAP exports look like tables but are report output: title lines, text-typed numbers, user-locale formats, subtotal rows. Naive loading corrupts keys and silently shifts totals. Profile first, then load with explicit rules.

## Step 1: profile the file (read-only)

```bash
python scripts/profile_sap_export.py <file.xlsx> --key <KeyColumn> [--sheet NAME] [--header-row N]
```

It reports the detected header row and warns about: leading-zero keys, mixed number/text columns, dates stored as text, `00.00.0000` and `31.12.9999`, decimal-comma text, trailing minus, non-breaking spaces, subtotal rows, and duplicate or empty keys. Read the warnings and ask the user only about what the data cannot tell you (for example the SAP user's decimal notation if the sample is ambiguous).

## Step 2: apply these rules

### Keys are text. Always.
Delivery (VBELN), shipment (TKNUM), material (MATNR), customer (KUNNR), purchase order (EBELN), handling unit (EXIDV), and also container, BL and AWB numbers: load as text, keep leading zeros, never convert to number, never let Excel auto-detect them. In M: `type text`. In pandas: `dtype=str`. Decide once per project whether to keep the full zero-padded form; do not mix padded and unpadded forms between systems, normalise both sides of any join the same way.

### Dates
- SAP dates arrive as text in the user's notation, often `dd.MM.yyyy`. Parse with an explicit format and culture, never rely on auto-detection.
- `00.00.0000` means empty: map to null.
- `31.12.9999` is an open-ended sentinel (no end date): map to null or keep as a flagged value; do not treat as a real date or include it in date-range math.
- Times are often a separate column.

### Numbers
- Decimal comma and thousands separator: space, non-breaking space (char 160) or dot depending on the user's SAP settings. Strip separators first, then parse with `pl-PL` (or the actual culture).
- **Trailing minus** (`12,00-`) is a classic SAP negative. Culture-aware parsing alone reads it wrong. Use `fn_SapNumber` from `references/sap-m-snippets.md`.
- Quantity and weight carry a unit in another column (KG, G, TO, PC). Never sum across mixed units; check or convert first.
- Amounts carry a currency. Never sum across mixed currencies.

### Structure
- Locate the header by name, not by a hardcoded row index. Title lines and blank rows above it change between exports.
- Header text depends on the SAP logon language (Polish vs English). Map headers through a small mapping table (`map_sap_columns`) rather than hardcoding header text in every query.
- Remove subtotal and total rows (key column empty, `*`, `Suma`, `Total`, `Razem`) before aggregating.
- `Trim` and `Clean` text columns, replace char 160 with a normal space.
- CSV exports: set the encoding explicitly (UTF-8 or Windows-1250); Polish diacritics break otherwise. Do not pin the column count in `Csv.Document`.

## Step 3: reconcile before you hand over

1. Row count in the source (minus title and total rows) equals row count after the load. If rows were dropped, list how many and why.
2. Keys: zero nulls, duplicates understood (a delivery may legitimately repeat per item; say which grain the table has).
3. Types: key columns are text, dates are date or null, quantities are numbers, no scientific notation in IDs.
4. Date range and totals look plausible against what the user expects. Report them in the summary.
5. No Excel error values and no `Error` cells in the output (in M: `Table.SelectRowsWithErrors` on the typed columns returns zero rows).

## Related skills
`pq-conventions` for how to structure the staging queries, `xlsx-safety` for write rules, `excel-pq-routing` for tool choice. Ready-made M functions: `references/sap-m-snippets.md`.
