# Reproducing these agent presets in another environment

Three task-scoped agent presets for DeepSeek Harness. This is the recipe to rebuild them
elsewhere, either by cloning this repository or from the pinned sources below.

- **`powerbi`** — dashboard work: a PBIP project's report, semantic model, Power Query M and Deneb
  visuals, with skills covering TMDL, PBIR, DAX, model review and local data analysis.
- **`coding`** — general software engineering in Python, TypeScript and Go, with symbol-level code
  intelligence.
- **`docs`** — documentation generated from a repository: HTML and PDF with diagrams, animation and
  interactive charts.

A fourth preset, `standard`, ships with DSH and is left alone.

---

## 1. Prerequisites

Nothing below is installed by this repository. Check each before starting.

| need | for | check |
|---|---|---|
| Node.js 20+ | the MCP servers run through `npx` | `node --version` |
| Python 3.11+ | the `pdf` skill's scripts, the `docs` virtualenv | `python --version` |
| `uv` | creating project Python environments | `uv --version` |
| Chrome | the `docs` preset renders and audits with it | `chrome.exe` exists |
| Power BI Desktop | the `powerbi` preset, for model refresh and screenshots | optional, only for some paths |
| `serena` | the `coding` preset's code intelligence | `serena --version` |
| `gopls` | Serena serving Go | `go install golang.org/x/tools/gopls@latest` |
| `rtk` | optional, token reduction on shell output | `rtk --version` |

**The `pdf` skill needs poppler and will not work without it.** `convert_pdf_to_images.py` imports
`pdf2image`, which needs the poppler binaries. `SKILL.md` mentions `pip install pytesseract
pdf2image` and omits that requirement. A replacement, `pdf-to-images.py`, is included in the skill
and uses `pypdfium2`, which has no native dependency.

---

## 2. Layout

A preset is a directory under `<dshHome>/.agent-presets/<id>/` containing:

```
<id>/
  agent.cordis.yml     the composition: which plugins, tools and skills this preset mounts
  preset.yml           display name, description, sort order
  skills/<name>/SKILL.md
```

`agent.cordis.yml` is a copy of the shipped `standard` composition with one line changed — the
persona — plus any MCP rows. That is deliberate: the tool roster stays identical across presets so
nothing breaks, and the presets differ by persona, skills and MCP.

`preset.yml` must quote any description containing a colon. An unquoted `: ` inside a YAML scalar is
a mapping, which invalidates the whole file; the picker then shows the directory id and
"No description", which looks like missing metadata rather than a syntax error.

---

## 3. Fast path: clone this repository

The presets, their skills and the Serena context are all here.

```bash
git clone <this-repo> ~/.dsh/.agent-presets
```

Then adjust the machine-specific values in section 6 and run the verification in section 7.

The `docs` preset's Python virtualenv is gitignored — 77 MB, rebuilt from
`docs/skills/pdf/LOCAL-SETUP.md`.

---

## 4. From scratch: the pinned sources

Twelve repositories. Every skill is vendored unmodified at a pinned commit, with its source,
upstream path and commit recorded in an `ATTRIBUTION.md` beside it.

### 4.1 The four skills written for this setup

Not in any repository. They live only here and exist in no upstream:

| skill | preset | what it covers |
|---|---|---|
| `repo-orientation` | coding | where to look first in an unfamiliar repository |
| `test-design` | coding | designing tests that fail for one reason; TDD covers the rhythm, not the design |
| `document-outline` | docs | what belongs in a document and in what order |
| `repo-documentation` | docs | the artefact: offline output, print stylesheets, diagram hygiene |

Clone this repository to get them, or copy the directories.

### 4.2 `powerbi` — 11 skills, 1 MCP

| skill | repo | upstream path | commit | licence |
|---|---|---|---|---|
| `deneb-visuals` | data-goblin/power-bi-agentic-development | `plugins/custom-visuals/skills/deneb-visuals` | `f1a514cc` | GPL-3.0 |
| `pbir-format` | ” | `plugins/pbip/skills/pbir-format` | `f1a514cc` | GPL-3.0 |
| `pbip` | ” | `plugins/pbip/skills/pbip` | `f1a514cc` | GPL-3.0 |
| `tmdl` | ” | `plugins/pbip/skills/tmdl` | `f1a514cc` | GPL-3.0 |
| `power-query` | ” | `plugins/semantic-models/skills/power-query` | `f1a514cc` | GPL-3.0 |
| `review-report` | ” | `plugins/reports/skills/review-report` | `f1a514cc` | GPL-3.0 |
| `bpa-rules` | ” | `plugins/tabular-editor/skills/bpa-rules` | `f1a514cc` | GPL-3.0 |
| `using-duckdb` | ” | `plugins/etl/skills/using-duckdb` | `f1a514cc` | GPL-3.0 |
| `semantic-model-authoring` | microsoft/skills-for-fabric | `plugins/fabric-skills/skills/semantic-model-authoring` | `65bfb5eb` | MIT |
| `powerbi-report-cli` | ” | `plugins/powerbi-authoring/skills/powerbi-report-cli` | `65bfb5eb` | MIT |
| `humanizer` | blader/humanizer | repository root | `9862685f` | MIT |

