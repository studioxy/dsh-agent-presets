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

**This changed in DSH 0.1.7-rc.2, and the change quietly orphaned every preset built the old way.**
Read this section even if you are only updating an existing setup.

### The retired model, and why it broke

Presets used to be directories under `<dshHome>/.agent-presets/<id>/`, discovered automatically by
a package called `dsh-agent-presets`:

```
<id>/
  agent.cordis.yml     the composition: which plugins, tools and skills this preset mounts
  preset.yml           display name, description, sort order
  skills/<name>/SKILL.md
```

**That package no longer exists.** It was replaced by `dsh-agent-preset` and
`dsh-agent-preset-registry`, and the string `.agent-presets` appears nowhere in the installed
packages. A directory in that location is now ignored entirely: the presets do not error, they
simply never appear, and the picker shows only the four built-ins plus an empty Custom group.

The source directories are still worth keeping — the compositions and all the skills live there —
but they are no longer what DSH reads.

### The current model

A preset is a **loader row inside a profile composition**:

```yaml
- insert:
    - id: preset-powerbi                     # addresses loader edits
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: powerbi                          # the identity sessions save
        name: Power BI / Deneb
        description: "..."
        order: 10
        plugins:                             # the composition, as a child entry list
          - id: persona
            name: '@deepseek-ai/dsh-persona'
          ...
```

| field | meaning |
|---|---|
| `id` (row) | loader id, for edits |
| `config.id` | the preset identity a session stores |
| `config.plugins` | the child plugin entries — this is the old `agent.cordis.yml`, indented |
| `config.name` / `description` / `order` | what the picker shows, replacing `preset.yml` |

This repository keeps each preset as a **bundle**: a directory holding `package.json` with
`dsh.bundle.patch`, and the patch file itself.

```
profile-bundles/
  powerbi/{package.json, cordis.patch.yml, agent.cordis.yml.source, preset.yml.source}
  docs/…
  coding/…
  web/…
```

The profile's `package.json` lists them as `link:` dependencies under
`dsh.profile.bundles`. `agent.cordis.yml.source` is kept beside each patch so the validator can
prove the plugin list was carried over faithfully, and so the next person can see both forms.

**Two things every migrated preset needs, and both fail silently:**

1. **`customSkillDirs` on the `skill-filesystem` row.** The default roots cover the repository and
   the user DSH root, but not a preset directory, so the preset's skills will not mount without it:
   ```yaml
   - id: skill-filesystem
     name: '@deepseek-ai/dsh-skill-filesystem'
     config:
       customSkillDirs:
         - 'C:\Users\andrz\.dsh\.agent-presets\powerbi\skills'
   ```
2. **Package names that still exist.** The retired compositions mount
   `@deepseek-ai/dsh-workflow-worker-thread`, which is gone. The current equivalent is
   `@deepseek-ai/dsh-workflow-ptc` with the same `provider: spawn` config.

Changing a profile's `package.json` needs `pnpm install` in the profile directory, and loading a
**new** bundle needs a Host restart. A patch edit alone reloads live.

`preset.yml` must quote any description containing a colon. An unquoted `: ` inside a YAML scalar is
a mapping, which invalidates the whole file; the picker then shows the directory id and
"No description", which looks like missing metadata rather than a syntax error.

---

## 3. Fast path: clone this repository

The presets, their skills, the profile bundles and the Serena context are all here.

```bash
git clone <this-repo> ~/.dsh/.agent-presets
```

Then:

1. add the four `link:../../.agent-presets/profile-bundles/<id>` dependencies and the matching
   `dsh.profile.bundles` entries to `~/.dsh/profiles/web/package.json` (section 2 has the shape),
2. run `pnpm install` in that profile directory,
3. adjust the machine-specific values in section 6,
4. restart the Host so the new bundles load,
5. run the verification in section 7.

The `docs` preset's Python virtualenv is gitignored — 77 MB, rebuilt from
`docs/skills/pdf/LOCAL-SETUP.md`.

---

## 4. From scratch: the pinned sources

Twelve repositories. Every skill is vendored unmodified at a pinned commit, with its source,
upstream path and commit recorded in an `ATTRIBUTION.md` beside it.

### 4.1 The skills written for this setup

Not in any repository. They live only here and exist in no upstream:

| skill | preset | what it covers |
|---|---|---|
| `repo-orientation` | coding | where to look first in an unfamiliar repository |
| `test-design` | coding | designing tests that fail for one reason; TDD covers the rhythm, not the design |
| `document-outline` | docs | what belongs in a document and in what order |
| `repo-documentation` | docs | the artefact: offline output, print stylesheets, diagram hygiene |

Clone this repository to get them, or copy the directories.

### 4.2 `powerbi` — 12 skills, 1 MCP

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

### 4.3 `docs` — 12 skills, 1 MCP

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

### 4.4 `coding` — 38 skills, 2 MCP

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
| written here | `repo-orientation`, `test-design`, `model-orchestration` | — |

**Every preset also carries `humanizer` and `model-orchestration`.** Both depend on machine-level
configuration rather than on the project or the task, so they sit in all four presets at the same
pinned content. If you would rather not maintain copies, the user skill root
`<dshHome>/skills` is read by every preset and holds one copy — the tradeoff is that it falls
outside this repository and therefore outside version control.

### 4.5 `web` — 25 skills, 2 MCP

