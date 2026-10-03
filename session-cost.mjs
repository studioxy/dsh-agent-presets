#!/usr/bin/env node
// Report token usage and USD cost for one or more DSH sessions.
//
//   node session-cost.mjs                    the most recent session
//   node session-cost.mjs --all              every session, one line each
//   node session-cost.mjs --session <id>     a session by id or directory name
//   node session-cost.mjs --json             machine-readable
//   node session-cost.mjs --refresh          re-fetch prices, ignoring the cache
//
// WHY THIS EXISTS
//
// The harness models cost - a model carries a `cost` field - but nothing populates it and nothing
// reads it. The source says so: "cost metadata - replay.ts zeroes it and no consumer", and the pi-ai
// catalogue ships no prices at all. So the session statistics dialog shows tokens, turns and timings
// and has no cost line, and there is no configuration that turns one on.
//
// This reads the same durable log the statistics dialog reads, and prices it against what the
// gateways actually charge.
//
// HOW THE FIGURES ARE DERIVED
//
//   usage    `data.usage` on each assistant/message:
//            { inputTokens, outputTokens, cacheReadTokens, reasoningTokens, totalTokens }
//            Verified against two records: totalTokens = input + output + cacheRead, so
//            inputTokens EXCLUDES cache reads and the three are billed separately.
//
//   model    the `config` of the most recent request/header before that message, so a session that
//            switched models mid-way is priced per request rather than at one rate.
//
//   prices   three gateways, two units:
//              cheaperinference  input_per_million / output_per_million / cache_read_input_per_million
//              kilocode          prompt / completion / input_cache_read          (per single token)
//              openrouter        prompt / completion / input_cache_read          (per single token)
//            All normalised to USD per token.
//
// A model with no known price is reported with its token counts and a `?` for cost. It is never
// counted as zero: a number that is wrong is worse than one that is absent.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import zlib from 'node:zlib'

const DSH = join(homedir(), '.dsh')
const SESSIONS = join(DSH, 'sessions')
const CACHE = join(DSH, 'cache', 'session-cost-prices.json')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }

// ── reading the log ─────────────────────────────────────────────────────────
// The log is a sequence of concatenated zstd frames, one per append. zstdDecompressSync reads only
// the first, and so does the streaming API, so walk the frame magic and decompress each slice.

function readLog(path) {
  const buf = readFileSync(path)
  const starts = []
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i)
  }
  if (!starts.length) return buf.toString('utf8')
  const parts = []
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length
    try { parts.push(zlib.zstdDecompressSync(buf.subarray(starts[k], end))) } catch { /* torn tail */ }
  }
  return Buffer.concat(parts).toString('utf8')
}

