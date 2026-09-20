# Attribution

- **Source:** https://github.com/data-goblin/power-bi-agentic-development
- **Upstream path:** `plugins/pbip/skills/pbip`
- **Pinned commit:** `f1a514cc9c572bd07312e57c5ea57fbd6d1a1940`
- **Author:** data-goblin
- **License:** GPL-3.0

Vendored unmodified into the `powerbi` agent preset.

## Why this and not dax

pbip covers the project wrapper - PBIX versus PBIP, project structure, page folder naming,
SharedResources path resolution, forking - which pbir-format does not touch. The sibling dax skill
was rejected because semantic-model-authoring already ships dax-guidelines.md, dax-perf-decision-
guide.md and dax-perf-patterns.md, 73 KB of DAX material, plus a workflow for optimising it.
