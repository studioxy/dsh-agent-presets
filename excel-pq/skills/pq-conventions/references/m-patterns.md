# M patterns

Written from the M language reference; **not executed in Excel in this package**. Validate each with `validate_m` and `evaluate_steps` before use.

## Parameter-driven source (no hardcoded path)

```m
// p_SourceFolder is a Text parameter, e.g. C:\Data\SAP
let
    Source = Excel.Workbook(File.Contents(p_SourceFolder & "\export.xlsx"), true, true),
    Sheet  = Source{[Item = "Sheet1", Kind = "Sheet"]}[Data]
in
    Sheet
```

## Staging: whitelist, then type once with culture

```m
let
    Source = ...,                                   // see above
    Keep   = Table.SelectColumns(Source, {"Delivery", "Material", "Ship date", "Qty"}, MissingField.Error),
    Typed  = Table.TransformColumnTypes(
                 Keep,
                 {{"Delivery", type text}, {"Material", type text}, {"Ship date", type date}, {"Qty", type number}},
                 "pl-PL")
in
    Typed
```

## Typed custom column

```m
Added = Table.AddColumn(Typed, "Is late", each [Ship date] > [Due date], type logical)
```

## Merge, expand only what you need

```m
Merged   = Table.NestedJoin(Left, {"Material"}, Right, {"Material"}, "R", JoinKind.LeftOuter),
Expanded = Table.ExpandTableColumn(Merged, "R", {"Description", "Weight"}, {"Description", "Weight"}),
// guard: a join on a non-unique key multiplies rows
Checked  = if Table.RowCount(Expanded) <> Table.RowCount(Left)
           then error "Merge multiplied rows: Right.Material is not unique"
           else Expanded
```

## Unpivot everything except the id columns

```m
Long = Table.UnpivotOtherColumns(Prev, {"Department", "Account"}, "Month", "Value")
```

## Folder of workbooks (skips lock files, selects the sheet by name)

```m
let
    Files  = Folder.Files(p_SourceFolder),
    Xlsx   = Table.SelectRows(Files, each Text.EndsWith([Name], ".xlsx") and not Text.StartsWith([Name], "~$")),
    Loaded = Table.AddColumn(
                 Xlsx, "Data",
                 each Excel.Workbook([Content], true, true){[Item = "Data", Kind = "Sheet"]}[Data],
                 type table),
    Result = Table.Combine(Loaded[Data])
in
    Result
```

## Diagnostic query: show rows that failed type conversion

```m
// diag_ConversionErrors (connection only)
let
    Source = stg_SapDeliveries,
    Errors = Table.SelectRowsWithErrors(Source, {"Ship date", "Qty"})
in
    Errors
```

## Fail loudly on empty output

```m
Result =
    if Table.RowCount(Prev) = 0
    then error "stg_SapDeliveries returned 0 rows: wrong sheet, header row or filter"
    else Prev
```

## Reusable function skeleton

```m
// fn_CleanText
(t as nullable text) as nullable text =>
let
    s = if t = null then null else Text.Clean(Text.Trim(Text.Replace(t, Character.FromNumber(160), " ")))
in
    if s = "" then null else s
```

Apply it with `Table.TransformColumns(Prev, {{"Name", fn_CleanText, type nullable text}})`.
