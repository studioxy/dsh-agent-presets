# DSH agent presets

Five task-scoped agent presets for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart)
— the `@deepseek-ai/dsh` CLI — with every skill vendored at a pinned commit, the profile configuration
that routes them, and the scripts that put the whole thing on a machine.

| preset | skills | MCP | for |
|---|---|---|---|
| `powerbi` | 12 | 1 | Power BI PBIP: report and semantic model, TMDL, PBIR, DAX, Deneb visuals |
| `docs` | 12 | 1 | documentation from a repository: HTML and PDF with diagrams and charts |
| `coding` | 39 | 2 | software engineering in Python, TypeScript and Go |
| `web` | 25 | 2 | web applications: frontend, APIs, accessibility, React |
| `excel-pq` | 4 | 3 | Excel and Power Query, SAP export intake |

A sixth, `standard`, ships with DSH and is untouched.

---

## What a session cost

The session statistics dialog in the GUI shows tokens, turns and timings. **It has no cost line, and
no setting adds one.** The harness models cost — a model carries a `cost` field — but nothing
populates it and nothing reads it; the source says so in a comment, *"cost metadata — replay.ts
zeroes it and no consumer"*, and the pi-ai catalogue ships no prices at all.

`session-cost.mjs` reads the same durable log and prices it against what the gateways actually
charge:

```bash
node session-cost.mjs              # the most recent session
node session-cost.mjs --all        # every session, one line each
node session-cost.mjs --json       # machine-readable
node session-cost.mjs --refresh    # re-fetch prices instead of using the cache
```

```
model                                    req       input      output  cache-read        cost
deepseek-official / deepseek-flash       983   1,800,117     953,649 478,393,344    $2.277387
cheaperinference / deepseek-v4.1-flash   333     949,453     259,572 134,839,808    $0.351340
cheaperinference / gpt-6-luna             22     430,129      26,485   4,327,617    $0.064696
RAZEM                                                                              $2.693423
```

Four things are worth knowing about how it derives those numbers.

**Where the model comes from.** Each `assistant/message` carries usage but not which model produced
it, so the script takes the `config` of the most recent `request/header` before it. A session that
switched models mid-way is priced per request rather than at one rate, which is why the table can
have several rows.

**Where the prices come from.** Three gateways carry a catalogue, in two different units:
`cheaperinference` quotes per million tokens, `kilocode` and `openrouter` per single token. All are
normalised to USD per token, and 942 models are known.

**The built-in provider's rates are by time of day.** DeepSeek bills peak and off-peak separately,
where off-peak is half price, and peak is 01:00–04:00 and 06:00–10:00 UTC Monday to Friday. The log
records a timestamp on every record, so the rate is chosen from when the request actually happened
rather than averaged. Those rates live in `prices.json` with their source and the date they were
read.

Chinese public holidays are excluded from peak in DeepSeek's terms and are not detectable here, so a
holiday inside a peak window is billed at the peak rate. That error runs toward over-stating, never
under.

**Why a row can still show `?`.** A model no source lists is reported with its token counts and an
unknown cost, never as zero — a plausible-looking number would be worse than an absent one. Add it to
`prices.json`:

```json
{
  "some-provider/some-model": { "input": 0.0000002, "output": 0.0000008, "cacheRead": 0.00000002 },
  "another-provider/tiered": {
    "offPeak": { "input": 0.00000015, "output": 0.0000006, "cacheRead": 0.000000003 },
    "peak":    { "input": 0.0000003,  "output": 0.0000012, "cacheRead": 0.000000006 }
  }
}
```

Values are USD per single token. `cacheRead` may be omitted, in which case the input price is used.
Keys beginning with `_` are treated as comments.

---

## Quick start on a new machine

```powershell
winget install --id OpenJS.NodeJS.LTS -e
npx @deepseek-ai/dsh web          # start once so ~/.dsh exists, then Ctrl+C
git clone https://github.com/studioxy/dsh-agent-presets "$env:USERPROFILE\.dsh\.agent-presets"
cd "$env:USERPROFILE\.dsh\.agent-presets"
.\bootstrap.ps1 -Check            # report only, changes nothing
.\bootstrap.ps1                   # do the whole setup
dsh web                           # then add API keys in the GUI
```

**Step by step, and why each one:**

1. **Node.js** is the only hard requirement. Everything else depends on which presets you want, and
   `bootstrap.ps1 -Check` names what is missing with the `winget` command for each.
