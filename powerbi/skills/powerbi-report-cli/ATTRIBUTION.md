# Attribution

This skill is third-party content, vendored **unmodified**.

- **Source:** https://github.com/microsoft/skills-for-fabric
- **Upstream path:** `plugins/powerbi-authoring/skills/powerbi-report-cli`
- **Pinned commit:** `65bfb5eb2c488cd03183df88f76ac3de65dcb910` (release v0.3.17, 2026-09-17)
- **Author:** Microsoft Corporation
- **License:** MIT — see `LICENSE.txt` in this directory.

Installed into the `powerbi` agent preset so that only Power BI sessions see it.

## Requirements this skill assumes

- The **`powerbi-report-author`** CLI, which is installed globally here as
  `@microsoft/powerbi-report-authoring-cli` v0.1.4. The skill calls it by that name, so the
  commands in it work as written.
- **`powerbi-desktop`** (Desktop Bridge CLI) for reload and page screenshots. Also installed.
- **`az` CLI** for the Fabric REST operations it documents. Not installed here; those sections do
  not apply until the Azure CLI is present.
- Note that this skill is named `powerbi-report-cli` upstream and was previously referenced as
  `powerbi-report-authoring` in the plugin manifest. The directory name here matches the SKILL.md
  `name` field, which is what this harness requires.
