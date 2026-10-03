// Renders the cost report as one self-contained HTML file: no CDN, no external font, no build step,
// so it opens straight from the filesystem and can be sent as a single attachment.
//
// Charts are hand-written SVG rather than a library. The dataset is a few dozen sessions and a dozen
// models, so a charting dependency would be larger than the data it draws and would need to be
// either fetched or inlined anyway.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const usd = (n) => (n < 0.01 && n > 0 ? `$${n.toFixed(5)}` : `$${n.toFixed(n < 1 ? 4 : 2)}`)
const num = (n) => n.toLocaleString('en-US')
const short = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

// ── aggregation ─────────────────────────────────────────────────────────────

function aggregate(sessions) {
  const byModel = new Map()
  const byDay = new Map()
  const total = { cost: 0, input: 0, output: 0, cache: 0, requests: 0, sessions: 0, unpriced: 0 }

  for (const s of sessions) {
    let scost = 0
    for (const [model, a] of Object.entries(s.byModel)) {
      const m = byModel.get(model) ?? { cost: 0, input: 0, output: 0, cache: 0, requests: 0, sessions: 0, priced: a.priced }
      m.cost += a.cost; m.input += a.input; m.output += a.output; m.cache += a.cache; m.requests += a.requests; m.sessions++
      m.priced = m.priced || a.priced
      byModel.set(model, m)
      scost += a.cost
      total.input += a.input; total.output += a.output; total.cache += a.cache; total.requests += a.requests
      if (!a.priced) total.unpriced += a.input + a.output + a.cache
    }
    total.cost += scost
    total.sessions++

    const day = new Date(s.mtime).toISOString().slice(0, 10)
    const d = byDay.get(day) ?? { cost: 0, tokens: 0, sessions: 0 }
    d.cost += scost
    d.sessions++
    for (const a of Object.values(s.byModel)) d.tokens += a.input + a.output + a.cache
    byDay.set(day, d)
  }
  return { byModel, byDay, total }
}

// ── svg pieces ──────────────────────────────────────────────────────────────