Full commits: `f1a514cc9c572bd07312e57c5ea57fbd6d1a1940`,
`65bfb5eb2c488cd03183df88f76ac3de65dcb910`, `9862685f575c65a8247f90369951df1b3416e3d6`.

`powerbi-report-cli` calls the `powerbi-report-author` CLI, so install
`@microsoft/powerbi-report-authoring-cli` globally or that skill has nothing to call.

**Deliberately not included:** `dax` from data-goblin. `semantic-model-authoring` already ships
`dax-guidelines.md`, `dax-perf-decision-guide.md` and `dax-perf-patterns.md` — 73 KB of DAX material
plus an optimisation workflow. Adding it would be duplication, and removing duplication is what
took the coding preset from 84 skills to 37.

### 4.3 `docs` — 11 skills, 1 MCP

| skill | repo | upstream path | commit | licence |
|---|---|---|---|---|
| `archify` | tt-a1i/archify | `archify` | `4694462a` | MIT |
| `diagram-design` | cathrynlavery/diagram-design | `skills/diagram-design` | `dc1ace47` | MIT |
| `design-taste-frontend` | Leonxlnx/taste-skill | `skills/taste-skill` | `e79ca9ec` | MIT |
| `high-end-visual-design` | ” | `skills/soft-skill` | `e79ca9ec` | MIT |
| `minimalist-ui` | ” | `skills/minimalist-skill` | `e79ca9ec` | MIT |
| `full-output-enforcement` | ” | `skills/output-skill` | `e79ca9ec` | MIT |
| `codebase-to-course` | zarazhangrui/codebase-to-course | repository root | `ff8837ec` | **none** |
| `pdf` | anthropics/skills | `skills/pdf` | `34040c9c` | **proprietary** |
| `humanizer` | blader/humanizer | repository root | `9862685f` | MIT |

Full commits: `4694462a8d51501f89f5c8f76e5364f022834afb`,
`dc1ace47b99a419e42d01a03cb6ace5346efa8ae`, `e79ca9ec7e071eb3a3b623c4fb752e853fc3ed58`,
`ff8837ecf8e9f6ce9874ffa42e42633394a52a00`, `34040c9c568585f6929bedeaad110ad08f079624`.

**Two of these carry licence problems, recorded because anyone rebuilding this should decide
knowingly rather than inherit the decision:**

- **`codebase-to-course` has no licence file at all.** GitHub reports `license: null`, the
  repository root holds only `.gitignore`, `README.md`, `SKILL.md` and `references`, and the README
  says nothing about licensing. Absent a licence the default is all rights reserved.
- **`pdf` is proprietary with an explicit restriction.** Its `LICENSE.txt` is © 2025 Anthropic, PBC,
  all rights reserved, and forbids extracting or retaining copies outside Anthropic's Services,
  reproducing the materials, and creating derivative works. Every skill in that repository ships its
  own `LICENSE.txt`, so no repository-wide grant applies.

Both were installed at the operator's explicit direction after the terms were raised. If you are
rebuilding this elsewhere, that decision is yours to take again.

**Deliberately not included:** eight of the thirteen skills in `taste-skill` (image generation and
landing pages) and `design-taste-frontend-v1`, which the collection itself marks as superseded.
Also `archify-review`, which is maintainer tooling for archify's own issues rather than for
documentation work.

### 4.4 `coding` — 37 skills, 2 MCP

Pinned commits: `5bf4e78011075bcfc0dc295f0724994cd123ee71` (superpowers),
`e3ba2aa6f1e6f0bc4d69eb09c9f0d0a93af56156` (ponytail),
`c004a74784a08295d52749b04cda634125b9a581` (addyosmani),
`484efcbe67ae1e558b4df95bfc90135b7b0c9df8` (mattpocock), `9862685f` (humanizer).

