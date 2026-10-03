# Attribution

- **Source:** https://github.com/AgriciDaniel/claude-seo
- **Upstream path:** `skills/seo-sitemap/`
- **Pinned commit:** `ff87fcee0734845d3f59128c8c905799ee2298da`
- **Author:** AgriciDaniel
- **License:** MIT (repository LICENSE; this skill's LICENSE.txt points to it)

Vendored whole into the `web` agent preset.

## Why this one and not `seo`

The repository is an SEO agency workflow. Its `seo` skill is an orchestrator naming thirty sibling
skills, with references about backlinks, local search, Google Maps and Business Profile, and it
names several skills this repository does not contain. That is the wrong shape for a preset whose
job is building a site. This skill concerns a specific part of shipping one.
