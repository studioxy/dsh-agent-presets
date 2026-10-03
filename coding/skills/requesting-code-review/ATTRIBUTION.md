# Attribution

- **Source:** https://github.com/obra/superpowers
- **Upstream path:** `skills/requesting-code-review/`
- **Pinned commit:** `5bf4e78011075bcfc0dc295f0724994cd123ee71`
- **License:** MIT

## Why it was added later

It was not in the original selection, but two installed skills depend on its
`code-reviewer.md` prompt template: `subagent-driven-development` dispatches a reviewer through it in
three places, one of them a flowchart node, and `executing-plans` names it as part of its workflow.
A missing prompt template is the same class of defect as a missing checklist - the skill tells the
agent to read a file that is not there, and nothing fails until it does.