| repo | skills | licence |
|---|---|---|
| obra/superpowers | `brainstorming`, `executing-plans`, `receiving-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills` | MIT |
| addyosmani/agent-skills | `api-and-interface-design`, `browser-testing-with-devtools`, `code-review-and-quality`, `code-simplification`, `constraint-driven-development`, `context-engineering`, `documentation-and-adrs`, `doubt-driven-development`, `frontend-ui-engineering`, `git-workflow-and-versioning`, `incremental-implementation`, `interview-me`, `performance-optimization`, `security-and-hardening`, `source-driven-development`, `spec-driven-development` | MIT |
| mattpocock/skills | `domain-modeling` (`skills/engineering/`), `prototype` (`skills/engineering/`), `pr` (`skills/in-progress/`), `retro` (`skills/in-progress/`), `to-questionnaire` (`skills/productivity/`) | MIT |
| DietrichGebert/ponytail | `ponytail`, `ponytail-audit`, `ponytail-debt` | MIT |
| blader/humanizer | `humanizer` | MIT |

**Removed as duplicates, and worth not re-adding:** 47 skills were cut across four passes, 84 down
to 37. TDD arrived in three collections, debugging in three, code review in five, planning in five,
module design in four. `REPLACED-SKILLS.md` in the `powerbi` sibling records the first pass. The
principle: when two skills do the same job, keep the most complete one and delete the rest, then
check that nothing surviving references something removed.

**Rejected on principle:** language-specific skills. There is no mature collection — the best
candidates had 1, 2 and 11 stars, one had no licence file, and one stamped MIT on material whose
upstream is CC-BY-3.0. Rejected as well on merit: the model knows these languages, style belongs to
linters in CI rather than to a skill that asks for it, and a language standard would fight
`repo-orientation`, which tells the agent to match the repository's own conventions.

---

## 5. The MCP rows

Append to the preset's `agent.cordis.yml`, at the end, at top level. `dsh-mcp-client` publishes no
service, so these are plain rows and need no `isolate` realm.

**Both gotchas below cost real time. Read them before changing any of this.**

- **`{{cwd}}` and `{{model}}` do not interpolate in an MCP row.** DSH resolves them only in persona
  and instruction text and in the ACP/SDK profiles; an MCP row's args reach `dsh-mcp-client` as
  plain strings. A row containing `'{{cwd}}'` starts the server with a literal `{{cwd}}` and every
  tool fails with "no active project", which reads like a Serena problem rather than a config one.
  Paths here must be literal.
- **`failOnStartupError` defaults to `false`.** A server that will not start costs its own tools and
  not the session, so a broken row degrades rather than blocks. Do not set it true.

### `powerbi`

```yaml
- id: mcp-powerbi-modeling
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    transport: stdio
    serverName: powerbi-modeling
    command: npx
    args: ['-y', '@microsoft/powerbi-modeling-mcp@latest', '--start']
    toolCallTimeoutMs: 240000
    failOnStartupError: false
```

21 tools. `ConnectFolder` loads the model from the TMDL folder with **no Power BI Desktop running**,
which was verified. Gives `partition_operations` (read, write and refresh the M),
`dax_query_operations` (Execute and Validate), `named_expression_operations`, and
`transaction_operations` with `ROLLBACK` — the rollback being the point, since it turns "edit M and
reload in hope" into "change it, run it, undo it if it fails".

### `docs`

```yaml
- id: mcp-chrome-devtools
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    transport: stdio
    serverName: chrome-devtools
    command: npx
    args:
      - '-y'
      - 'chrome-devtools-mcp@latest'
      - '--headless'
      - '--isolated'
      - '--viewport=1280x900'
      - '--categoryPerformance=false'
      - '--categoryNetwork=false'
      - '--usageStatistics=false'
      - '--screenshotFormat=jpeg'
      - '--screenshotMaxWidth=1280'
      - '--no-page-id-routing'
    toolCallTimeoutMs: 120000
    failOnStartupError: false
```

24 tools. The category flags cut it from 29 by dropping profiler and network tools that nothing here
uses. `--usageStatistics=false` because Google collects them by default by default.
`--no-page-id-routing` is required in practice: without it every page-scoped call demands a
`pageId` and fails with a validation error that does not say so.

There is **no PDF tool**. Print to PDF comes from Chrome on the command line:
```
chrome --headless --disable-gpu --print-to-pdf=out.pdf --no-pdf-header-footer page.html
```

**`lighthouse_audit` rejects `file://`** with `INVALID_URL`. Serve the page over HTTP first, for
example `python -m http.server`.

### `coding`

```yaml
- id: mcp-serena
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    transport: stdio
    serverName: serena
    command: serena
    args:
      - 'start-mcp-server'
      - '--context'
      - '<path to serena/contexts/dsh-coding.yml>'
      - '--project'
      - '<absolute path to the project>'
    toolCallTimeoutMs: 180000
    failOnStartupError: false

- id: mcp-context7
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    transport: stdio
    serverName: context7
    command: npx
    args: ['-y', '@upstash/context7-mcp@latest']
    toolCallTimeoutMs: 60000
    failOnStartupError: false
```

