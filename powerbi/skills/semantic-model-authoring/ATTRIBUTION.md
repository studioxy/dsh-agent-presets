# Attribution

This skill is third-party content, vendored **unmodified**.

- **Source:** https://github.com/microsoft/skills-for-fabric
- **Upstream path:** `plugins/fabric-skills/skills/semantic-model-authoring`
- **Pinned commit:** `65bfb5eb2c488cd03183df88f76ac3de65dcb910` (release v0.3.17, 2026-09-17)
- **Author:** Microsoft Corporation
- **License:** MIT — see `LICENSE.txt` in this directory.

Installed into the `powerbi` agent preset so that only Power BI sessions see it.

## Requirements this skill assumes

- **Power BI Modeling MCP** (`@microsoft/powerbi-modeling-mcp`) for its preferred path. It is not
  installed here, so the skill falls back to editing TMDL directly, which is the working path in
  this environment.
- **`az` CLI** for the Fabric REST operations it documents. Not installed here; those sections do
  not apply until the Azure CLI is present.
- The Microsoft tool names it cites (`view`, `glob`, `ask_user`) differ from this harness's
  (`read`, `glob`, `ask_user_question`). Read them as intent, not as literal tool names.
