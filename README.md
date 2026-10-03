# DSH agent presets

Five task-scoped agent presets for [DeepSeek Harness](https://github.com/deepseek-ai), with every
skill vendored at a pinned commit, the profile configuration that routes them, and the scripts that
put the whole thing on a machine.

| preset | skills | MCP | for |
|---|---|---|---|
| `powerbi` | 12 | 1 | Power BI PBIP: report and semantic model, TMDL, PBIR, DAX, Deneb visuals |
| `docs` | 12 | 1 | documentation from a repository: HTML and PDF with diagrams and charts |
| `coding` | 39 | 2 | software engineering in Python, TypeScript and Go |
| `web` | 25 | 2 | web applications: frontend, APIs, accessibility, React |
| `excel-pq` | 4 | 3 | Excel and Power Query, SAP export intake |

A sixth, `standard`, ships with DSH and is untouched.

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
2. **`dsh web` once** creates `~/.dsh`. Nothing else does, and the profile directory is not created
   for you later.
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
