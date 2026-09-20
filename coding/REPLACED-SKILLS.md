# Skills removed as duplicates

Four collections (superpowers, ponytail, addyosmani/agent-skills, mattpocock/skills)
were installed into this preset and overlap heavily. The rule applied: when two or more skills do
the same job, keep the most complete or most authoritative one and remove the rest. Skills that
stand alone were left untouched. Names are the frontmatter `name`, not the directory.

| removed | kept instead |
|---|---|
| `tdd` | `test-driven-development` |
| `debugging-and-error-recovery` | `systematic-debugging` |
| `diagnosing-bugs` | `systematic-debugging` |
| `code-review` | `code-review-and-quality` |
| `ponytail-review` | `code-review-and-quality` |
| `requesting-code-review` | `code-review-and-quality` |
| `planning-and-task-breakdown` | `writing-plans` |
| `writing-for-agents` | `writing-skills` |
| `using-agent-skills` | `using-superpowers` |
| `ask-matt` | `using-superpowers` |
| `idea-refine` | `brainstorming` |
| `grilling` | `interview-me` |
| `grill-me` | `interview-me` |
| `grill-with-docs` | `interview-me` |
| `handoff` | `context-engineering` |
| `claude-handoff` | `context-engineering` |
| `resolving-merge-conflicts` | `git-workflow-and-versioning` |
| `git-guardrails-claude-code` | `git-workflow-and-versioning` |
| `using-git-worktrees` | `git-workflow-and-versioning` |
| `implement-spec` | `spec-driven-development` |
| `implement` | `spec-driven-development` |
| `to-spec` | `spec-driven-development` |
| `research` | `source-driven-development` |
| `setup-pre-commit` | `ci-cd-and-automation` |
| `finishing-a-development-branch` | `shipping-and-launch` |
| `codebase-design` | `api-and-interface-design` |
| `improve-codebase-architecture` | `api-and-interface-design` |
| `setup-ts-deep-modules` | `api-and-interface-design` |
| `dispatching-parallel-agents` | `subagent-driven-development` |

Restore any of them by re-running the installer with the removal list trimmed.
