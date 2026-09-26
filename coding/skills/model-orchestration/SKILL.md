---
name: model-orchestration
description: Decide whether a task justifies splitting work across several models - an orchestrator, workers and an evaluator - and run that split through the workflow tool. Load when a task is a judgement rather than a fact, when a wrong answer is expensive, or when the same analysis has to be applied to many independent items. Explicitly not for ordinary implementation, questions or anything a command can verify.
whenToUse: Audits, reviews, architecture decisions, comparing alternatives, or the same analysis fanned across many independent units.
---

# When several models earn their cost

Routes are configured: `cheaperinference` and `kilocode` in settings, with Qwen 3.8 for planning and
evaluation and DeepSeek V4 Flash for volume. Availability is not a reason to use them. Every role
multiplies cost by the number of calls, which is the opposite of what the rest of this setup does.

## The one test that decides it

**Can the result be verified by running something? If yes, run it. Do not orchestrate.**

A test, a query, a validator, a rendered screenshot — any of those settles the question with
evidence. A second model's opinion is weaker than a passing test and costs more. Most work falls
here and needs no orchestration at all.

Orchestration is for the residue: work whose correctness **cannot** be established by a command,
where the answer is a judgement and being wrong is expensive.

## Use the split when

- **The output is a judgement, not a fact.** An audit, a review, a risk assessment, a verdict. No
  command returns the answer, so a second model reading the first model's claim is the only
  independent check available.
- **Being wrong is expensive and the error would be silent.** A model decision that nothing will
  catch, or an audit that misses the one thing it was for.
- **The same analysis applies to many independent units.** Ten files, five models, eight candidate
  approaches. Workers in parallel are genuinely faster, and the evaluator compares them.
- **Alternatives have to be compared, not just chosen.** Generate more than one and adjudicate. A
  single answer cannot be compared to anything.

## Do not use the split when

- **A command decides it.** Run the command.
- **Writing, editing or refactoring code.** The compiler and the tests are the evaluator, and they
  are cheaper and correct.
- **Answering a question or explaining something.** There is nothing to verify.
- **The task is small.** Three roles to produce one paragraph is theatre.
- **You would be the evaluator anyway.** If the orchestrator simply accepts its own workers' output,
  the evaluator role is decoration. It has to be able to say no.

## The pattern

```js
const plan = await agent(promptPlan, {
  provider: 'cheaperinference', model: 'qwen-3-8-max', label: 'orchestrator' })

const findings = await parallel(units.map(u => () =>
  agent(promptUnit(u), {
    provider: 'cheaperinference', model: 'deepseek-v4-flash', label: u })))

const verdict = await agent(promptVerdict(plan, findings), {
  provider: 'cheaperinference', model: 'qwen-3-8-27b', label: 'evaluator' })

return { plan, findings, verdict }
```

Every role needs `provider` and `model` stated. **A subagent inherits the parent's route by
default**, so omitting them silently runs every role on the session model and produces no
independence at all — cost without the benefit, which is the worst outcome available.

Both routes carry all three roles, so either gateway can serve the whole pattern. Pick one rather
than mixing, unless mixing is the point.

## Worth knowing before relying on it

- **`workflow` runs in the foreground.** The call returns when the whole script finishes, so a long
  orchestration blocks the turn. There is no way to start it and come back.
- **`agent()` resolves `null` when a child fails and discards the reason.** Check for null in the
  script and say which role failed, or you will report a partial result as a complete one.
- **Reasoning models need output room.** Qwen 3.8 and DeepSeek V4 all report reasoning capability.
  At `max_tokens: 24` the Qwen models returned empty content having spent the budget thinking, which
  reads as a broken route rather than a budget that was too small. The limits in settings are the
  values the gateways declare, so this is already handled — do not lower them.
- **Independence is the whole product.** If the evaluator sees the same prompt and the same
  instructions as the worker, it will agree. Give it the claim and ask it to falsify, not to confirm.

## Before reporting the result

Say which roles ran and on which models, and whether any returned null. An orchestration whose
evaluator silently failed is a single model's opinion wearing a second opinion's clothes, and the
report has to make that visible rather than leave it implied.
