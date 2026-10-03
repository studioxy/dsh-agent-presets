#!/usr/bin/env node
// Check every factual claim README.md makes against the repository.
//
//   node check-readme.mjs
//
// A README is the one file a visitor reads and the one file nothing validates. The first draft of
// this one claimed 63 MIT skills, 18 written here and 4 unlicensed; the real figures were 66, 14 and
// 3 plus 1 proprietary. Every number in it is checked here, along with the files it says exist.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO = import.meta.dirname
const readme = readFileSync(join(REPO, 'README.md'), 'utf8')
const PRESETS = ['powerbi', 'docs', 'coding', 'web', 'excel-pq']

let bad = 0
const check = (label, actual, claimed) => {
  const ok = String(actual) === String(claimed)
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'ZLE '} ${label}: README=${claimed} rzeczywistosc=${actual}`)
}

// skill counts in the preset table
for (const p of PRESETS) {
  const dir = join(REPO, p, 'skills')
  if (!existsSync(dir)) { bad++; console.log(`ZLE  brak katalogu ${p}/skills`); continue }
  const n = readdirSync(dir).filter((d) => existsSync(join(dir, d, 'SKILL.md'))).length
  const m = new RegExp(`\\| \`${p}\` \\| (\\d+) \\|`).exec(readme)
  check(`${p} skills`, n, m ? m[1] : '?')
}

// licence distribution, read from each skill's own ATTRIBUTION.md
const b = { MIT: 0, 'GPL-3.0': 0, own: 0, none: 0, proprietary: 0, other: 0 }
for (const p of PRESETS) {
  const dir = join(REPO, p, 'skills')
  if (!existsSync(dir)) continue
  for (const s of readdirSync(dir)) {
    if (!existsSync(join(dir, s, 'SKILL.md'))) continue
    const a = join(dir, s, 'ATTRIBUTION.md')
    if (!existsSync(a)) { b.own++; continue }
    const low = readFileSync(a, 'utf8').toLowerCase()
    if (low.includes('proprietary')) b.proprietary++
    else if (low.includes('no licence file') || low.includes('license: none')) b.none++
    else if (low.includes('gpl')) b['GPL-3.0']++
    else if (low.includes('mit')) b.MIT++
    else { b.other++; console.log(`     nieklasyfikowany: ${p}/${s}`) }
  }
}
const total = Object.values(b).reduce((a, x) => a + x, 0)
console.log(`\nlicencje: MIT=${b.MIT} GPL=${b['GPL-3.0']} wlasne=${b.own} bez=${b.none} wlasnosciowa=${b.proprietary} inne=${b.other}`)

check('MIT', b.MIT, /(\d+) MIT/.exec(readme)?.[1])
check('GPL-3.0', b['GPL-3.0'], /(\d+) GPL-3\.0/.exec(readme)?.[1])
check('written here', b.own, /(\d+) written here/.exec(readme)?.[1])
check('no licence', b.none, /(\d+) with no licence/.exec(readme)?.[1])
check('proprietary', b.proprietary, /(\d+) proprietary/.exec(readme)?.[1])
check('suma', total, /The (\d+) skills break down/.exec(readme)?.[1])

// files the README says are here
const FILES = ['REPRODUCE.md', 'bootstrap.ps1', 'sync-profile.mjs', 'profile-bundles/validate.cjs', 'profile/package.json']
for (const f of FILES) {
  const ok = existsSync(join(REPO, f))
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'ZLE '} plik ${f}`)
}

console.log(bad ? `\n${bad} NIEZGODNOSCI` : '\nREADME ZGADZA SIE Z REPOZYTORIUM')
process.exit(bad ? 1 : 0)