function sessionDirs() {
  if (!existsSync(SESSIONS)) return []
  const out = []
  for (const ws of readdirSync(SESSIONS)) {
    const wsDir = join(SESSIONS, ws)
    if (!statSync(wsDir).isDirectory()) continue
    for (const s of readdirSync(wsDir)) {
      const sDir = join(wsDir, s)
      if (!statSync(sDir).isDirectory()) continue
      const logs = readdirSync(sDir).filter((f) => /^session\..*\.jsonl(\.zstd)?$/.test(f))
      if (!logs.length) continue
      const log = join(sDir, logs.sort().pop())
      out.push({ id: s, workspace: ws.replace(/~0020/g, ' ').replace(/^--|--$/g, ''), path: log, mtime: statSync(log).mtimeMs })
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

// ── pricing ─────────────────────────────────────────────────────────────────
//
// The cache records when it was fetched and from where, so the report can say how old its prices are
// rather than implying they are current. It refreshes itself once a day; --refresh forces it and
// --offline never fetches.

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

async function fetchPrices() {
  const cached = existsSync(CACHE) ? (() => { try { return JSON.parse(readFileSync(CACHE, 'utf8')) } catch { return null } })() : null
  const age = cached?.fetchedAt ? Date.now() - cached.fetchedAt : Infinity

  if (flag('--offline') && cached) return cached
  if (!flag('--refresh') && cached && age < CACHE_MAX_AGE_MS) return cached
  if (!flag('--refresh') && cached) console.log(`ceny starsze niz 24h (${Math.round(age / 3600000)}h) - odswiezam`)

  const credPath = join(DSH, '.credentials.yaml')
  const cred = existsSync(credPath) ? readFileSync(credPath, 'utf8') : ''
  const key = (n) => new RegExp(`^\\s{2}${n}:\\s*(.+)$`, 'm').exec(cred)?.[1]?.trim()

  const table = {}
  const sources = []
  const add = (provider, id, pIn, pOut, pCache, unit) => {
    if (pIn === undefined) return
    const div = unit === 'million' ? 1e6 : 1
    table[`${provider}\u0000${id}`] = {
      in: Number(pIn) / div,
      out: Number(pOut ?? pIn) / div,
      cache: pCache === undefined || pCache === null ? null : Number(pCache) / div,
      source: provider,
    }
  }

  // per-million
  const ci = key('CHEAPERINFERENCE_API_KEY')
  if (ci) {
    try {
      const j = await (await fetch('https://api.cheaperinference.com/v1/models', { headers: { Authorization: `Bearer ${ci}` } })).json()
      for (const m of j.data ?? []) {
        const p = m.pricing ?? {}
        add('cheaperinference', m.id, p.input_per_million, p.output_per_million, p.cache_read_input_per_million, 'million')
      }
      sources.push(`cheaperinference ${(j.data ?? []).length}`)
    } catch (e) { sources.push(`cheaperinference FAILED: ${e.message}`) }
  }

  // per-token
  for (const [provider, url, k] of [
    ['kilocode', 'https://api.kilo.ai/api/gateway/models', key('KILOCODE_API_KEY')],
    ['openrouter', 'https://openrouter.ai/api/v1/models', key('OPENROUTER_API_KEY')],
  ]) {
    if (!k) { sources.push(`${provider} no key`); continue }
    try {
      const j = await (await fetch(url, { headers: { Authorization: `Bearer ${k}` } })).json()
      for (const m of j.data ?? []) {
        const p = m.pricing ?? {}
        add(provider, m.id, p.prompt, p.completion, p.input_cache_read, 'token')
      }
      sources.push(`${provider} ${(j.data ?? []).length}`)
    } catch (e) { sources.push(`${provider} FAILED: ${e.message}`) }
  }

  // If every source failed, keep the previous cache rather than replacing a stale table with none.
  if (!Object.keys(table).length && cached) {
    console.log('wszystkie zrodla zawiodly - zostawiam poprzedni cache')
    return cached
  }

  const payload = { fetchedAt: Date.now(), sources, prices: table }
  mkdirSync(join(DSH, 'cache'), { recursive: true })
  writeFileSync(CACHE, JSON.stringify(payload), 'utf8')
  return payload
}

// A local override wins, so a model no gateway lists can still be priced without editing this file.
// An entry may be a flat rate, or a peak/offPeak pair for a provider that bills by time of day.
function loadOverrides() {
  const f = join(import.meta.dirname, 'prices.json')
  if (!existsSync(f)) return {}
  try {
    const raw = JSON.parse(readFileSync(f, 'utf8'))
    const out = {}
    for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_')) out[k] = v
    return out
  } catch { return {} }
}

// DeepSeek bills peak and off-peak separately: 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday.
// The log records a timestamp per record, so the rate is chosen from when the request happened
// rather than averaged. Chinese public holidays are excluded from peak in DeepSeek's terms and are
// not detectable here, so a holiday inside a peak window is billed at peak - an error that runs
// toward over-stating rather than under.
function isPeak(epochMs) {
  const d = new Date(epochMs)
  const day = d.getUTCDay()
  if (day === 0 || day === 6) return false
  const h = d.getUTCHours()
  return (h >= 1 && h < 4) || (h >= 6 && h < 10)
}

function priceFor(prices, overrides, provider, model, epochMs) {
  const o = overrides[`${provider}/${model}`] ?? overrides[model]
  if (o) {
    const tiered = Boolean(o.peak && o.offPeak)
    const pick = tiered ? (isPeak(epochMs) ? o.peak : o.offPeak) : o
    return {
      in: pick.input, out: pick.output, cache: pick.cacheRead ?? null,
      tariff: tiered ? (isPeak(epochMs) ? 'peak' : 'offPeak') : 'flat',
      source: tiered ? `prices.json (${isPeak(epochMs) ? 'peak' : 'off-peak'})` : 'prices.json',
    }
  }
  const exact = prices[`${provider}\u0000${model}`]
  if (exact) return { ...exact, tariff: 'flat' }
  // a gateway may list the same model id under a different provider name; fall back to name only
  for (const [k, v] of Object.entries(prices)) {
    const [, id] = k.split('\u0000')
    if (id === model) return { ...v, tariff: 'flat', source: `${v.source} (matched by name)` }
  }
  return null
}

// ── analysis ────────────────────────────────────────────────────────────────

function analyse(path, prices, overrides) {
  const text = readLog(path)
  const byModel = new Map()
  let current = null
  let turns = 0
  let steps = 0

  for (const line of text.split('\n')) {
    if (!line) continue
    let j
    try { j = JSON.parse(line) } catch { continue }

    if (j.type === 'request/header') {
      const c = j.data?.header?.config
      if (c?.provider) current = `${c.provider} / ${c.model}`
      continue
    }
    if (j.type === 'turn/start') { turns++; continue }
    if (j.type === 'step/start') { steps++; continue }
    if (j.type !== 'assistant/message') continue

    const u = j.data?.usage
    if (!u) continue
    const key = current ?? '(model unknown)'
    const acc = byModel.get(key) ?? {
      requests: 0, input: 0, output: 0, cache: 0, reasoning: 0, cost: 0, priced: false, sources: new Set(),
      costPeak: 0, costOffPeak: 0, costFlat: 0,
      cacheSaving: 0,        // what the cache reads would have cost at the cache-miss rate
      cacheWouldCost: 0,     // and what they did cost
      offPeakCounterfactual: 0, // the whole line priced at off-peak, to size the peak premium
    }
    acc.requests++
    acc.input += u.inputTokens ?? 0
    acc.output += u.outputTokens ?? 0
    acc.cache += u.cacheReadTokens ?? 0
    acc.reasoning += u.reasoningTokens ?? 0

    const [prov, ...rest] = key.split(' / ')
    const p = priceFor(prices, overrides, prov, rest.join(' / '), j.time ?? Date.now())
    if (p) {
      acc.priced = true
      acc.sources.add(p.source)
      const inp = u.inputTokens ?? 0, out = u.outputTokens ?? 0, cac = u.cacheReadTokens ?? 0
      const line = inp * p.in + out * p.out + cac * (p.cache ?? p.in)
      acc.cost += line

      if (p.tariff === 'peak') acc.costPeak += line
      else if (p.tariff === 'offPeak') acc.costOffPeak += line
      else acc.costFlat += line

      // cache: what it cost, against what the same reads would cost at the input rate
      const cacheRate = p.cache ?? p.in
      acc.cacheSaving += cac * (p.in - cacheRate)
      acc.cacheWouldCost += cac * cacheRate

      // off-peak counterfactual, so the peak premium can be sized even for a flat-priced model
      acc.offPeakCounterfactual += inp * p.in + out * p.out + cac * cacheRate
    }
    byModel.set(key, acc)
  }

  return { byModel, turns, steps }
}

const fmt = (n) => n.toLocaleString('en-US')
const usd = (n) => `$${n.toFixed(6)}`

// ── main ────────────────────────────────────────────────────────────────────

const pricePayload = await fetchPrices()
const prices = pricePayload.prices ?? pricePayload
const overrides = loadOverrides()
const priceCount = Object.keys(prices).length

let targets
if (flag('--all') || flag('--html')) targets = sessionDirs()
else if (value('--session')) {
  const needle = value('--session')
  const found = sessionDirs().filter((s) => s.id === needle || s.id.includes(needle) || s.workspace.includes(needle))
  targets = found.length ? found : []
} else targets = sessionDirs().slice(0, 1)

if (!targets.length) { console.error('brak sesji do przeanalizowania'); process.exit(1) }

const results = []
for (const t of targets) results.push({ ...t, ...analyse(t.path, prices, overrides) })

if (flag('--json')) {
  console.log(JSON.stringify({ pricesKnown: priceCount, sessions: results.map((r) => ({
    id: r.id, workspace: r.workspace, turns: r.turns, steps: r.steps,
    models: Object.fromEntries(r.byModel),
  })) }, null, 2))
  process.exit(0)
}

const ageH = pricePayload.fetchedAt ? (Date.now() - pricePayload.fetchedAt) / 3600000 : null
if (flag('--html')) {
  const { render } = await import('./cost-dashboard.mjs')
  const i = argv.indexOf('--html')
  const next = argv[i + 1]
  const out = next && !next.startsWith('--') ? next : join(import.meta.dirname, 'cost-dashboard.html')

  const ageMin = pricePayload.fetchedAt ? Math.round((Date.now() - pricePayload.fetchedAt) / 60000) : null
  const html = render({
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    prices: {
      count: priceCount,
      age: ageMin === null ? 'nieznany' : ageMin < 60 ? `${ageMin} min temu` : `${(ageMin / 60).toFixed(1)} h temu`,
      sources: (pricePayload.sources ?? []).join(', ') || 'prices.json tylko',
    },
    overrides: Object.keys(overrides).filter((k) => !k.startsWith('_')).length || null,
    sessions: results.map((r) => ({
      id: r.id, workspace: r.workspace, mtime: r.mtime, turns: r.turns, steps: r.steps,
      // a Set does not survive JSON.stringify, so flatten it here rather than shipping `{}`
      byModel: Object.fromEntries([...r.byModel].map(([k, a]) => [k, {
        requests: a.requests, input: a.input, output: a.output, cache: a.cache,
        reasoning: a.reasoning, cost: a.cost, priced: a.priced,
        costPeak: a.costPeak, costOffPeak: a.costOffPeak, costFlat: a.costFlat,
        cacheSaving: a.cacheSaving, cacheWouldCost: a.cacheWouldCost,
        offPeakCounterfactual: a.offPeakCounterfactual,
        sources: [...(a.sources ?? [])],
      }])),
    })),
  })
  writeFileSync(out, html, 'utf8')
  console.log(`zapisano: ${out}`)
  console.log(`${(html.length / 1024).toFixed(1)} KB, ${results.length} sesji, samowystarczalny (bez sieci i bibliotek)`)
  process.exit(0)
}

console.log(
  `ceny: ${fmt(priceCount)} modeli` +
  (ageH !== null ? `, pobrane ${ageH < 1 ? `${Math.round(ageH * 60)} min` : `${ageH.toFixed(1)} h`} temu` : '') +
  (pricePayload.sources ? `  [${pricePayload.sources.join(' | ')}]` : ''),
)
if (Object.keys(overrides).length) {
  const n = Object.keys(overrides).filter((k) => !k.startsWith('_')).length
  console.log(`nadpisania z prices.json: ${n}`)
}

if (flag('--all')) {
  console.log('')
  let grand = 0
  let unpricedSessions = 0
  for (const r of results) {
    let cost = 0
    let unpriced = 0
    for (const [, a] of r.byModel) { cost += a.cost; if (!a.priced) unpriced += a.input + a.output + a.cache }
    grand += cost
    if (unpriced) unpricedSessions++
    const when = new Date(r.mtime).toISOString().slice(0, 16).replace('T', ' ')
    console.log(`${when}  ${usd(cost).padStart(12)}  ${unpriced ? `(+${fmt(unpriced)} tok bez ceny)` : ''.padEnd(22)}  ${r.workspace.slice(0, 46)}`)
  }
  console.log(`\nrazem: ${usd(grand)}${unpricedSessions ? `  - ${unpricedSessions} sesji ma tokeny bez znanej ceny` : ''}`)
  process.exit(0)
}

for (const r of results) {
  console.log(`\nsesja:     ${r.id}`)
  console.log(`workspace: ${r.workspace}`)
  console.log(`czas:      ${new Date(r.mtime).toISOString().slice(0, 19).replace('T', ' ')}`)
  console.log(`tury: ${r.turns}   kroki: ${r.steps}\n`)

  const rows = [...r.byModel].sort((a, b) => (b[1].cost - a[1].cost))
  let total = 0
  let unpricedTokens = 0

  console.log('model                                          req       input      output  cache-read        cost')
  console.log('-'.repeat(104))
  for (const [model, a] of rows) {
    total += a.cost
    if (!a.priced) unpricedTokens += a.input + a.output + a.cache
    console.log(
      `${model.slice(0, 44).padEnd(44)} ${String(a.requests).padStart(4)} ${fmt(a.input).padStart(11)} ${fmt(a.output).padStart(11)} ${fmt(a.cache).padStart(11)} ${(a.priced ? usd(a.cost) : '?').padStart(12)}`,
    )
  }
  console.log('-'.repeat(104))
  console.log(`${'RAZEM'.padEnd(44)} ${''.padStart(4)} ${''.padStart(11)} ${''.padStart(11)} ${''.padStart(11)} ${usd(total).padStart(12)}`)
  if (unpricedTokens) {
    console.log(`\n${fmt(unpricedTokens)} tokenow nie ma znanej ceny i nie wchodzi do sumy.`)
    console.log('Aby je wycenic, dopisz model do prices.json obok tego skryptu:')
    console.log('  { "provider/model": { "input": 0.000001, "output": 0.000004, "cacheRead": 0.0000001 } }')
    console.log('Wartosci sa za pojedynczy token, w USD.')
  }
  console.log('')
}