Serena's context file is `serena/contexts/dsh-coding.yml` in this repository. It is not optional:
Serena loads **52 tools internally and exposes 29 by default**, and the context cuts that to **11**
by excluding seventeen — six that duplicate the native file, search and shell tools, six memory
tools, four bootstrap tools, and `find_implementations`.

`find_implementations` is excluded because **the Pyright backend does not implement
`textDocument/implementation`** and answers `-32601 Unhandled method`, so the tool failed on every
call in four separate sessions. Use `find_referencing_symbols` or `find_symbol` for hierarchies.
Add it back only if the project moves to the JetBrains backend.

`--project` must be literal, per the gotcha above, so **this row serves one project**. Changing
repositories means editing that line. `--project-from-cwd` exists and works, but the MCP client's
`cwd` defaults to empty and inherits the host process's directory rather than the workspace, so it
cannot be aimed at the project from here.

Serena also needs its language servers configured per project, in `<project>/.serena/project.yml`:
`language_servers: [python, typescript, go]`. Configured for Python alone, the eleven tools are
present and callable but return nothing useful for the other two languages, which is a silent
degradation rather than an error. Go needs `gopls` installed. Set `line_ending: lf` there too: the
global default is `native`, which on Windows is CRLF, and Serena passes it to `write_text`, so every
symbolic edit rewrites the whole file's line endings.

---

## 6. Machine-specific values to change

| where | value | change to |
|---|---|---|
| `coding/agent.cordis.yml` | `--project` path | your project's absolute path |
| `coding/agent.cordis.yml` | `--context` path | where you put `serena/contexts/` |
| `docs/agent.cordis.yml` | `--screenshotMaxWidth` | your preferred screenshot width |
| `<project>/.serena/project.yml` | `language_servers`, `line_ending` | the languages you use |

Nothing else is machine-specific. The `powerbi` and `docs` MCP rows use `npx` and carry no paths.

---

## 7. Verification

Do not assume any of this works because the files look right. Each of these was checked this way,
and several claims turned out false on first testing.

**The composition loads.** A preset whose composition cannot load is listed in the picker with the
reason rather than hidden, so open the preset picker in a new session and read what it says.

**Skill frontmatter.** Every skill needs `name` and `description`. A skill without them is dropped
silently.

```bash
for f in */skills/*/SKILL.md; do
  head -1 "$f" | grep -q '^---$' && grep -q '^name:' "$f" && grep -q '^description' "$f" \
    || echo "bad frontmatter: $f"
done
```

**MCP servers start and expose the expected tool counts.**

```bash
npx -y @microsoft/powerbi-modeling-mcp@latest --start     # expect 21
npx -y chrome-devtools-mcp@latest --headless --isolated   # expect 29, or 24 with the flags
serena start-mcp-server --context <ctx> --project <proj>   # expect 11
npx -y @upstash/context7-mcp@latest                        # expect 2
```

**Serena actually serves the project.** Listing tools is not enough — the project can be absent
while the tools exist. Call `get_symbols_overview` on a real file and confirm it returns symbols.

**The Power BI MCP reads the model without Desktop running.** Call `connection_operations` with
`ConnectFolder` against the `.SemanticModel` folder, then `partition_operations LIST`. Expect the
partitions with their source type.

**Chrome renders and audits.** Navigate to a file, take a screenshot, and run `lighthouse_audit`
against an HTTP URL. Accessibility below 100 means real defects; this is how a contrast failure at
3.8:1, a missing `main` landmark and a missing description were found in a page that looked fine.

---

## 8. What is not reproduced here

- **`AGENTS.md`** in the target project. It is project-specific. The one in this repository records
  the file-writing traps that cost the most time: a UTF-8 BOM breaks PBIR, PowerShell 5.1 reads
  UTF-8 as Windows-1252, non-ASCII inside a PowerShell script body breaks parsing, a colon in an
  unquoted YAML scalar invalidates the file, `git commit -m` fails on braces, PowerShell's `>`
  writes UTF-16LE, and the console is cp1250.
- **The docs virtualenv**, gitignored and rebuilt from `docs/skills/pdf/LOCAL-SETUP.md`.
- **The `codebase-to-course` and `pdf` licence decisions**, which are the operator's to take again.

## 9. What was measured, and what was assumed

Everything asserted above about tool counts, server behaviour, Serena's exclusions and the MCP
gotchas came from running the thing, not from its documentation. Where it did not, it says so. The
same discipline is worth applying to any change made here: a check that measures something adjacent
to what was asked is worse than no check, because it produces confidence without evidence.
