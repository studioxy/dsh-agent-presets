# Attribution

- **Source:** https://github.com/AgriciDaniel/claude-seo
- **Upstream path:** `skills/seo/references/schema-types.md`
- **Pinned commit:** `ff87fcee0734845d3f59128c8c905799ee2298da`
- **Author:** AgriciDaniel
- **License:** MIT

## Why this directory exists without a SKILL.md

The skill provider recognises `<root>/<name>/SKILL.md`, so a directory here with no SKILL.md is not
a skill and is never offered to the model. It exists only so that the path`seo-schema` names -
`../seo/references/schema-types.md` - resolves.

The rest of the `seo` skill is deliberately absent. It is an agency orchestrator that dispatches to
thirty sibling skills and names several this repository does not contain, so installing it would
create more dangling pointers than it resolves. Only the one file another installed skill actually
reads was taken.
