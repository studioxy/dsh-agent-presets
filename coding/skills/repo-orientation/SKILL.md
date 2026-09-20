---
name: repo-orientation
description: Orient in an unfamiliar repository before changing code. Load this at the start of work in a codebase you have not worked in yet, when asked to add a feature, fix a bug, or refactor in a project whose structure, build system or test setup is not yet known.
whenToUse: Starting work in an unfamiliar repository, or any change where the build and test commands are not yet established.
---

# Orienting before changing code

## Read first, and in this order

1. `AGENTS.md`, `CLAUDE.md`, or equivalent - the repository's own instructions for agents. These
   override your defaults and are the cheapest thing to read.
2. `README` - what this is, and the documented way to build and run it.
3. `CONTRIBUTING`, `Makefile`, `justfile`, `package.json` scripts, `pyproject.toml`, `go.mod`,
   `pom.xml`, `build.gradle` - the real commands, as opposed to the documented ones.
4. CI configuration - what actually runs on a change. This is the ground truth for "does it work".

## Establish a baseline before touching anything

Run the build and the test suite **as they are**, and record what passes and what fails. Without
this you cannot tell your breakage from the pre-existing kind, and you will spend the rest of the
task guessing.

If the suite does not run, say so before changing code. A task that starts by silently disabling
tests is worse than one that starts by reporting the suite is broken.

## Find the code path, then read it whole

- Locate the entry point for the behaviour you are changing, not just the file that looks relevant.
- Read the whole function or module before editing it. Half-read functions are where new bugs go.
- Search for existing callers of anything you intend to change. Grep the symbol, do not assume.
- Check whether the thing you are about to write already exists under another name.

## Change as little as the task needs

- Match the surrounding style, even where you would write it differently. A refactor smuggled into
  a bug fix makes the fix unreviewable.
- Do not reformat files you touched for another reason. It hides the real change in a diff.
- Do not add a dependency for something the project already does. Check first.
- Do not introduce a new linter, formatter or test framework unless asked.

## Verify with the project's own commands

Run the project's build, tests and linter - the same ones CI runs, not a substitute you prefer.
For a language with a fast targeted runner, run the focused test first and the full suite before
handing over.

State plainly what you ran and what the result was. "Tests pass" without the command is not a
verification, it is a claim.

## Before handing over

- `git status` - confirm you changed only what you meant to.
- `git diff` - read your own diff as a reviewer would. This catches most mistakes.
- Check for leftover debugging output, commented-out code, and temporary files.
- If you could not verify something, say which part and why, rather than implying the whole
  change is proven.

## Language notes

These are the differences that actually bite; the rest is standard.

- **Python** - virtual environments vary per project (`venv`, `uv`, `poetry`, `conda`). Find which
  one is in use before installing anything. Do not mix a global interpreter with a project venv.
- **TypeScript / Node** - the package manager matters (`npm`, `pnpm`, `yarn`); the lockfile tells
  you which. Run the type check separately from the tests; both fail differently.
- **Go** - the module path and the build tags decide what compiles. `go vet` catches things the
  compiler does not. Vendor directories mean dependencies are committed.
- **Java** - the build tool owns the classpath. Maven and Gradle have different lifecycle names
  for the same step, and a stale local repository explains most inexplicable failures.

---

This skill is the preset's own, not vendored from a collection. It is the counterpart to the
third-party skills installed alongside it: those cover *how* to do engineering work, this one
covers *where to look first* in a repository you have not seen.
