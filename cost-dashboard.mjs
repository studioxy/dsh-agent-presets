// Renders the cost report as one self-contained HTML file: no CDN, no external font, no build step,
// so it opens straight from the filesystem and can be sent as a single attachment.
//
// Charts are hand-written SVG rather than a library. The dataset is a few dozen sessions and a dozen
// models, so a charting dependency would be larger than the data it draws and would need to be
// either fetched or inlined anyway.
//
// The page ships a small amount of plain JavaScript for table sorting and chart tooltips. That is
// the one place a script earns its keep here; a framework would not, and the page still reads
// correctly with scripting off.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const usd = (n) => (n < 0.01 && n > 0 ? `$${n.toFixed(5)}` : `$${n.toFixed(n < 1 ? 4 : 2)}`)
const num = (n) => n.toLocaleString('en-US')
const short = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

// Peak is defined in UTC by DeepSeek: 01:00-04:00 and 06:00-10:00, Monday to Friday. The local
// equivalent moves with daylight saving - in Warsaw it is 03:00-06:00 and 08:00-12:00 in summer and
// 02:00-05:00 and 07:00-11:00 in winter - so it is computed from the system time zone rather than
// written down. Billing stays in UTC; only the label is local.
const PEAK_UTC = [[1, 4], [6, 10]]
function localPeakWindows(date = new Date()) {
  const at = (h) => {
    const d = new Date(date)
    d.setUTCHours(h, 0, 0, 0)
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return PEAK_UTC.map(([a, b]) => `${at(a)}–${at(b)}`)
}
function timeZoneLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat('pl-PL', { timeZoneName: 'shortOffset' }).formatToParts(date)
  return (parts.find((p) => p.type === 'timeZoneName')?.value ?? '').replace('GMT', 'UTC')
}

// ── aggregation ─────────────────────────────────────────────────────────────

function aggregate(sessions) {
  const byModel = new Map()
  const byDay = new Map()
  const hourly = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ cost: 0, tokens: 0, requests: 0 })))
  const total = {
    cost: 0, input: 0, output: 0, cache: 0, reasoning: 0, requests: 0, sessions: 0, unpriced: 0,
    costPeak: 0, costOffPeak: 0, costFlat: 0, cacheSaving: 0, cacheWouldCost: 0, offPeakCounterfactual: 0,
    peaked: 0, offPeaked: 0,
  }
  const NUM = ['input', 'output', 'cache', 'reasoning', 'requests', 'costPeak', 'costOffPeak', 'costFlat', 'cacheSaving', 'cacheWouldCost', 'offPeakCounterfactual', 'cost']

  for (const s of sessions) {
    let scost = 0
    for (const [model, a] of Object.entries(s.byModel)) {
      const m = byModel.get(model) ?? Object.fromEntries([...NUM.map((k) => [k, 0]), ['sessions', 0], ['priced', a.priced]])
      for (const k of NUM) m[k] += a[k] ?? 0
      m.sessions++
      m.priced = m.priced || a.priced
      byModel.set(model, m)
      scost += a.cost
      // 'cost' is excluded here and added once below from scost; including it in both places
      // doubled the grand total, which is how the mistake was caught.
      for (const k of NUM) if (k !== 'requests' && k !== 'cost') total[k] += a[k] ?? 0
      total.requests += a.requests
      if (!a.priced) total.unpriced += a.input + a.output + a.cache
    }
    total.cost += scost
    total.sessions++
    total.peaked += s.peaked ?? 0
    total.offPeaked += s.offPeaked ?? 0

    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const src = s.hourly?.[d]?.[h]
      if (!src) continue
      hourly[d][h].cost += src.cost; hourly[d][h].tokens += src.tokens; hourly[d][h].requests += src.requests
    }

    const day = new Date(s.mtime).toISOString().slice(0, 10)
    const dd = byDay.get(day) ?? { cost: 0, tokens: 0, sessions: 0 }
    dd.cost += scost
    dd.sessions++
    for (const a of Object.values(s.byModel)) dd.tokens += a.input + a.output + a.cache
    byDay.set(day, dd)
  }
  return { byModel, byDay, hourly, total }
}

