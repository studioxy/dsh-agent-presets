---
name: xlsx-safety
description: Mandatory safety protocol for every write to an Excel workbook or Power Query. Use this skill whenever you are about to modify, refresh, save, rename, delete or overwrite anything in an .xlsx, .xlsm or .xlsb file, a query, a sheet, a named range or a pivot, and whenever the user says edit, update, fix, clean, refresh, overwrite or save over a spreadsheet. Enforces work copies and backups, plan before bulk writes, dry runs and diffs, no macro execution, explicit session saves, and re-reading the result as proof before claiming success.
---

# Excel write safety

Spreadsheets hold years of silent logic and have no undo for most automated edits. Treat every write as irreversible until a backup proves otherwise. These rules are short on purpose; follow all of them.

## Before the first write

1. **Never edit the original.** Run:
   ```bash
   python scripts/make_work_copy.py <file>
   ```
   It creates `_backup/<name>.<timestamp>.<ext>` and `_work/<name>.work.<ext>` and prints the sha256 of the source. Work only on the `_work` copy. If a work copy already exists from an earlier session, reuse it (do not `--force` it unless the user agrees).
2. **Route first.** Run `excel-pq-routing` so you know whether headless writing is allowed at all.
3. **Read, then plan.** State in two or three lines what you will change: sheet, range or query names, and the expected result (row counts, totals, columns). For more than about 20 cells or any query change, wait for the user's confirmation of the plan unless they already gave an explicit instruction that covers it.
4. **Scope.** Touch only what the plan names. Do not rename, delete or reorder sheets, queries, named ranges or tables outside the plan. Do not replace a formula with its value.

## During the write

- **Dry run when offered.** With `pq`, call write tools with `dry_run=true` first, read the unified diff, then repeat for real. `pq` snapshots before every write; know where (`%LOCALAPPDATA%\letin\snapshots`, last 50 per source) and use `restore_snapshot` to undo.
- **Macros never run.** Do not execute or enable VBA, do not open workbooks with macros enabled. When reading `.xlsm` headless, preserve VBA with `keep_vba=True` or avoid openpyxl entirely.
- **Live sessions (`excel-live`).** List existing sessions and reuse the matching one instead of opening a second instance. When finished, check that the workbook can be closed, then close with an explicit `save: true` or `save: false`. Closing without saving discards all unsaved edits and has no undo, so never close a session you did not open without asking.
- **Calculation mode.** If you switch to manual calculation, recalculate explicitly before relying on dependent values, and restore the original mode.
- **Credential or privacy prompts** during refresh: stop. Do not retry in a loop and do not disable privacy levels on your own. Report the prompt to the user. (`ignore_privacy_levels` exists for throwaway evaluations; use it only if the user asks.)
- **Long operations.** Power Query refresh can take 30 seconds or more. Use a deliberate timeout; a timeout is not proof of failure, check the state before retrying.

## After the write: verification is evidence, not a feeling

Do not say done until you have re-read the result from the file or the engine and compared it with the plan.

| Changed | Evidence required |
|---|---|
| Cell values or formulas | Re-read the changed range; run recalc (`recalc.py` headless, or Excel recalculation live); report formula error count (must be 0) |
| A query | `evaluate_steps` or a refresh result: column names, types, **row count before vs after**; first error step if any |
| Formatting or structure | Re-read sheet list, names and the touched ranges |
| Anything | Compare against the backup: sheets, queries, named ranges and table names that existed before still exist, unless the plan removed them |

Remember: a clean recalc proves formulas evaluate, not that they are correct. Spot-check two or three results by hand against the source data.

## Delivering

- Default deliverable is the work copy under a new name, for example `<name>_v2.<ext>`. Overwrite the original only when the user explicitly says to, and only after the backup exists.
- Finish with a short change log: what changed (sheets, ranges, queries), evidence (counts, error totals), and where the backup is. One line per change.

## When something goes wrong

Stop writing. Do not "fix forward" on a damaged work copy. Restore from the `pq` snapshot or from `_backup`, tell the user what happened, and follow `systematic-debugging` before trying again: find the root cause, then change one thing at a time.
