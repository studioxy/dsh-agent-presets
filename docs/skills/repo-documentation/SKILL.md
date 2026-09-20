---
name: repo-documentation
description: Generate documentation from a repository as HTML or PDF, with diagrams, animation and interactive charts. Load this when asked to document a codebase, produce a guide or walkthrough from source, build a system or architecture overview, or turn code and configuration into a readable deliverable for people who will not read the code.
whenToUse: Documenting a repository, writing a technical guide from source, producing an HTML or PDF deliverable with diagrams or charts.
---

# Documentation from a repository

This skill covers the **artefact**: a self-contained, print-ready deliverable. What the document
should *say*, to whom, and in what order is `document-outline`'s job. That skill decides the
content; this one decides how it is built. Load both when starting from a repository.

## The build sequence

1. **Survey the repository first.** Entry points, build and test commands, configuration, and any
   existing docs. Read `AGENTS.md`, `README`, `CONTRIBUTING` and the CI config before anything —
   they state the conventions you are about to restate.
2. **Settle the outline before generating.** See `document-outline`. A wrong structure costs far
   more to fix after twenty pages exist than before.
3. **Build one section end to end**, render it, then continue. Do not generate the whole document
   and only then look at it.

## Artefacts must open offline

This is the constraint that decides most technical choices. A guide that needs a CDN is broken on
a train, behind a corporate proxy, and inside a sealed environment.

- **No external requests.** No CDN script tags, no Google Fonts, no remote images. Inline the CSS
  and any JavaScript, and use system font stacks.
- **Diagrams**: generate SVG and inline it. Mermaid or Graphviz are fine as *build-time* tools —
  compile to SVG, paste the SVG in. Do not ship a runtime renderer that fetches its library.
- **Charts**: hand-authored SVG or canvas is usually smaller and always more predictable than a
  bundled charting library. Bundle a library only when the interaction genuinely needs it, and
  then say in the document how large the file became.

## Diagrams

- Prefer **one idea per diagram**. A diagram that needs a legend longer than the diagram has failed.
- Label edges, not just nodes. An unlabelled arrow between two boxes carries no information.
- Keep text horizontal where you can; rotated labels are the most common readability defect.
- Leave whitespace. It is cheaper than a caption explaining what overlaps what.
- For sequence and flow, order matters more than layout: make the reader's eye travel one way.

## Animation

Animation should reveal structure, not decorate.

- Use it to show **sequence** (a request path lighting up), **change** (before and after), or
  **focus** (one part of a large diagram at a time).
- Respect `prefers-reduced-motion`. Everything animated must be legible when still.
- Never animate something the reader must read while it moves. Text fades or appears; it does not
  slide across the screen.

## PDF

- Write a real `@media print` stylesheet. Screen CSS alone produces a PDF with orphaned headings
  and split code blocks.
- `break-inside: avoid` on figures, tables and code blocks; `break-after: avoid` on headings.
- Avoid fixed and sticky positioning in print — they collapse in ways that are hard to predict.
- Check page numbers and that links survive as links, not as dead coloured text.
- Verify by opening the PDF, not by trusting the converter's exit code.

## Accessibility and structure

- One `<h1>`, then headings in order, no skipped levels. Screen readers navigate by this.
- Every diagram needs a text alternative that carries the same information, not "diagram of the
  system".
- Check contrast for body text and for any text placed on a coloured fill.
- Tables: real `<th>` with `scope`, and a caption that says what one row is.

## Verify the render

Artefact-level checks. Whether the document *reads* — does the first screen land, is the argument
clear, is anything missing — belongs to `document-outline`, and is judged by reading rather than
by measuring.

- Screenshot at a desktop width and at a narrow one. Check that diagrams stay legible at that size
  and that nothing overlaps.
- Open the console. Interactive elements fail silently; a chart that throws looks like a chart
  that simply has no data.
- Serve over HTTP before running any accessibility audit. Most tools reject `file://`, and the
  failure reads like a broken tool rather than a wrong URL.
- For PDF, render to images and inspect at least the first page, one page containing a diagram,
  and the last page.
