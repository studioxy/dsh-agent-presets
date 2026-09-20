---
name: test-design
description: Design tests that fail for one reason and say what broke. Load this when writing tests, when a suite is slow, flaky or constantly needs updating, when deciding what to mock, or when coverage is high but bugs still reach production. Covers test levels, doubles, fixtures, naming and flakiness.
whenToUse: Writing or reviewing tests, diagnosing a flaky or slow suite, deciding what to mock, or judging whether existing tests are worth keeping.
---

# Designing tests

`test-driven-development` covers the rhythm: write the test first, watch it fail, make it pass.
This skill covers a different question — **what makes a test worth having.**

## A test earns its place by failing for exactly one reason

If three unrelated changes can each turn a test red, the test is not telling you what broke. It is
telling you that something broke, and then you go reading. That is a debugging session you paid
for twice.

The practical test: read the failure message alone, without opening the code. If it does not name
the behaviour and the expectation, rewrite the test — not the message.

## Test behaviour, not implementation

The distinction that matters: would this test still pass if I refactored the code without changing
what it does?

- **Behaviour** — "an expired token is rejected", "the total includes tax", "a duplicate key
  returns the existing record".
- **Implementation** — "`validate()` is called once", "`_cache` has three entries", "the second
  argument to the repository is `True`".

Tests coupled to implementation are why a suite "constantly needs updating". The code did not
change behaviour; the test was asserting the shape of the code.

**Do not assert on call counts or internal state unless that is genuinely the contract.** If you
need to know that a side effect happened, assert on the effect, not on the call.

## Choose the cheapest level that answers the question

| level | use for | cost |
|---|---|---|
| unit | pure logic, branching, edge cases, parsing, calculation | milliseconds |
| integration | the boundary is the thing under test: database, filesystem, HTTP client, serialisation | seconds |
| end to end | the critical paths a user depends on, and wiring you cannot otherwise verify | minutes |

Push each check as far down as it can go. Bugs in arithmetic do not need a browser. But do not
pretend a unit test proves an integration works — mocks agreeing with each other is the most
common way a green suite ships a broken feature.

**Test the boundaries for real when the boundary is the risk** — serialisation formats, SQL,
timezone handling, encoding. Those are exactly where a fake is most likely to lie.

## Mocking

Mock at the edges of your system, not inside it.

- **Mock**: network, clock, randomness, filesystem, third-party services you do not control.
- **Do not mock**: your own classes. If a unit test needs three of your own collaborators faked,
  the unit is too large — split it, or test at a level where the real objects can run.
- **Prefer a fake to a mock** when the collaborator is yours: an in-memory repository that
  behaves like the real one survives refactoring; a set of call expectations does not.
- **Never let a mock define the contract you are testing.** If the test asserts what you told the
  mock to return, it asserts nothing.

## Fixtures and test data

- Build the smallest object that satisfies the test. A 40-field factory with sensible defaults
  beats 40 lines of setup, and hides which fields matter.
- Make the values that matter **visible in the test**, not buried in a shared fixture. A reader
  should see why this case is different.
- Do not share mutable fixtures across tests. Order-dependent suites are the second most common
  cause of flakiness.
- Freeze time explicitly. A test that passes all year and fails on 31 December is worse than one
  that always fails, because you will not believe the failure.

## Flakiness

A flaky test is a broken test. Do not retry it, do not skip it, do not "re-run and see".

The usual causes, in order of frequency:

1. **Shared state** — a database row, a file, an environment variable, a module-level cache left
   behind by another test.
2. **Time** — sleeping instead of waiting for a condition; asserting on a timestamp; date-dependent
   logic.
3. **Order** — relying on tests running in a particular sequence, or on a dictionary/set order.
4. **Concurrency** — genuine races in the code under test. These are real bugs and the test is
   doing its job.
5. **External services** — a real network call in a unit test.

Wait for conditions, never for durations. If you cannot avoid a sleep, the test is not finished.

## What not to test

- Generated code, or third-party library behaviour. Their tests are not your job.
- Trivial accessors and pure delegation with no logic.
- Private functions directly. If it needs its own test, the design is telling you something —
  usually that it wants to be extracted.

## Coverage

Coverage tells you what the suite *executed*, not what it *verified*. A line can be covered by a
test that asserts nothing.

Use it to find untested critical paths — money, permissions, data deletion, retry and error
handling — and ignore it as a target. Chasing a percentage produces tests written to touch lines.

## Naming

A test name should read as a sentence about behaviour, and the failure should be understandable
without the source.

- `rejectsExpiredToken` — good.
- `test1`, `testValidate`, `worksCorrectly` — the failure message is now the whole story, and it
  is not enough.
- When a test has several cases, name them by the case: `rejectsExpiredToken`, `acceptsTokenOneSecondBeforeExpiry`.

## When a bug is fixed

Write the failing test first, watch it fail for the right reason, then fix. A bug fix without a
test that would have caught it is a bug that will come back.

If you cannot write a test that reproduces it, say so plainly. That is important information about
the code, not a reason to skip the fix quietly.