// ── svg pieces ──────────────────────────────────────────────────────────────

function timeChart(byDay) {
  const days = [...byDay.entries()].sort()
  if (days.length < 2) return '<p class="muted">Za malo dni na wykres czasu.</p>'
  const W = 940, H = 280, P = { l: 74, r: 24, t: 20, b: 44 }
  const max = Math.max(...days.map(([, d]) => d.cost)) || 1
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const x = (i) => P.l + (i / (days.length - 1)) * iw
  const y = (v) => P.t + ih - (v / max) * ih

  const line = days.map(([, d], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.cost).toFixed(1)}`).join(' ')
  const area = `${line} L${x(days.length - 1).toFixed(1)},${P.t + ih} L${P.l},${P.t + ih} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = max * f
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>
            <text x="${P.l - 10}" y="${(y(v) + 4).toFixed(1)}" class="axis" text-anchor="end">${usd(v)}</text>`
  }).join('')

  // hover targets: a full-height band per day, so the tooltip triggers anywhere in the column
  const band = iw / Math.max(1, days.length - 1)
  const hits = days.map(([day, d], i) =>
    `<rect class="hit" x="${(x(i) - band / 2).toFixed(1)}" y="${P.t}" width="${band.toFixed(1)}" height="${ih}"
       data-day="${day}" data-cost="${usd(d.cost)}" data-sessions="${d.sessions}" data-tokens="${short(d.tokens)}"/>`).join('')

  const pts = days.map(([day, d], i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(d.cost).toFixed(1)}" r="3.5" class="dot" data-i="${i}"/>`).join('')

  const step = Math.ceil(days.length / 9)
  const labels = days.map(([day], i) =>
    i % step === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - 14}" class="axis" text-anchor="middle">${day.slice(5)}</text>` : '').join('')

  return `<div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Koszt w czasie">
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity=".34"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}<path d="${area}" class="area"/><path d="${line}" class="line"/>${pts}${labels}${hits}
    </svg>
    <div class="tip" id="tip-time"></div>
  </div>`
}

// 7 x 24 heatmap in local time with the peak windows outlined. This is the chart that makes the
// tariff question visible: it shows when the work actually happens against when it is cheapest.
function heatmap(hourly) {
  const DAYS = ['pon', 'wt', 'sr', 'czw', 'pt', 'sob', 'niedz']
  const max = Math.max(...hourly.flat().map((c) => c.cost)) || 1
  const now = new Date()
  const peakCols = new Set()
  for (const [a, b] of PEAK_UTC) for (let h = a; h < b; h++) {
    const d = new Date(now); d.setUTCHours(h, 0, 0, 0); peakCols.add(d.getHours())
  }

  const header = `<div class="hm-corner"></div><div class="hm-hours">` +
    Array.from({ length: 24 }, (_, h) => `<div class="hm-h">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>`).join('') +
    `</div>`

  const rows = DAYS.map((dayName, d) => {
    const cells = Array.from({ length: 24 }, (_, h) => {
      const c = hourly[d][h]
      const t = c.cost / max
      const isPeak = d < 5 && peakCols.has(h)
      // the fill is inline so a cell with no spend stays at the base track colour
      const style = c.cost > 0 ? ` style="background:color-mix(in srgb, var(--accent) ${(10 + t * 90).toFixed(0)}%, transparent)"` : ''
      return `<div class="hm-cell${isPeak ? ' hm-peak' : ''}"${style} data-d="${dayName}" data-h="${String(h).padStart(2, '0')}" ` +
        `data-cost="${usd(c.cost)}" data-req="${c.requests}" data-tok="${short(c.tokens)}"></div>`
    }).join('')
    return `<div class="hm-day">${dayName}</div><div class="hm-row">${cells}</div>`
  }).join('')

  return `<div class="hm">${header}${rows}</div>
  <div class="legend">
    <span><i class="sw-peak"></i>okno szczytowe (obwodka)</span>
    <span><i class="sw-scale"></i>im mocniej, tym wiekszy koszt w tej godzinie</span>
  </div>`
}

