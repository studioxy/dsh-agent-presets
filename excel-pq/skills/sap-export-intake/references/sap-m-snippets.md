# SAP M snippets

These snippets were written from the M language reference and have **not been executed in Excel in this package**. Run each with `evaluate_query` / `evaluate_m` (pq server) or in Excel before relying on it, and adjust the culture to the SAP user's notation.

## fn_SapNumber: text to number, handles trailing minus, spaces and nbsp

```m
// fn_SapNumber
(t as nullable text) as nullable number =>
let
    clean = if t = null then null
            else Text.Replace(Text.Replace(Text.Trim(t), Character.FromNumber(160), ""), " ", ""),
    result =
        if clean = null or clean = "" then null
        else
            let
                neg  = Text.EndsWith(clean, "-"),
                core = if neg then Text.RemoveRange(clean, Text.Length(clean) - 1, 1) else clean,
                n    = Number.FromText(core, "pl-PL")
            in
                if neg then -n else n
in
    result
```

Notes: if the SAP user uses a dot as the thousands separator together with a decimal comma (`1.234,56`), remove the dots before `Number.FromText`. Check a real sample first.

## fn_SapDate: text to date, SAP empty date and open-end sentinel to null

```m
// fn_SapDate
(t as nullable text) as nullable date =>
let
    s = if t = null then null else Text.Trim(t)
in
    if s = null or s = "" or s = "00.00.0000" or s = "31.12.9999" then null
    else Date.FromText(s, [Format = "dd.MM.yyyy", Culture = "pl-PL"])
```

If you need to keep the open-end sentinel as a flag, add a separate `Is open ended` column before this conversion.

## fn_SapKey: normalise a key column (text, trimmed, no nbsp)

```m
// fn_SapKey
(t as any) as nullable text =>
let
    s = if t = null then null else Text.From(t),
    c = if s = null then null else Text.Trim(Text.Replace(s, Character.FromNumber(160), " "))
in
    if c = "" then null else c
```

If a key column arrived as numbers, the leading zeros are already lost; reload it as text from the source, do not pad blindly.

## Locate the header row by name, then promote

```m
let
    // useHeaders = false keeps the title rows as data
    Raw        = Excel.Workbook(File.Contents(p_SourceFolder & "\export.xlsx"), false, true){[Item = "Sheet1", Kind = "Sheet"]}[Data],
    AsRows     = Table.ToRows(Raw),
    HeaderIdx  = List.PositionOf(List.Transform(AsRows, each List.Contains(List.Transform(_, each if _ = null then "" else Text.From(_)), "Delivery")), true),
    Skipped    = if HeaderIdx < 0 then error "Header row with column 'Delivery' not found" else Table.Skip(Raw, HeaderIdx),
    Promoted   = Table.PromoteHeaders(Skipped, [PromoteAllScalars = true])
in
    Promoted
```

Replace `"Delivery"` by a column that exists in every variant of the export, or by a lookup from `map_sap_columns`.

## Drop total and subtotal rows

```m
NoTotals = Table.SelectRows(Typed, each [Delivery] <> null and not Text.StartsWith(Text.From([Delivery]), "*")
                                       and not List.Contains({"total", "suma", "razem"}, Text.Lower(Text.From([Delivery]))))
```

## Row-count assertions: fail loudly

```m
Counted =
    if Table.RowCount(NoTotals) = 0
    then error "stg_SapDeliveries returned 0 rows: wrong sheet, header row or filter"
    else NoTotals
```
