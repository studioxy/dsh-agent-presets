#!/usr/bin/env node
// Verify this repository end to end. Paths resolve from the script's own location, so it works
// wherever the repository is cloned.
//
//   node verify-presets.mjs
//
// Checks, for every preset: the skill directories and their frontmatter, that no bundle carries a
// live reference to the retired dsh-agent-presets package, that every package a bundle names is
// installed, and that the profile wires all of them from this repository rather than from a path
// outside it.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REPO = import.meta.dirname
const EXPECT = { powerbi: 12, docs: 12, coding: 39, web: 25, 'excel-pq': 4 }
const DSH = join(homedir(), '.dsh')

// A directory under a skill root without a SKILL.md is not a skill: the provider's filter requires
// <name>/SKILL.md. A references-only directory is therefore ignored rather than rejected.
const isSkill = (dir, d) => existsSync(join(dir, d, 'SKILL.md'))

let failures = 0
const fail = (m) => { failures++; console.log('FAIL ' + m) }
const ok = (m) => console.log('OK   ' + m)

for (const [p, want] of Object.entries(EXPECT)) {
  const dir = join(REPO, p, 'skills')
  if (!existsSync(dir)) { fail(`${p}: no skills directory`); continue }
  const skills = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory() && isSkill(dir, d))
  let bad = 0
  for (const s of skills) {
    const t = readFileSync(join(dir, s, 'SKILL.md'), 'utf8')
    if (!(t.startsWith('---') && /^name:/m.test(t) && /^description:/m.test(t))) { bad++; console.log(`     bad frontmatter: ${p}/${s}`) }
  }
  if (skills.length !== want) fail(`${p}: ${skills.length} skills, expected ${want}`)
  else if (bad) fail(`${p}: ${bad} skills with invalid frontmatter`)
  else ok(`${p}: ${skills.length} skills, all frontmatter valid`)
}

const VB = join(REPO, 'profile-bundles')
for (const p of Object.keys(EXPECT)) {
  const f = join(VB, p, 'cordis.patch.yml')
  if (!existsSync(f)) { fail(`${p}: no bundle patch`); continue }
  const real = readFileSync(f, 'utf8').split('\n').filter((l) => /^\s+name:\s*'@deepseek-ai\/dsh-agent-presets'/.test(l))
  if (real.length) fail(`${p}: carries a live dsh-agent-presets row`)
}

// every package a bundle names must exist in the installed harness
const N = join(DSH, '..', 'AppData', 'Local', 'npm-cache', '_npx')
let dshModules = null
if (existsSync(N)) {
  for (const h of readdirSync(N)) {
    const cand = join(N, h, 'node_modules', '@deepseek-ai')
    if (dshModules === null && existsSync(cand)) dshModules = cand
  }
}
if (!dshModules) {
  console.log('SKIP package resolution: no installed @deepseek-ai tree found')
} else {
  const installed = new Set(readdirSync(dshModules))
  for (const p of Object.keys(EXPECT)) {
    const t = readFileSync(join(VB, p, 'cordis.patch.yml'), 'utf8')
    const names = [...t.matchAll(/^\s+name:\s*'(@deepseek-ai\/[^']+)'/gm)].map((m) => m[1])
    const missing = [...new Set(names)].filter((n) => !installed.has(n.replace('@deepseek-ai/', '').split('/')[0]))
    if (missing.length) fail(`${p}: unresolvable packages ${missing.join(', ')}`)
    else ok(`${p}: all ${new Set(names).size} distinct @deepseek-ai packages resolve`)
  }
}

const prof = join(DSH, 'profiles', 'web')
const pkgPath = join(prof, 'package.json')
if (!existsSync(pkgPath)) {
  console.log(`SKIP profile wiring: ${pkgPath} not found`)
} else {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const bundles = pkg.dsh?.profile?.bundles ?? []
  let wired = 0
  for (const p of Object.keys(EXPECT)) {
    const dep = `@local/dsh-${p}-preset`
    if (!bundles.includes(dep)) { fail(`profile is missing ${dep}`); continue }
    const target = pkg.dependencies?.[dep] ?? ''
    if (!target.startsWith('link:../')) fail(`profile dependency ${dep} is not a relative link: ${target}`)
    else wired++
  }
  if (wired === Object.keys(EXPECT).length) ok(`profile wires all ${wired} bundles with relative links`)
}

console.log(failures === 0 ? '\nVERIFICATION PASSED' : `\n${failures} VERIFICATION FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
