#!/usr/bin/env node
// Copy this repository's profile/ directory into a DSH profile on this machine.
//
// Dry run by default: it prints what would change and writes nothing. Pass --apply to write, which
// backs up every file it is about to replace first. The point of the dry run is that a profile
// carries local edits - machine paths, a different default model - and a sync that silently
// overwrites them is worse than no sync at all.
//
//   node sync-profile.mjs                      show the differences
//   node sync-profile.mjs --apply              write, keeping a backup
//   node sync-profile.mjs --dest <dir>         target a profile other than the default
//   node sync-profile.mjs --apply --dest <dir>
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const di = args.indexOf('--dest')
const dest = di >= 0 && args[di + 1]
  ? resolve(args[di + 1])
  : join(homedir(), '.dsh', 'profiles', 'web')

const source = join(import.meta.dirname, 'profile')
if (!existsSync(source)) {
  console.error(`brak katalogu profile/ obok tego skryptu: ${source}`)
  process.exit(1)
}

console.log(`zrodlo:    ${source}`)
console.log(`cel:       ${dest}`)
console.log(apply ? 'tryb:      ZAPIS\n' : 'tryb:      PRÓBA (nic nie zostanie zapisane)\n')

if (!existsSync(dest)) {
  console.error(`katalog docelowy nie istnieje: ${dest}`)
  console.error('utworz profil najpierw, np.  dsh rescue --from-default-profile web')
  process.exit(1)
}

const files = readdirSync(source).filter((f) => statSync(join(source, f)).isFile())
const status = { same: [], changed: [], new: [] }

for (const f of files) {
  const s = join(source, f)
  const d = join(dest, f)
  if (!existsSync(d)) { status.new.push(f); continue }
  const a = readFileSync(s)
  const b = readFileSync(d)
  a.equals(b) ? status.same.push(f) : status.changed.push(f)
}

for (const f of status.same) console.log(`  bez zmian   ${f}`)
for (const f of status.new) console.log(`  NOWY        ${f}`)
for (const f of status.changed) {
  const s = readFileSync(join(source, f), 'utf8').split('\n').length
  const d = readFileSync(join(dest, f), 'utf8').split('\n').length
  console.log(`  ROZNI SIE   ${f}   (repo ${s} linii, lokalnie ${d})`)
}

const touched = [...status.new, ...status.changed]
if (!touched.length) { console.log('\nnic do zrobienia - profil zgadza sie z repozytorium'); process.exit(0) }

if (status.changed.length) {
  console.log('\nUWAGA: pliki oznaczone ROZNI SIE zawieraja lokalne zmiany. Zapis je nadpisze.')
  console.log('Roznice obejrzyj tak:  git diff --no-index profile/cordis.patch.yml "' + join(dest, 'cordis.patch.yml') + '"')
  console.log('Jesli lokalna wersja jest wlasciwa, przenies ja do repo:  skopiuj plik do profile/ i zacommituj.')
}

if (!apply) {
  console.log(`\n--apply aby zapisac ${touched.length} plik(ow)`)
  process.exit(0)
}

// back up before writing
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backup = join(dest, `.backup-${stamp}`)
mkdirSync(backup, { recursive: true })
for (const f of touched) {
  const d = join(dest, f)
  if (existsSync(d)) copyFileSync(d, join(backup, f))
}
console.log(`\nkopia zapasowa: ${backup}`)

for (const f of touched) {
  copyFileSync(join(source, f), join(dest, f))
  console.log(`  zapisano  ${f}`)
}

console.log('\ngotowe. Uruchom ponownie DSH, zeby nowe bundle sie zaladowaly:')
console.log('  dsh web')
