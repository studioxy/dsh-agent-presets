# Attribution

- **Source:** https://github.com/addyosmani/agent-skills
- **Upstream path:** `references/` (repository root)
- **Pinned commit:** `c004a74784a08295d52749b04cda634125b9a581`
- **License:** MIT

## Why this directory exists outside skills/

The skills in this preset address these checklists as `../../references/<name>.md`. From
`skills/<name>/SKILL.md` that resolves to the preset root, mirroring the layout the upstream
assumes. Copying per skill would have required editing every SKILL.md; placing one shared copy at
the preset root keeps all of them unmodified and correct.

This was missing at first: five skills pointed at files that were not installed, and the failure is
silent, because a skill that names an absent reference reads exactly like one that does not.
