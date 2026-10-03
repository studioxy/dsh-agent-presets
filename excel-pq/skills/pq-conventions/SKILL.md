---
name: pq-conventions
description: House style and authoring loop for Power Query M code in Excel and Power BI. Use this skill whenever you write, edit, review, lint, refactor, rename, optimise or debug Power Query queries or M code, create staging queries or parameters, fix a slow or broken refresh, or when the user mentions Power Query, M, queries, steps, query folding, unpivot, merge, append or Get and Transform. Covers naming, query layering, parameters instead of hardcoded paths, typing, column selection, error handling, the validate-evaluate-lint-dry-run-refresh loop, and how to commit queries to git.
---

# Power Query conventions and authoring loop

## Authoring loop (never skip steps)

Tools named below come from the `pq` server (letin) unless marked `live` (the `excel-live` server). Apply `xlsx-safety` before the first write.

1. **Understand first.** `list_queries`, `dependency_graph` (refresh order, orphans, cycles), `list_data_sources`. Use `find_in_queries` before renaming or repointing anything.
2. **Draft the M** in a file or string, not straight into the workbook.
3. **Validate.** `validate_m` for syntax, unknown functions and wrong argument counts. `m_function_help` for any function whose signature you are not certain about. Do not guess signatures.
4. **Evaluate.** `evaluate_steps` runs every step in one engine call and shows the first step where an error appears. Check column names, types, sample rows and row count of the output. For one expression use `evaluate_m`.
5. **Lint.** `lint_queries`; fix findings in the order: errors, folding breakers, hardcoded paths, untyped columns, repeated Changed Type, dead steps.
6. **Apply with a dry run.** `set_query` with `dry_run=true`, read the diff, then apply for real. Rename with `rename_query` / `rename_step` (reference-safe), never by search and replace.
7. **Refresh and verify.** Refresh in the live engine (`refresh_query` on an open workbook, or the `live` powerquery refresh with a generous timeout). Compare row counts and key columns with what you expected. A refresh without an error is not proof.
8. **Format and version.** `format_queries`, then `export_queries` to `./queries` (one `.pq` file per query) and commit. Use `diff_queries` to show the user what changed.

Evaluation and refresh can take several seconds up to minutes. Use a deliberate timeout and check state before retrying.

## Layering

```
parameters  ->  stg_*  ->  dim_* / fct_*  ->  rpt_*
```

- `p_*` parameters: paths, servers, folder names, date cut-offs, environment switches. **No hardcoded paths, servers or URLs inside queries.**
- `stg_*` staging: one query per source. Connect, locate the header, select columns, type them. No business logic. Load as **connection only**.
- `dim_*` / `fct_*` transform: joins, derived columns, aggregations. Connection only unless it is a final table.
- `rpt_*` output: what lands on a sheet or in the data model. Keep these thin.
- `fn_*` functions: logic used by two or more queries (parsing, cleaning). Copy-pasted steps across queries are a defect; extract a function.

## Naming

Queries: lowercase prefix, then PascalCase or snake_case, consistently within a workbook (`stg_SapDeliveries`). Steps: short, descriptive, no spaces unless unavoidable (`Typed`, `FilteredShipped`, `Merged`), not the auto-generated `#"Changed Type1"` chain. One comment line above any step whose reason is not obvious.

## Rules

1. **Select columns with a whitelist** (`Table.SelectColumns`), not a blacklist. A blacklist (`Table.RemoveColumns`) breaks when the source adds a column; a whitelist fails loudly when one disappears, which is what you want. Use `MissingField.UseNull` only for genuinely optional columns.
2. **Type once, explicitly, at the end of staging**, with a culture where text is parsed: `Table.TransformColumnTypes(Prev, {...}, "pl-PL")`. No repeated Changed Type steps. Always type the result of `Table.AddColumn` (the fourth argument).
3. **Filter early**, before merges and expensive steps. With database sources, keep foldable steps (filter, select, rename, sort, group, simple joins) first; custom columns with M functions, text operations and pivot/unpivot tend to break folding. Check with View Native Query. Folding is irrelevant for Excel, CSV and folder sources, which never fold.
4. **Do not pin the column count** in `Csv.Document`; do not rely on column positions or auto-generated names (`Column1`).
5. **Keys are text** where they are identifiers. See `sap-export-intake` for SAP specifics.
6. **No silent error swallowing.** `try ... otherwise null` only with a reason, and then count the nulls it produced. Use `Table.SelectRowsWithErrors` in a diagnostic query to surface conversion errors.
7. **Fail loudly on empty or wrong input**: assert row count or required columns and `error "message"` with the query name in it.
8. **Merges**: state the join kind explicitly, expand only the columns you need, and check the row count did not multiply (a join on a non-unique key duplicates rows).
9. **`Table.Buffer` and `List.Buffer`** only when you measured a benefit; they prevent folding and cost memory.
10. **Folder sources**: filter out temporary `~$` lock files, select sheets by name, not by position.
11. **Privacy levels and credentials** are the user's decision. If a refresh hits a prompt, stop and report it.

## Review checklist (use when asked to review or before committing)

- [ ] No hardcoded path, server or URL; parameters exist and are used
- [ ] Staging queries are connection only and contain no business logic
- [ ] Columns whitelisted; types set once; culture given for text parsing
- [ ] Filters early; no folding breaker before a filter on a database source
- [ ] No duplicated step chains across queries; shared logic in `fn_*`
- [ ] Merge keys unique or the multiplication is intended and noted
- [ ] Output row count and key columns verified after a real refresh
- [ ] `lint_queries` clean or each remaining finding justified
- [ ] Queries exported and committed

Ready-to-adapt M patterns are in `references/m-patterns.md`.