2. **`dsh web` once** creates `~/.dsh`. Nothing else does. The profile directory itself is not created
   for you — the shipped profile names are `acp`, `web`, `headless`, `sdk` and `sdk-minimal`, and
   `--from-default-profile` refuses a shipped name as a custom target, so `dsh rescue
   --from-default-profile web` would make a profile called *rescue*. Step 5 creates it instead.
3. **Clone into `~/.dsh/.agent-presets`.** The location matters: the profile links to
   `../../.agent-presets/profile-bundles/<id>`, so a clone elsewhere needs those paths changed.
4. **`-Check` first.** It reports and touches nothing, including the profile.
5. **`bootstrap.ps1`** checks prerequisites, clones or updates, syncs the profile, runs
   `pnpm install`, reports missing credentials and broken paths, and runs the validators. It is
   idempotent and safe to re-run.
6. **API keys go in the GUI** (Settings → Models), never into a file here. The scripts do not write
   them and the repository does not carry them.
7. **Check the preset picker**: five cards under Custom, and a skill count in each. A preset with an
   empty skill list is the one failure that stays quiet — it looks healthy and mounts nothing.

---

## What is here

| path | what |
|---|---|
| `<preset>/skills/` | the skills, each a directory with `SKILL.md` and an `ATTRIBUTION.md` recording its source and pinned commit |
| `<preset>/agent.cordis.yml` | the composition, and the source the bundle patch was derived from |
| `profile-bundles/<preset>/` | the current-format bundle: `package.json` plus `cordis.patch.yml` |
| `profile/` | the DSH profile configuration: provider routes, model list, theme, default model |
| `bootstrap.ps1` | sets the whole thing up on a new machine |
| `sync-profile.mjs` | copies `profile/` into a DSH profile, dry run by default |
| `verify-presets.mjs` | checks skill counts, frontmatter, package resolution and profile wiring |
| `check-references.mjs` | checks that every file a skill tells an agent to read exists |
| `session-cost.mjs` | reports token usage and USD cost per session, from the durable log |
| `profile-bundles/validate.cjs` | validates the bundle patches against their source compositions |
| `REPRODUCE.md` | the long version: layout, pinned sources, MCP rows, and what has gone wrong |

`REPRODUCE.md` is worth reading before changing anything. It records why the presets look the way
they do, including the DSH update that silently orphaned every preset built the old way and the
several checks that reported success while measuring the wrong thing.

---

## Licensing

**Most of this is MIT.** The 92 skills break down as: **66 MIT**, **8 GPL-3.0**, **14 written here**,
**3 with no licence**, and **1 proprietary**. Every vendored skill carries an `ATTRIBUTION.md` naming
its source, upstream path, pinned commit and licence, so the provenance of any file is one click
away.

**Four skills are the ones to look at**, and their positions differ:

| skill | source | position |
|---|---|---|
| `docs/skills/pdf` | anthropics/skills | **proprietary with an explicit restriction.** Its `LICENSE.txt` is © 2025 Anthropic, all rights reserved, and forbids extracting or retaining copies outside Anthropic's Services, reproducing the materials, and creating derivative works |
| `docs/skills/codebase-to-course` | zarazhangrui/codebase-to-course | **no licence file.** GitHub reports `license: null` and the README says nothing, so the default is all rights reserved |
| `web/skills/react-best-practices` | vercel-labs/agent-skills | **no licence file anywhere in that repository** |
| `web/skills/web-design-guidelines` | vercel-labs/agent-skills | same |

They are here because the operator directed it, after each case was raised. **This repository is
public**, so that direction is recorded as a fact about what is published rather than as a caution.
Anyone reusing this material should reach their own conclusion about those four.

The 8 GPL-3.0 skills come from `data-goblin/power-bi-agentic-development`. GPL permits
redistribution, and the source — these files — is here.

**No credentials are in this repository, in its history, or in any file it writes.** Providers are
referenced by name through `apiKeyEnv` and resolved by the harness from its own credential store.
The full history was scanned before the first push.

---

## Requirements

`bootstrap.ps1 -Check` reports all of these with install commands. The short version:

**Always:** Node.js 20+, git, pnpm.
**By preset:** Chrome (`docs`), `serena` and `gopls` (`coding`), Python and `uv` (`docs`, `excel-pq`).
**Optional:** `gh` for pushing updates, `rtk` for token economy on shell output.