function modelBars(byModel, top = 12) {
  const rows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, top)
  if (!rows.length) return '<p class="muted">Brak danych.</p>'
  const max = Math.max(...rows.map(([, m]) => m.cost)) || 1
  return rows.map(([model, m]) => `
    <div class="bar-row" data-model="${esc(model)}">
      <div class="bar-label" title="${esc(model)}">${esc(model)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:0%" data-w="${(m.cost / max * 100).toFixed(2)}"></div></div>
      <div class="bar-value">${m.priced ? usd(m.cost) : '?'}</div>
    </div>`).join('')
}

function tokenBars(byModel, top = 12) {
  const rows = [...byModel.entries()].sort((a, b) => (b[1].input + b[1].output + b[1].cache) - (a[1].input + a[1].output + a[1].cache)).slice(0, top)
  const max = Math.max(...rows.map(([, m]) => m.input + m.output + m.cache)) || 1
  const p = (v) => (v / max * 100).toFixed(2)
  return rows.map(([model, m]) => {
    const t = m.input + m.output + m.cache
    return `<div class="bar-row">
      <div class="bar-label" title="${esc(model)}">${esc(model)}</div>
      <div class="bar-track stacked">
        <div class="seg seg-in" style="width:${p(m.input)}%" title="input ${num(m.input)}"></div>
        <div class="seg seg-out" style="width:${p(m.output)}%" title="output ${num(m.output)}"></div>
        <div class="seg seg-cache" style="width:${p(m.cache)}%" title="cache ${num(m.cache)}"></div>
      </div>
      <div class="bar-value">${short(t)}</div>
    </div>`
  }).join('')
}

// ── page ────────────────────────────────────────────────────────────────────

