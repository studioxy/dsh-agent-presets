# Attribution

This skill is third-party content, vendored with the local modifications listed below.

- **Source:** https://github.com/data-goblin/power-bi-agentic-development
- **Upstream path:** `plugins/custom-visuals/skills/deneb-visuals`
- **Pinned commit:** `f1a514cc9c572bd07312e57c5ea57fbd6d1a1940` (2026-09-19)
- **Author:** Kurt Buhler — Data Goblins, part of Tabular Editor
- **License:** GPL-3.0 — see the upstream repository for the full text.

Vendored because the upstream states: *"If you copy these skills - manually or by using an agent
to rewrite them - you must include attribution and a link to this original project."*

## Local modifications (2026-09-20)

- **`SKILL.md`** — replaced the `pbir`-CLI tool policy with the local policy in `LOCAL-TOOLING.md`,
  because the `pbir` CLI (pbir.tools) carries a Custom-Non-Commercial license and is deliberately
  not installed here. Rewrote the create / inject / validate workflow steps to match the tools that
  are actually present, and replaced the `deneb-reviewer` agent step with an inline review step.
  **Unchanged:** provider policy, visual identity facts, spec authoring rules, escaping rules,
  theme integration table, interactivity guidance, runtime fields, best practices, references.
- **`LOCAL-TOOLING.md`** — new file, written locally: verified replacement commands and the
  empirically confirmed encoding rules.

Upstream is under active weekly development and versions 26.26–26.38 are a deliberate breaking
transition, so re-vendoring should diff against this pinned commit rather than pull `main`.
