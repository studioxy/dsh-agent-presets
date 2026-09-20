# LOCAL-TOOLING — zastępuje komendy `pbir` z SKILL.md

Ten plik nadpisuje politykę narzędziową `SKILL.md`. Powstał 2026-09-20 przy wdrożeniu
w projekcie **Energy BU Logistics**.

## Dlaczego

`SKILL.md` zakłada CLI `pbir` z [pbir.tools](https://github.com/maxanatsko/pbir.tools)
(`uv tool install pbir-cli`). **To CLI nie jest zainstalowane i nie zostanie**, bo jego
licencja to *Custom Non-Commercial*: „The Software may not be used for commercial purposes
without prior written permission from the copyright holders", a klauzula 3 wymienia
„Using the Software to provide paid consulting or development services". Firmowy dashboard
to użycie komercyjne. Jeśli chcesz to CLI, najpierw uzyskaj pisemną zgodę autorów.

**Każde wystąpienie `pbir <komenda>` w `SKILL.md` traktuj jako opis intencji, nie jako
polecenie do uruchomienia.** Odpowiedniki poniżej.

## Co jest zainstalowane i zweryfikowane

### 1. `powerbi-report-author` v0.1.4 — oficjalny Microsoft, MIT

```bash
powerbi-report-author --help
powerbi-report-author validate "<ścieżka do .Report lub .pbip>"
powerbi-report-author expr encode <wartość> --kind string|number|integer|themeColor
powerbi-report-author expr decode '<json literal>'
powerbi-report-author catalog list
powerbi-report-author catalog describe cardVisual
powerbi-report-author preview-visuals "<ścieżka>"
powerbi-report-author doctor
```

Wejście: `dist/cli.js` w
`C:\Users\andrz\AppData\Roaming\npm\node_modules\@microsoft\powerbi-report-authoring-cli\`.

### 2. `powerbi-desktop` v0.1.2 — Desktop Bridge, Microsoft

```bash
powerbi-desktop status                  # instancje, otwarty plik, niezapisane zmiany, strony
powerbi-desktop open "<plik.pbip>"
powerbi-desktop reload                  # przeładuj PBIR na kanwę
powerbi-desktop screenshot <page-id>    # PNG jednej strony
powerbi-desktop screenshot-all          # PNG wszystkich stron z pages.json
```

Wymaga uruchomionego Power BI Desktop z włączoną preview feature
**„Enable external tool access to Power BI Desktop through secure local APIs"**.
Bez tego `status` zwraca `not_connected` i `instances: []`.

### 3. `vl-convert` 1.9.0 — render offline, BSD-3-Clause

```bash
"C:\Users\andrz\.dsh\tools\vl-convert\bin\vl-convert.exe" vl2png --input chart.vl.json --output chart.png
```

Renderuje Vega/Vega-Lite **bez Power BI i bez przeglądarki** (wbudowany V8). To jest pętla
szybkiej iteracji: spec → PNG → obejrzyj → popraw → powtórz. Dopiero sprawdzony spec
wstrzykuj do raportu.

## Zweryfikowane na żywym raporcie (2026-09-20)

Uruchomione w Power BI Desktop na raporcie Energy BU Logistics, silnik Deneb z AppSource:

1. **`pbiColor(...)` NIE działa i jest cichym zabójcą.** Nie rozwiązuje się w żadnej formie
   (`{"value": "pbiColor(0)"}`, `{"expr": ...}`, `calculate` + pole). Co gorsza: odwołanie
   w wyrażeniu **przerywa całą specyfikację** — wizualizacja pokazuje osie z prawdziwymi danymi,
   ale zero znaczników i **zero komunikatu o błędzie**. Sonda z `typeof(pbiColor)` nie
   wyrenderowała nawet tekstu. **Używaj jawnych heksów** i trzymaj je w pliku palety, żeby dały się
   podmienić. Sekcja „Theme Integration" w `SKILL.md` jest w tym środowisku nieaktualna.
2. **`autosize` musi być na najwyższym poziomie specyfikacji.** W `config` jest po cichu ignorowany.
3. **Power BI odrzuca BOM w plikach PBIR.** `Set-Content -Encoding utf8` w PowerShellu BOM dodaje
   → Desktop odmawia reloadu komunikatem o BOM. Pisz przez
   `[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))`.
4. **Nazwy pól z `displayName` działają.** Sonda potwierdziła, że miary i kolumny dochodzą do
   specyfikacji pod `displayName` z projekcji; pole niepodpięte jest `undefined`.
5. **`powerbi-desktop reload` nie nadpisuje plików na dysku**, nawet gdy Desktop zgłasza
   niezapisane zmiany.

## Twarde zasady (zweryfikowane eksperymentalnie)

### 1. Nie podawaj JSON-a inline przez PowerShell

PowerShell zjada cudzysłowy w argumentach przekazywanych do natywnych .exe. Objaw:
`{"a":"b"}` dociera do CLI jako `{a:b}`. To doprowadziło do błędnego wniosku, że codec
psuje JSON — **codec jest poprawny**.

Zamiast tego użyj pliku albo wywołania bez shella:

```js
// node, bez shella
execFileSync(process.execPath, [CLI_JS, 'expr', 'encode', json, '--kind', 'string'])
```

albo zapisz wartość do pliku i podaj ścieżkę.

### 2. Kodowanie `jsonSpec` — reguła

Deneb przechowuje spec jako **tekstowy literał PBIR**:

```
Value = "'" + JSON.stringify(spec) + "'"
```

Czyli: stringifikowany JSON opakowany w apostrofy. `JSON.stringify` zamienia wewnętrzne
cudzysłowy na `\"`, co **nie wymaga** żadnego dodatkowego escapowania.