export function render(data) {
  const { sessions, generatedAt, prices, overrides, hourly: hourlyIn } = data
  const { byModel, byDay, hourly: hourlyAgg, total } = aggregate(sessions)
  // the generator sums the grid across sessions and passes it in; fall back to the local aggregate
  const hourly = hourlyIn ?? hourlyAgg
  const days = [...byDay.keys()].sort()
  const pricedCost = total.cost
  const peakTotal = total.costPeak + total.costOffPeak
  const hasTariff = peakTotal > 0
  const peakPremium = hasTariff ? total.costPeak / 2 : 0
  const cachePct = total.input + total.cache > 0 ? total.cache / (total.input + total.cache) * 100 : 0
  const cacheShareOfBill = pricedCost > 0 ? total.cacheWouldCost / pricedCost * 100 : 0
  const windows = localPeakWindows()
  const tz = timeZoneLabel()

  const sessionRows = [...sessions].sort((a, b) => b.mtime - a.mtime).map((s) => {
    let cost = 0, tokens = 0, unpriced = 0
    const models = Object.entries(s.byModel).sort((a, b) => b[1].cost - a[1].cost)
    for (const [, a] of models) { cost += a.cost; tokens += a.input + a.output + a.cache; if (!a.priced) unpriced += a.input + a.output + a.cache }
    return `<tr>
      <td class="mono" data-sort="${s.mtime}">${new Date(s.mtime).toISOString().slice(0, 16).replace('T', ' ')}</td>
      <td data-sort="${esc(s.workspace)}">${esc(s.workspace)}</td>
      <td class="num" data-sort="${s.turns}">${s.turns}</td>
      <td class="num" data-sort="${s.steps}">${s.steps}</td>
      <td class="num" data-sort="${tokens}">${short(tokens)}</td>
      <td class="num strong" data-sort="${cost}">${usd(cost)}${unpriced ? ' <span class="warn" title="tokeny bez znanej ceny">?</span>' : ''}</td>
      <td class="models">${models.map(([m, a]) => `<span class="chip" title="${num(a.requests)} zadan">${esc(m.split(' / ').pop())}</span>`).join('')}</td>
    </tr>`
  }).join('')

  const safeJson = JSON.stringify(data).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Koszty sesji DSH</title>
<style>
  :root {
    --bg: #0b0d12; --bg2: #101319; --panel: #141821; --panel2: #1a1f2a;
    --line: #232936; --line2: #2e3546;
    --fg: #e8ecf4; --muted: #8891a6; --dim: #5d6679;
    --accent: #7aa2f7; --accent2: #bb9af7;
    --in: #5b8dd9; --out: #d9a05b; --cache: #59b389; --peak: #c96a5a;
    --warn: #d9a05b;
    --radius: 12px;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #fbfbfd; --bg2: #f4f5f8; --panel: #ffffff; --panel2: #fafbfc;
      --line: #e6e8ee; --line2: #d8dce5;
      --fg: #12151c; --muted: #5b6474; --dim: #8b93a3;
      --accent: #3b6fd4; --accent2: #8250c4;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; color: var(--fg);
    background:
      radial-gradient(1100px 520px at 12% -8%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 60%),
      radial-gradient(900px 460px at 92% 2%, color-mix(in srgb, var(--accent2) 7%, transparent), transparent 55%),
      var(--bg);
    font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
  }
  .wrap { max-width: 1220px; margin: 0 auto; padding: 56px 28px 96px; }

  header { margin-bottom: 40px; }
  h1 { font-size: clamp(26px, 3.4vw, 34px); margin: 0 0 10px; letter-spacing: -0.03em; font-weight: 650; }
  h1 .dot { color: var(--accent); }
  .sub { color: var(--muted); font-size: 13px; margin: 0; }
  .sub b { color: var(--fg); font-weight: 550; }

  h2 { font-size: 12px; margin: 0 0 20px; color: var(--muted); font-weight: 600;
       letter-spacing: .1em; text-transform: uppercase; }
  h2 .hint { text-transform: none; letter-spacing: 0; font-weight: 400; color: var(--dim); margin-left: 10px; }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 14px; margin-bottom: 22px; }
  .card {
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 22px;
    position: relative; overflow: hidden;
    transition: border-color .18s ease, transform .18s ease;
  }
  .card::before {
    content: ""; position: absolute; inset: 0 auto auto 0; width: 100%; height: 2px;
    background: linear-gradient(90deg, var(--accent), transparent 70%); opacity: .5;
  }
  .card:hover { border-color: var(--line2); transform: translateY(-1px); }
  .card .k { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; font-weight: 550; }
  .card .v { font-size: 25px; font-weight: 650; letter-spacing: -0.03em; line-height: 1.15; }
  .card .n { color: var(--dim); font-size: 12px; margin-top: 7px; }
  .card.accent::before { background: linear-gradient(90deg, var(--cache), transparent 70%); }
  .card.accent .v { color: var(--cache); }
  .card.warnc::before { background: linear-gradient(90deg, var(--warn), transparent 70%); }
  .card.warnc .v { color: var(--warn); }

  section {
    background: linear-gradient(180deg, var(--panel2), var(--panel));
    border: 1px solid var(--line); border-radius: var(--radius);
    padding: 28px; margin-bottom: 20px;
    animation: rise .45s cubic-bezier(.2,.7,.3,1) both;
  }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { section { animation: none; } }

  .lead { color: var(--muted); font-size: 13.5px; margin: 0 0 22px; max-width: 78ch; }
  .lead strong { color: var(--fg); font-weight: 600; }
  .lead code { background: var(--line); padding: 1px 6px; border-radius: 4px; font-size: 12px; }

  .chart-wrap { position: relative; }
  .chart { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .axis { fill: var(--dim); font-size: 11px; }
  .line { fill: none; stroke: var(--accent); stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round;
          stroke-dasharray: 2400; stroke-dashoffset: 2400; animation: draw 1.1s ease-out .15s forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .line { animation: none; stroke-dashoffset: 0; } }
  .area { fill: url(#ag); }
  .dot { fill: var(--accent); stroke: var(--panel); stroke-width: 1.5; }
  .hit { fill: transparent; cursor: crosshair; }
  .hit:hover + .hit, .hit:hover { fill: color-mix(in srgb, var(--accent) 8%, transparent); }

  .tip {
    position: absolute; pointer-events: none; opacity: 0; transform: translate(-50%, -120%);
    background: var(--panel2); border: 1px solid var(--line2); border-radius: 8px;
    padding: 9px 12px; font-size: 12px; white-space: nowrap; z-index: 10;
    box-shadow: 0 8px 24px rgba(0,0,0,.35); transition: opacity .12s ease;
  }
  .tip.on { opacity: 1; }
  .tip b { color: var(--accent); font-weight: 600; }

  .hm { display: grid; grid-template-columns: 42px 1fr; gap: 3px; }
  .hm-corner { }
  .hm-hours, .hm-row { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; }
  .hm-hours { margin-bottom: 2px; }
  .hm-h { font-size: 9.5px; color: var(--dim); text-align: center; }
  .hm-day { font-size: 11px; color: var(--muted); display: flex; align-items: center; }
  .hm-cell { aspect-ratio: 1; border-radius: 3px; background: var(--line); transition: transform .12s ease, outline-color .12s ease; outline: 1px solid transparent; }
  .hm-peak { outline: 1px dashed color-mix(in srgb, var(--peak) 60%, transparent); }
  .hm-cell:hover { transform: scale(1.22); outline: 1.5px solid var(--fg); z-index: 2; }

  .bar-row { display: grid; grid-template-columns: minmax(150px, 300px) 1fr 96px; gap: 14px; align-items: center; margin-bottom: 8px; }
  .bar-label { color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { background: var(--line); border-radius: 5px; height: 20px; overflow: hidden; display: flex; }
  .bar-fill { background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 75%, transparent), var(--accent));
              border-radius: 5px; width: 0; transition: width .8s cubic-bezier(.2,.7,.3,1); }
  .seg { height: 100%; transition: opacity .12s ease; }
  .seg:hover { opacity: .75; }
  .seg-in { background: var(--in); } .seg-out { background: var(--out); } .seg-cache { background: var(--cache); }
  .bar-value { text-align: right; font-size: 12.5px; font-weight: 550; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 550; font-size: 11px; text-transform: uppercase;
       letter-spacing: .06em; padding: 0 12px 12px 0; border-bottom: 1px solid var(--line2); white-space: nowrap; }
  th[data-sortable] { cursor: pointer; user-select: none; transition: color .15s ease; }
  th[data-sortable]:hover { color: var(--fg); }
  th[data-sortable]::after { content: " \\2195"; color: var(--dim); font-size: 10px; }
  th.asc::after { content: " \\2191"; color: var(--accent); }
  th.desc::after { content: " \\2193"; color: var(--accent); }
  td { padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  tbody tr { transition: background .12s ease; }
  tbody tr:hover { background: color-mix(in srgb, var(--accent) 5%, transparent); }
  tr:last-child td { border-bottom: 0; }
  .num { text-align: right; }
  .strong { font-weight: 650; }
  .mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }
  .muted { color: var(--muted); }
  .dim { color: var(--dim); }
  .warn { color: var(--warn); cursor: help; }
  .models { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { background: var(--line); color: var(--muted); border-radius: 5px; padding: 2px 7px; font-size: 11px; white-space: nowrap; }

  .legend { display: flex; gap: 20px; color: var(--dim); font-size: 12px; margin-top: 16px; flex-wrap: wrap; }
  .legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 7px; vertical-align: -1px; }
  .sw-peak { background: transparent; outline: 1px dashed var(--peak); }
  .sw-scale { background: linear-gradient(90deg, transparent, var(--accent)); }

  .split-bar { display: flex; height: 30px; border-radius: 7px; overflow: hidden; background: var(--line); }
  .split-seg { transition: opacity .15s ease; }
  .split-seg:hover { opacity: .8; }
  .split-seg.peak { background: linear-gradient(180deg, var(--peak), color-mix(in srgb, var(--peak) 70%, black)); }
  .split-seg.off { background: linear-gradient(180deg, var(--cache), color-mix(in srgb, var(--cache) 70%, black)); }

  .callout { border: 1px solid var(--line2); border-left: 3px solid var(--warn); border-radius: 9px;
             padding: 18px 20px; background: linear-gradient(90deg, color-mix(in srgb, var(--warn) 7%, transparent), transparent 65%); }
  .callout-k { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; font-weight: 550; }
  .callout-v { font-size: 28px; font-weight: 650; letter-spacing: -0.03em; }
  .callout-n { color: var(--dim); font-size: 12.5px; margin-top: 8px; max-width: 80ch; }

  footer { color: var(--dim); font-size: 12.5px; margin-top: 40px; line-height: 1.85; max-width: 92ch; }
  footer strong { color: var(--muted); font-weight: 600; }
  footer code { background: var(--line); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
  footer p { margin: 0 0 12px; }

  @media print {
    body { background: #fff; color: #000; }
    section, .card { break-inside: avoid; border-color: #ddd; }
    .line { animation: none; stroke-dashoffset: 0; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>Koszty sesji<span class="dot">.</span></h1>
    <p class="sub">
      <b>${usd(pricedCost)}</b> w ${total.sessions} sesjach &middot; ${days.length} dni &middot; ${num(total.requests)} zadan &middot;
      ${prices.count} modeli w cenniku, pobrane ${esc(prices.age)}
    </p>
  </header>

  <div class="cards">
    <div class="card"><div class="k">Razem</div><div class="v">${usd(pricedCost)}</div><div class="n">${total.unpriced ? `+ ${short(total.unpriced)} tokenow bez ceny` : 'wszystko wycenione'}</div></div>
    <div class="card"><div class="k">Tokeny</div><div class="v">${short(total.input + total.output + total.cache)}</div><div class="n">${short(total.input)} in &middot; ${short(total.output)} out</div></div>
    <div class="card accent"><div class="k">Zaoszczedzone na cache</div><div class="v">${usd(total.cacheSaving)}</div><div class="n">${cacheShareOfBill.toFixed(0)}% rachunku to odczyt z cache</div></div>
    <div class="card warnc"><div class="k">Tokeny rozumowania</div><div class="v">${short(total.reasoning)}</div><div class="n">${total.output ? `${(total.reasoning / total.output * 100).toFixed(0)}% outputu, płatne jak output` : 'brak danych'}</div></div>
    <div class="card"><div class="k">Tury / kroki</div><div class="v">${num(sessions.reduce((a, s) => a + s.turns, 0))}</div><div class="n">${num(sessions.reduce((a, s) => a + s.steps, 0))} krokow</div></div>
    <div class="card"><div class="k">Szczyt</div><div class="v">${hasTariff ? `${(total.costPeak / peakTotal * 100).toFixed(1)}%` : '—'}</div><div class="n">${hasTariff ? `${usd(peakPremium)} do odzyskania` : 'brak danych taryfowych'}</div></div>
  </div>

  <section>
    <h2>Kiedy pracujesz <span class="hint">czas lokalny, ${esc(tz)}</span></h2>
    <p class="lead">Kazda komorka to jedna godzina jednego dnia tygodnia, zbiorczo ze wszystkich sesji.
    <strong>Przerywana czerwona obwodka</strong> oznacza okna szczytowe DeepSeeka &mdash; w Twojej strefie
    to <strong>${esc(windows[0])}</strong> i <strong>${esc(windows[1])}</strong>, od poniedzialku do piatku.
    DeepSeek liczy je w UTC, a Twoja strefa przesuwa sie z czasem letnim, wiec te godziny zmieniaja sie w roku.</p>
    ${heatmap(hourly)}
  </section>

  <section>
    <h2>Koszt w czasie</h2>
    ${timeChart(byDay)}
  </section>

  ${hasTariff ? `
  <section>
    <h2>Taryfa szczyt i pozaszczyt</h2>
    <p class="lead">Pozaszczyt to <strong>polowa ceny szczytu</strong>. Kazde zadanie jest wyceniane po taryfie,
    w ktorej faktycznie sie wydarzylo, a nie jedna stawka za cala sesje.</p>
    <div class="split-bar" style="margin-bottom:14px">
      <div class="split-seg peak" style="width:${(total.costPeak / peakTotal * 100).toFixed(2)}%" title="szczyt ${usd(total.costPeak)}"></div>
      <div class="split-seg off" style="width:${(total.costOffPeak / peakTotal * 100).toFixed(2)}%" title="pozaszczyt ${usd(total.costOffPeak)}"></div>
    </div>
    <div class="legend" style="margin-top:0;margin-bottom:22px">
      <span><i style="background:var(--peak)"></i>szczyt ${usd(total.costPeak)} &middot; ${(total.costPeak / peakTotal * 100).toFixed(1)}% &middot; ${num(total.peaked)} zadan</span>
      <span><i style="background:var(--cache)"></i>pozaszczyt ${usd(total.costOffPeak)} &middot; ${(total.costOffPeak / peakTotal * 100).toFixed(1)}% &middot; ${num(total.offPeaked)} zadan</span>
    </div>
    <div class="callout">
      <div class="callout-k">Do odzyskania przez przesuniecie pracy poza szczyt</div>
      <div class="callout-v">${usd(peakPremium)}</div>
      <div class="callout-n">Sam szczyt kosztuje tyle ponad stawke pozaszczytowa: te same zadania kosztowalyby
      ${usd(total.costPeak / 2)} zamiast ${usd(total.costPeak)}. Nie liczac chinskich swiat, ktorych ten raport
      nie wykrywa &mdash; wtedy kwota jest nieco zawyzona.</div>
    </div>
  </section>` : ''}

  <section>
    <h2>Ile daje cache</h2>
    <p class="lead">Odczyt z cache jest rozliczany osobno i jest <strong>kilkadziesiat razy tanszy</strong> od
    zwyklego wejscia. Ponizej: ile te odczyty kosztowaly, ile kosztowalyby po stawce cache-miss, i ile to razem oszczedza.</p>
    <div class="cards" style="margin-bottom:0">
      <div class="card"><div class="k">Odczytow z cache</div><div class="v">${short(total.cache)}</div><div class="n">${cachePct.toFixed(1)}% calego wejscia</div></div>
      <div class="card"><div class="k">Zaplacono za nie</div><div class="v">${usd(total.cacheWouldCost)}</div><div class="n">${cacheShareOfBill.toFixed(1)}% rachunku</div></div>
      <div class="card"><div class="k">Bez cache</div><div class="v">${usd(total.cacheWouldCost + total.cacheSaving)}</div><div class="n">po stawce cache-miss</div></div>
      <div class="card accent"><div class="k">Zaoszczedzone</div><div class="v">${usd(total.cacheSaving)}</div><div class="n">${total.cacheWouldCost + total.cacheSaving > 0 ? `${(total.cacheSaving / (total.cacheWouldCost + total.cacheSaving) * 100).toFixed(1)}% tej pozycji` : ''}</div></div>
    </div>
  </section>

  <section>
    <h2>Koszt wedlug modelu</h2>
    ${modelBars(byModel)}
  </section>

  <section>
    <h2>Tokeny wedlug modelu</h2>
    ${tokenBars(byModel)}
    <div class="legend">
      <span><i style="background:var(--in)"></i>input (cache miss)</span>
      <span><i style="background:var(--out)"></i>output</span>
      <span><i style="background:var(--cache)"></i>cache (hit)</span>
    </div>
  </section>

  <section>
    <h2>Sesje <span class="hint">kliknij naglowek, aby posortowac</span></h2>
    <table id="sessions">
      <thead><tr>
        <th data-sortable data-type="num">Czas</th>
        <th data-sortable data-type="text">Workspace</th>
        <th class="num" data-sortable data-type="num">Tury</th>
        <th class="num" data-sortable data-type="num">Kroki</th>
        <th class="num" data-sortable data-type="num">Tokeny</th>
        <th class="num" data-sortable data-type="num">Koszt</th>
        <th>Modele</th>
      </tr></thead>
      <tbody>${sessionRows}</tbody>
    </table>
  </section>

  <footer>
    <p><strong>Skad te liczby.</strong> Z trwalego logu sesji, tego samego ktory czyta okno statystyk w GUI.
    Nie ma tam wiersza kosztu i zaden sie nie da wlaczyc: harness zna pole <code>cost</code>, ale nic go nie
    wypelnia i nic nie czyta. Ten raport wycenia log po stawkach, ktore gatewaye faktycznie licza.</p>
    <p><strong>Model.</strong> Kazda wiadomosc nosi zuzycie, ale nie nazwy modelu, wiec brany jest
    <code>config</code> z najblizszego wczesniejszego <code>request/header</code>. Sesja, ktora zmieniala modele,
    jest wyceniona per zadanie, a nie jedna stawka.</p>
    <p><strong>Cache.</strong> <code>totalTokens = input + output + cacheRead</code>, czyli
    <code>inputTokens</code> nie zawiera odczytow z cache i trzy pozycje rozliczaja sie osobno.</p>
    <p><strong>Strefa.</strong>Rozliczenie szczytu idzie w UTC, tak jak definiuje go DeepSeek. Godziny na
    wykresie i w opisie sa w Twojej strefie (${esc(tz)}), wiec przesuwaja sie razem z czasem letnim.</p>
    ${overrides ? `<p><strong>Nadpisania.</strong> ${overrides} model(i) wycenione z <code>prices.json</code>, bo zaden gateway ich nie podaje.</p>` : ''}
    <p>Wygenerowane przez <code>session-cost.mjs --html</code>. Plik jest samowystarczalny: otwiera sie offline,
    bez sieci i bez bibliotek. Sortowanie tabeli to kilkanascie linii zwyklego JavaScriptu; strona czyta sie
    poprawnie takze bez niego.</p>
  </footer>

</div>

<script type="application/json" id="data">${safeJson}</script>
<script>
(function () {
  // sortable table
  var table = document.getElementById('sessions')
  if (table) {
    var ths = table.querySelectorAll('th[data-sortable]')
    Array.prototype.forEach.call(ths, function (th, idx) {
      th.addEventListener('click', function () {
        var tbody = table.tBodies[0]
        var rows = Array.prototype.slice.call(tbody.rows)
        var asc = !th.classList.contains('asc')
        Array.prototype.forEach.call(ths, function (o) { o.classList.remove('asc', 'desc') })
        th.classList.add(asc ? 'asc' : 'desc')
        rows.sort(function (a, b) {
          var x = a.cells[idx].getAttribute('data-sort') || a.cells[idx].textContent.trim()
          var y = b.cells[idx].getAttribute('data-sort') || b.cells[idx].textContent.trim()
          var nx = parseFloat(x), ny = parseFloat(y)
          var cmp = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : String(x).localeCompare(String(y), 'pl')
          return asc ? cmp : -cmp
        })
        rows.forEach(function (r) { tbody.appendChild(r) })
      })
    })
  }

  // chart tooltips
  var tip = document.getElementById('tip-time')
  if (tip) {
    var wrap = tip.parentElement
    wrap.addEventListener('mousemove', function (e) {
      var t = e.target
      if (!t.classList || !t.classList.contains('hit')) { tip.classList.remove('on'); return }
      var r = wrap.getBoundingClientRect()
      tip.style.left = (e.clientX - r.left) + 'px'
      tip.style.top = (e.clientY - r.top) + 'px'
      tip.innerHTML = '<b>' + t.getAttribute('data-day') + '</b><br>' +
        t.getAttribute('data-cost') + ' &middot; ' + t.getAttribute('data-sessions') + ' sesji<br>' +
        t.getAttribute('data-tokens') + ' tokenow'
      tip.classList.add('on')
    })
    wrap.addEventListener('mouseleave', function () { tip.classList.remove('on') })
  }

  // heatmap tooltips reuse the same element style
  var hmTip = document.createElement('div')
  hmTip.className = 'tip'
  document.body.appendChild(hmTip)
  document.addEventListener('mousemove', function (e) {
    var c = e.target
    if (!c.classList || !c.classList.contains('hm-cell')) { hmTip.classList.remove('on'); return }
    hmTip.innerHTML = '<b>' + c.getAttribute('data-d') + ' ' + c.getAttribute('data-h') + ':00</b><br>' +
      c.getAttribute('data-cost') + ' &middot; ' + c.getAttribute('data-req') + ' zadan<br>' +
      c.getAttribute('data-tok') + ' tokenow'
    hmTip.style.left = e.clientX + 'px'
    hmTip.style.top = (e.clientY - 12) + 'px'
    hmTip.classList.add('on')
  })

  // bars grow in once the page is idle, so the motion is seen rather than missed
  var grow = function () {
    Array.prototype.forEach.call(document.querySelectorAll('.bar-fill[data-w]'), function (el) {
      el.style.width = el.getAttribute('data-w') + '%'
    })
  }
  if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(grow, 60) })
  else grow()
})()
</script>
</body>
</html>`
}
