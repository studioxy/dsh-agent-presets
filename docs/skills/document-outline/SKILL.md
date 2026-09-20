---
name: document-outline
description: Decide what a document should contain and in what order, before writing any of it. Load this when turning a repository, codebase or system into a guide, walkthrough or explainer, when a document reads as a list of facts with no argument, or when you need to judge what to cut. Covers audience, section archetypes, ordering and the verification loop.
whenToUse: Planning a document derived from a repo or system, restructuring one that reads badly, or deciding what to leave out.
---

# Deciding what the document says

This is the layer above `repo-documentation`. That skill covers the **artefact** — self-contained
output, print stylesheets, diagram hygiene, accessibility. This one covers the **editorial**
question underneath it: what belongs in the document, and in what order. Design skills make a
document look considered. None of them makes it say something.

## Answer two questions before choosing any structure

**Who reads this, and what do they do afterwards?** Everything else follows from this.

- A person evaluating whether to trust the system needs the numbers and the failure modes first.
- A person about to change the code needs the model and the entry points first.
- A person debugging at 3am needs the symptoms and the checks first.

One document rarely serves all three. Pick one, and say at the top which one it is.

If you cannot name a reader, stop and ask. A document for nobody becomes a list of everything,
which is the same as a document for nothing.

## Find the three to seven things that are true and not obvious

This is the work. A document is not a summary of the repository; it is the small set of claims
worth making about it.

Go looking for these specifically:

- **Surprises.** What is counter-intuitive here? What did you expect that turned out false?
- **Consequences.** What follows from a decision that a reader would not predict?
- **Constraints.** What cannot be changed, and why? These explain most of the odd-looking code.
- **Numbers.** What is the size, the cost, the failure rate? Quantities orient a reader faster
  than any amount of prose.
- **Disagreements with the code.** Where does the repository do something its own documentation
  says it does not?

Test each candidate: **if a competent reader would guess this correctly, cut it.** "This project
uses Git" is true and worthless. "The date tables were removed because nothing referenced them"
is true and worth the sentence.

Aim for a number you can hold in your head. If you have twenty claims, you have a reference
manual, not a document — split it.

## Order by the reader's journey, not the code's layout

The repository is organised for building. A document is organised for understanding, and those
are different shapes. Do not mirror the directory tree; it is the single most common way to
produce a document nobody finishes.

An order that survives most subjects:

1. **The claim.** One sentence: what this is and why it matters.
2. **The numbers.** The handful of quantities that orient a reader. Before any prose, because
   numbers are cheap to read and frame everything after.
3. **The model.** How the parts relate. A diagram earns its place here and almost nowhere else.
4. **What was found or decided.** The surprises and consequences from above. This is usually the
   section the document exists for.
5. **How it is organised.** The structure a reader needs in order to go further on their own.
6. **What is unresolved.** Open questions, known gaps, things deliberately not done.

Adjust the middle. Keep the first and last: a document that opens without a claim and closes
without its gaps leaves the reader exactly where they started.

## Section archetypes, and what each is for

| section | earns its place when | fails when |
|---|---|---|
| Numbers panel | quantities orient faster than prose | it repeats what the headings say |
| Diagram | the **relationships** are the point | it restates a list you already wrote |
| Findings table | there is a severity or a decision per row | rows have no consequence |
| Narrative | the *why* needs connective tissue | it narrates the code, line by line |
| Reference list | a reader will return to look things up | it is the whole document |

**A table with a severity column is a claim that some things matter more.** If every row would be
the same severity, use a list — the column is lying.

**A diagram that restates a list is decoration.** Before drawing one, ask what a reader would
misunderstand from prose alone. If the answer is "nothing", skip the diagram. Most architecture
pictures answer a question nobody asked.

## Cut these without hesitation

- **Anything the code states more clearly.** Do not paraphrase a function into English.
- **Exhaustive inventories.** Every column, every endpoint, every config key. Point at where they
  live instead.
- **Architecture that is not in the repository.** Do not describe the intended design. If the
  real structure is messy, the document says so — that is the useful part.
- **Tutorials people will not follow.** If the setup is three commands, three commands is the
  whole section.
- **Hedges with no decision behind them.** "It depends" is only worth writing when followed by
  what it depends on.

## Verify by rendering, not by rereading

Do not report a document as finished from its source. Render it, then look at it.

The loop that works:

1. **Render and screenshot at the target width**, then at a narrow one. Read the screenshot: does
   the first screen say what this is? Does anything overlap? Are the diagrams legible at that
   size?
2. **Read the console.** Interactive elements fail silently; a chart that throws looks like a
   chart that has no data.
3. **Run an accessibility audit** if you have one. It catches what you will not: contrast below
   the threshold, missing landmarks, headings out of order.
4. **Read your own document top to bottom** as a reader would, without opening the source.

Serve the file over HTTP before auditing. Most audit tools reject `file://` URLs, and the failure
looks like a broken tool rather than a wrong URL.

## The shape of a good first screen

A reader decides in about five seconds whether to keep going. The first screen should contain:

- what this is, in one line that does not start with the project name;
- who it is for;
- the single most important number or claim;
- a reason to scroll.

If the first screen is a title, a table of contents and a logo, the document has not started.

## Worked example

A one-page record of a Power BI model, built to this shape: claim and reader, a six-number panel,
a data-flow diagram, a findings table with a severity column, the organisational structure, and a
note on what remains unresolved. The diagram survived because the *routing* between the parts was
genuinely hard to follow in prose — including a table that feeds the report header rather than the
fact table. The audit then found three defects the prose could not: contrast at 3.8:1, a missing
`main` landmark and a missing description.