**Wniosek praktyczny: wewnątrz specyfikacji używaj wyłącznie cudzysłowów podwójnych.**
Wtedy nie ma ani jednego apostrofu do zdublowania.

### 3. Apostrofy w specyfikacji — pułapka

PBIR opakowuje całą wartość w apostrofy, więc **każdy apostrof wewnątrz musi być zdublowany**.
Codec Microsoftu tego **nie robi** — zweryfikowane:

```
expr encode "datum['Order Lines']" --kind string
→ {"Value":"'datum['Order Lines']'"}     # niepoprawny literał PBIR, cicho zepsuty
```

Dwie drogi:

1. **Zalecana:** używaj wyłącznie cudzysłowów podwójnych wewnątrz specyfikacji. `JSON.stringify`
   zamienia je na `\"` i problem nie istnieje:

   ```json
   {"calculate": "datum[\"Order Lines\"] - datum[\"Order Lines (PY)\"]", "as": "diff"}
   ```

2. **Gdy apostrof jest nieunikniony** (np. literał tekstowy w filtrze): zdubluj go (`''`).
   Lokalny skrypt `tools/deneb/build-deneb-literal.mjs` robi to automatycznie na całym
   stringifikowanym specu i wypisuje `NOTE:` z liczbą zdublowanych apostrofów — dzięki temu
   możesz świadomie zostawić apostrof w opisie czy etykiecie.

### 4. Literały liczbowe

| `--kind` | wynik | użycie |
|---|---|---|
| `integer` | `270L` | właściwości całkowitoliczbowe PBIR |
| `number` | `14D` | **właściwości Deneb**, np. `viewportWidth` — Deneb sam zapisuje `D` |
| `themeColor` | `{"ThemeDataColor":{"ColorId":0,"Percent":-30}}` | kolory motywu |

### 5. `expr decode` jest słaby

`decode` nie rozpoznaje sufiksów liczbowych — dla `"270D"` zwraca
`{"type":"unknown","raw":"270D"}`. Nadaje się do stringów, nie do weryfikacji typów.

## Procedura wstrzyknięcia specyfikacji do wizualizacji Deneb

Zamiast `pbir visuals deneb ... --spec-file`:

1. **Zapisz spec** jako zwykły JSON, np. `tools/deneb/panel.vl.json` (cudzysłów podwójny).
2. **Wyrenderuj i obejrzyj** przez `vl-convert`, aż wygląda dobrze.
3. **Zbuduj literał**: `"'" + JSON.stringify(spec) + "'"`.
4. **Wpisz go** do wizualizacji:
   - `visual.visualType` = `deneb7E15AEF80B9E4D4F8E12924291ECE89A`
   - `visual.objects.vega[0].properties.jsonSpec.expr.Literal.Value` = literał
   - `visual.objects.vega[0].properties.jsonConfig.expr.Literal.Value` = `"'{}'"`
5. **Sprawdź cudzysłowy i apostrofy** w zapisanym pliku — jeden błąd psuje raport.
6. **Zarejestruj custom visual**: dopisz GUID do `publicCustomVisuals` w `report.json`,
   zachowując istniejące identyfikatory.
7. **Zwaliduj**: `powerbi-report-author validate "<ścieżka>"`.
8. **Odśwież kanwę** (jeśli Desktop działa): `powerbi-desktop reload`.
9. **Zrzut strony**: `powerbi-desktop screenshot <page-id>` i obejrzyj PNG.

Punkty 3–6 rób skryptem, nie ręcznie. Patrz `tools/deneb/`.

## Odpowiedniki komend `pbir`

| `pbir` z SKILL.md | tutaj |
|---|---|
| `pbir add visual deneb…` | ręcznie `visual.json` + zgłoszenie w `publicCustomVisuals` |
| `pbir visuals bind …` | ręcznie `visual.query.queryState.dataset.projections` |
| `pbir visuals deneb … --spec-file` | procedura wyżej (pkt 3–4) |
| `pbir validate` | `powerbi-report-author validate` |
| `pbir desktop screenshot` | `powerbi-desktop screenshot` |
| `pbir desktop refresh` | `powerbi-desktop reload` |
| `pbir get/set` | `powerbi-report-author preview-visuals` + edycja pliku |

## Licencje — stan faktyczny

| narzędzie | licencja | status |
|---|---|---|
| `@microsoft/powerbi-report-authoring-cli` | MIT | zainstalowane |
| `@microsoft/powerbi-desktop-bridge-cli` | Microsoft | zainstalowane |
| `vl-convert` | BSD-3-Clause | zainstalowane |
| `pbir-cli` (pbir.tools) | Custom Non-Commercial | **nieinstalowane — blocker** |
| skille `data-goblin/power-bi-agentic-development` | GPL-3.0 | zainstalowane, atrybucja w `ATTRIBUTION.md` |
