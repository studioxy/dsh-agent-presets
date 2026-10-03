#!/usr/bin/env node
// Check that every file path the installed skills tell an agent to read actually exists.
//
//   node check-references.mjs
//
// This is the check that caught five addyosmani skills pointing at a repository-level references/
// directory that a per-skill copy never takes. Nothing fails loudly when a reference is missing:
// a skill naming a file that is not there reads exactly like one naming a file that is.
//
// Two distinctions matter, and the first version of this script got both wrong.
//
//   Hard   a literal file path the skill tells the agent to READ. If it does not resolve, the
//          skill is broken. These are reported and fail the run.
//   Soft   a named sibling SKILL.md the skill declines to cover, usually under "When Not To Use".
//          The skill is saying the topic is not its job; the absence does not break it.
//
// It also ignores a path that merely ends in references/ but belongs to a sibling skill, such as
// ../hugo-theme/references/x.md.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = import.meta.dirname
const PRESETS = readdirSync(REPO).filter((d) => {
  const sd = join(REPO, d, 'skills')
  return statSync(join(REPO, d)).isDirectory() && existsSync(sd)
})

let hard = 0
let soft = 0
let checked = 0

for (const p of PRESETS) {
  const skillsDir = join(REPO, p, 'skills')
  const skills = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory() && existsSync(join(skillsDir, d, 'SKILL.md')))

  for (const s of skills) {
    const dir = join(skillsDir, s)
    const t = readFileSync(join(dir, 'SKILL.md'), 'utf8')

    const badFiles = new Set()
    const badSkills = new Set()

    for (const m of t.matchAll(/((?:\.\.\/)+)([A-Za-z0-9._-]+)\/([A-Za-z0-9._\/-]+\.(?:md|py|json|tsx?|js|css|html))/g)) {
      const [, ups, first, rest] = m
      checked++

      // ../<name>/... where <name> is not a skill in this preset means the whole sibling skill is
      // absent. The skill is declining coverage and naming where the topic lives, which is a note
      // rather than a broken read. Only ../<name>/ inside a sibling we DO hold is a hard read.
      const siblingHeld = ups === '../' && existsSync(join(skillsDir, first, 'SKILL.md'))
      if (ups === '../' && !siblingHeld) {
        badSkills.add(first)
        continue
      }

      if (!existsSync(resolve(dir, `${ups}${first}/${rest}`))) badFiles.add(`${ups}${first}/${rest}`)
    }

    // a direct ../<name>/SKILL.md reference, caught above only when it ends in a known extension
    for (const m of t.matchAll(/\.\.\/([a-z0-9-]+)\/SKILL\.md/g)) {
      if (!existsSync(join(skillsDir, m[1], 'SKILL.md'))) badSkills.add(m[1])
    }

    if (badFiles.size) {
      hard += badFiles.size
      console.log(`HARD ${p}/${s}`)
      for (const f of badFiles) console.log(`   ${f}`)
    }
    if (badSkills.size) {
      soft += badSkills.size
      console.log(`soft ${p}/${s}: names ${[...badSkills].join(', ')}`)
    }
  }
}

console.log(`\nchecked ${checked} file references across ${PRESETS.length} presets`)
console.log(`hard (a file the skill reads): ${hard}`)
console.log(`soft (a sibling skill it declines to cover): ${soft}`)
console.log(hard === 0 ? '\nALL REFERENCES RESOLVE' : `\n${hard} UNRESOLVED FILE REFERENCE(S)`)
process.exit(hard === 0 ? 0 : 1)
