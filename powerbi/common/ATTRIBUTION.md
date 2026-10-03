# Attribution

- **Source:** https://github.com/microsoft/skills-for-fabric
- **Upstream path:** `common/` (repository root)
- **Pinned commit:** `65bfb5eb2c488cd03183df88f76ac3de65dcb910`
- **License:** MIT

## Why this lives outside skills/

Two skills address these as `../../common/<name>.md`. From `skills/<name>/SKILL.md` that resolves
to the preset root, so one shared copy satisfies both and no SKILL.md is modified.

Upstream's `common/` holds sixteen files covering Fabric services this preset does not use - Spark,
Eventstream, SQLDB, SQLDW, Dataflows. Only the three that a skill here actually names are taken.