Built from the other presets and from two further upstreams, rather than from a single collection,
because none covered this cleanly. It is the frontend and web-application composition: TypeScript
and JavaScript, accessible markup, component architecture, APIs, browser verification.

| borrowed from | skills |
|---|---|
| `coding` | `api-and-interface-design`, `browser-testing-with-devtools`, `code-review-and-quality`, `code-simplification`, `context-engineering`, `frontend-ui-engineering`, `git-workflow-and-versioning`, `incremental-implementation`, `performance-optimization`, `security-and-hardening`, `source-driven-development`, `spec-driven-development`, `systematic-debugging`, `test-design`, `test-driven-development`, `verification-before-completion`, `repo-orientation`, `humanizer`, `model-orchestration` |
| `docs` | `high-end-visual-design` |
| magnus919/agent-skills (MIT, `54d81f7e0205`) | `web-accessibility`, `react`, `frontend-engineering` |
| vercel-labs/agent-skills (**no licence**, `063bee94c3f4`) | `react-best-practices`, `web-design-guidelines` |

**The Vercel pair has no licence.** The repository carries no LICENSE file anywhere, so the default
applies: all rights reserved. Both were installed at the operator's explicit direction after the
absence was raised. This is recorded plainly rather than as a warning; anyone rebuilding decides
again. It is the third such case here, after the Anthropic `pdf` skill and `codebase-to-course` in
the `docs` preset.

What each actually is, since their sizes mislead in opposite directions:

| skill | shape | note |
|---|---|---|
| `react-best-practices` | 76 files, 233 KB | 72 rule files in 8 categories prioritised from critical to low, plus a 109 KB `AGENTS.md` that is the same rules compiled into one document — kept because `SKILL.md` names it |
| `web-design-guidelines` | 1 file, 1.2 KB | **fetches its rules at run time** from a Vercel URL rather than containing them, so it is not the stub its size suggests, and it does carry a live network dependency |

### The SEO family was removed

Seven skills from `AgriciDaniel/claude-seo` were briefly installed and then removed at the
operator's direction. The episode is worth recording because it shows how a skill family resists
cherry-picking: four were taken, three more turned out to be needed, and the set *still* required one
file out of an eighth — `seo-schema` instructs the agent to read `../seo/references/schema-types.md`,
which lives in the family's orchestrator.

That orchestrator is the reason the family was dropped rather than completed. The `seo` skill
dispatches to thirty siblings, carries seventeen references about backlinks, local search and Google
Maps, and names several skills the repository does not contain. Finishing the set would have meant
installing an agency workflow into a preset whose job is building a site.

**A checker must not assume every directory under a skill root is a skill.** Three of mine did, and
all three reported defects the moment a `skills/seo/` directory without a `SKILL.md` appeared. The
provider's filter requires `<name>/SKILL.md`, so such a directory is ignored rather than rejected; a
checker that counts directories rather than `SKILL.md` files disagrees with the provider about what
is installed.

Three skills still name sibling skills their own collection has but we do not — `playwright`, `vite`
and `mobile-development` from `frontend-engineering` and `react`, and `hugo-theme` and the
`product-*` family from `web-accessibility`. Those references sit inside **When Not To Use**
sections, so they are routing notes rather than content reads: the skill is saying the topic is not
its job. They are left as they are, and the distinction matters — a missing *file* a skill tells the
agent to read is a defect, a missing *sibling skill* it declines to cover is not.

The three vendored additions are whole bundles, since a thin `SKILL.md` with references beside it is
the intended shape:

| skill | bundle | why it is here |
|---|---|---|
| `web-accessibility` | 17 files, 36 KB | implementation-time checklists for design, implementation and release, plus references on keyboard and focus, semantics and names, and forms and errors |
| `react` | 7 files, 22 KB | the only React material in any preset: component and state guidance, Vite diagnostics, and a `react-doctor.py` script with tests |
| `frontend-engineering` | 12 files, 76 KB | 32 KB on responsive-layout testing and performance budgets with a checker script, neither of which the UI-craft skill covers |

**`frontend-engineering` partially overlaps `frontend-ui-engineering`, and this was a borderline
call rather than a clear one.** They share component architecture and state management. They were
kept apart because the vocabulary overlap measured 17% and because the assets differ in kind: one is
a complete single-file guide to UI craft, the other a thin methodology over heavy references. If the
pair ever gives conflicting advice, this is the decision to revisit.

The other two candidates were rejected. `sickn33/agentic-awesome-skills` has 47k stars and MIT but
ships 8,203 skills, which is a dump rather than a curation and already contains duplicates of two
skills installed here. `helloianneo/awesome-claude-code-skills` is well regarded but had not been
updated in six months, and two further collections carried no licence at all.

Two deliberate differences from `coding`, both recorded in the bundle header:

- **Serena is absent.** Its `--project` argument has to be a literal path, because DSH does not
  interpolate `{{cwd}}` in MCP rows, so `coding` can only ever serve one repository. A web preset
  has to work across repositories. `context7` and the native search tools cover what remains.
- **Chrome DevTools is added,** for inspecting a running page and verifying visible behaviour rather
  than inferring it from source.

**Removed as duplicates, and worth not re-adding:** 47 skills were cut across four passes, 84 down
to 38. TDD arrived in three collections, debugging in three, code review in five, planning in five,
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