function timeChart(byDay) {
  const days = [...byDay.entries()].sort()
  if (days.length < 2) return '<p class="muted">Za malo dni na wykres czasu.</p>'
  const W = 900, H = 260, P = { l: 70, r: 20, t: 16, b: 40 }
  const max = Math.max(...days.map(([, d]) => d.cost)) || 1
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const x = (i) => P.l + (i / (days.length - 1)) * iw
  const y = (v) => P.t + ih - (v / max) * ih

  const line = days.map(([, d], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.cost).toFixed(1)}`).join(' ')
  const area = `${line} L${x(days.length - 1).toFixed(1)},${P.t + ih} L${P.l},${P.t + ih} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = max * f
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/>
            <text x="${P.l - 8}" y="${(y(v) + 4).toFixed(1)}" class="axis" text-anchor="end">${usd(v)}</text>`
  }).join('')
  const pts = days.map(([day, d], i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(d.cost).toFixed(1)}" r="3.5" class="dot"><title>${day}: ${usd(d.cost)}, ${d.sessions} sesji</title></circle>`).join('')
  const labels = days.map(([day], i) =>
    i % Math.ceil(days.length / 8) === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - 12}" class="axis" text-anchor="middle">${day.slice(5)}</text>` : '').join('')

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Koszt w czasie">
    ${grid}<path d="${area}" class="area"/><path d="${line}" class="line"/>${pts}${labels}</svg>`
}

function modelBars(byModel, top = 12) {
  const rows = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, top)
  if (!rows.length) return '<p class="muted">Brak danych.</p>'
  const max = Math.max(...rows.map(([, m]) => m.cost)) || 1
  return rows.map(([model, m]) => `
    <div class="bar-row">
      <div class="bar-label" title="${esc(model)}">${esc(model)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(m.cost / max * 100).toFixed(2)}%"></div></div>
      <div class="bar-value">${m.priced ? usd(m.cost) : '?'}</div>
    </div>`).join('')
}

function tokenBars(byModel, top = 12) {
  const rows = [...byModel.entries()].sort((a, b) => (b[1].input + b[1].output + b[1].cache) - (a[1].input + a[1].output + a[1].cache)).slice(0, top)
  const max = Math.max(...rows.map(([, m]) => m.input + m.output + m.cache)) || 1
  return rows.map(([model, m]) => {
    const t = m.input + m.output + m.cache
    const p = (v) => (v / max * 100).toFixed(2)
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
  const { sessions, generatedAt, prices, overrides } = data
  const { byModel, byDay, total } = aggregate(sessions)
  const days = [...byDay.keys()].sort()
  const pricedCost = total.cost
  const cacheShare = total.input + total.cache > 0 ? total.cache / (total.input + total.cache) * 100 : 0

  const sessionRows = [...sessions].sort((a, b) => b.mtime - a.mtime).map((s) => {
    let cost = 0, tokens = 0, unpriced = 0
    const models = Object.entries(s.byModel).sort((a, b) => b[1].cost - a[1].cost)
    for (const [, a] of models) { cost += a.cost; tokens += a.input + a.output + a.cache; if (!a.priced) unpriced += a.input + a.output + a.cache }
    return `<tr>
      <td class="mono">${new Date(s.mtime).toISOString().slice(0, 16).replace('T', ' ')}</td>
      <td>${esc(s.workspace)}</td>
      <td class="num">${s.turns}</td>
      <td class="num">${s.steps}</td>
      <td class="num">${short(tokens)}</td>
      <td class="num strong">${usd(cost)}${unpriced ? ' <span class="warn" title="tokeny bez znanej ceny">?</span>' : ''}</td>
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
    --bg: #0f1115; --panel: #171a21; --line: #262b36; --fg: #e6e9ef;
    --muted: #8b93a5; --accent: #6ea8fe; --in: #4c7dd8; --out: #e0a458; --cache: #4f9e7a;
    --warn: #e0a458;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f7f8fa; --panel:#fff; --line:#e3e6ec; --fg:#1a1d23; --muted:#6b7280; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 40px 24px 64px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; font-weight: 600; }
  h2 { font-size: 15px; margin: 0 0 16px; color: var(--muted); font-weight: 500; letter-spacing: .02em; text-transform: uppercase; }
  .sub { color: var(--muted); margin: 0 0 32px; font-size: 13px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 34px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; }
  .card .k { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
  .card .v { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .card .n { color: var(--muted); font-size: 12px; margin-top: 6px; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 24px; margin-bottom: 20px; }
  .chart { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .axis { fill: var(--muted); font-size: 11px; }
  .line { fill: none; stroke: var(--accent); stroke-width: 2; }
  .area { fill: var(--accent); opacity: .12; }
  .dot { fill: var(--accent); }
  .bar-row { display: grid; grid-template-columns: minmax(140px, 260px) 1fr 92px; gap: 12px; align-items: center; margin-bottom: 7px; }
  .bar-label { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { background: var(--line); border-radius: 4px; height: 18px; overflow: hidden; display: flex; }
  .bar-fill { background: var(--accent); border-radius: 4px; }
  .seg { height: 100%; }
  .seg-in { background: var(--in); } .seg-out { background: var(--out); } .seg-cache { background: var(--cache); }
  .bar-value { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 0 10px 10px 0; border-bottom: 1px solid var(--line); }
  td { padding: 9px 10px 9px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 600; }
  .mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }
  .muted { color: var(--muted); }
  .warn { color: var(--warn); cursor: help; }
  .models { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { background: var(--line); color: var(--muted); border-radius: 4px; padding: 1px 6px; font-size: 11px; white-space: nowrap; }
  .legend { display: flex; gap: 18px; color: var(--muted); font-size: 12px; margin-top: 12px; flex-wrap: wrap; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
  footer { color: var(--muted); font-size: 12px; margin-top: 28px; line-height: 1.7; }
  code { background: var(--line); padding: 1px 5px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">

  <h1>Koszty sesji</h1>
  <p class="sub">Wygenerowano ${esc(generatedAt)} &middot; ${prices.count} modeli w cenniku, pobrane ${prices.age} &middot; zrodla: ${esc(prices.sources)}</p>

  <div class="cards">
    <div class="card"><div class="k">Razem</div><div class="v">${usd(pricedCost)}</div><div class="n">${total.unpriced ? `+ ${short(total.unpriced)} tokenow bez ceny` : 'wszystko wycenione'}</div></div>
    <div class="card"><div class="k">Sesje</div><div class="v">${total.sessions}</div><div class="n">${days.length} dni</div></div>
    <div class="card"><div class="k">Zadania</div><div class="v">${num(total.requests)}</div><div class="n">wywolania modelu</div></div>
    <div class="card"><div class="k">Tokeny</div><div class="v">${short(total.input + total.output + total.cache)}</div><div class="n">${short(total.input)} in &middot; ${short(total.output)} out</div></div>
    <div class="card"><div class="k">Cache</div><div class="v">${cacheShare.toFixed(0)}%</div><div class="n">${short(total.cache)} odczytow</div></div>
  </div>

  <section>
    <h2>Koszt w czasie</h2>
    ${timeChart(byDay)}
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
    <h2>Sesje</h2>
    <table>
      <thead><tr><th>Czas</th><th>Workspace</th><th class="num">Tury</th><th class="num">Kroki</th><th class="num">Tokeny</th><th class="num">Koszt</th><th>Modele</th></tr></thead>
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
    ${overrides ? `<p><strong>Nadpisania.</strong> ${overrides} model(i) wycenione z <code>prices.json</code>, bo zaden gateway ich nie podaje.</p>` : ''}
    <p>Wygenerowane przez <code>session-cost.mjs --html</code>. Plik jest samowystarczalny: otwiera sie offline, bez sieci i bez bibliotek.</p>
  </footer>

</div>
<script type="application/json" id="data">${safeJson}</script>
</body>
</html>`
}
