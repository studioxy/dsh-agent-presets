// Validates all four preset bundle patches that now live in the git-backed presets repository:
// YAML parse, patch dialect shape, plugin-row multiset against the source composition, MCP rows,
// customSkillDirs, and package.json wiring. ASCII-only output.
'use strict';
const fs = require('fs');
const path = require('path');

let YAML;
for (const c of ['yaml', 'C:\\Users\\andrz\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules\\yaml']) {
  try { YAML = require(c); break; } catch (e) { /* next */ }
}
if (!YAML) { console.error('FAIL: yaml package not loadable'); process.exit(2); }

const base = __dirname;
const legacyDir = 'C:\\Users\\andrz\\.dsh\\.agent-presets';
const expected = {
  powerbi: { order: 10, name: 'Power BI / Deneb', mcp: ['mcp-powerbi-modeling'], skills: 12 },
  docs:    { order: 20, name: 'Documentation / HTML / PDF', mcp: ['mcp-chrome-devtools'], skills: 12 },
  coding:  { order: 30, name: 'Software engineering', mcp: ['mcp-serena', 'mcp-context7'], skills: 38 },
  web:     { order: 40, name: 'Web development', mcp: ['mcp-context7', 'mcp-chrome-devtools'], skills: 23 },
};

let failures = 0;
const fail = (m) => { failures++; console.log('FAIL: ' + m); };
const count = (a) => a.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});

function collectIds(node, acc) {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if (typeof item.id === 'string') acc.push(item.id);
        if (item.config !== undefined) collectIds(item.config, acc);
      }
    }
  }
  return acc;
}

for (const p of Object.keys(expected)) {
  const exp = expected[p];
  const dir = path.join(base, p);
  const patchPath = path.join(dir, 'cordis.patch.yml');
  const patchText = fs.readFileSync(patchPath, 'utf8');
  if (patchText.charCodeAt(0) === 0xFEFF) fail(p + ': patch has UTF-8 BOM');

  let doc;
  try { doc = YAML.parse(patchText); } catch (e) { fail(p + ': YAML parse error: ' + e.message); continue; }
  if (!Array.isArray(doc) || doc.length !== 1) { fail(p + ': top level must be a 1-element list'); continue; }
  if (Object.keys(doc[0]).join() !== 'insert') { fail(p + ': top-level keys ' + Object.keys(doc[0]).join()); continue; }
  const rows = doc[0].insert;
  if (!Array.isArray(rows) || rows.length !== 1) { fail(p + ': insert must hold exactly 1 row'); continue; }
  const row = rows[0];
  const cfg = row.config || {};
  if (row.id !== 'preset-' + p) fail(p + ': loader id ' + row.id);
  if (row.name !== '@deepseek-ai/dsh-agent-preset') fail(p + ': loader name ' + row.name);
  if (cfg.id !== p) fail(p + ': config.id ' + cfg.id);
  if (cfg.order !== exp.order) fail(p + ': order ' + cfg.order + ' != ' + exp.order);
  if (cfg.name !== exp.name) fail(p + ': name ' + JSON.stringify(cfg.name));
  if (typeof cfg.description !== 'string' || cfg.description.length < 20) fail(p + ': description missing/short');
  if (!Array.isArray(cfg.plugins) || cfg.plugins.length === 0) fail(p + ': plugins missing');
  if (failures) continue;

  // multiset against the source composition kept beside the bundle
  const srcPath = path.join(dir, 'agent.cordis.yml.source');
  if (!fs.existsSync(srcPath)) { fail(p + ': missing agent.cordis.yml.source'); continue; }
  const legacyText = fs.readFileSync(srcPath, 'utf8');
  const legacyIds = [];
  for (const line of legacyText.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s+id:\s+(\S+)\s*$/);
    if (m) legacyIds.push(m[1]);
  }
  const pc = count(collectIds(cfg.plugins, []));
  const lc = count(legacyIds);
  const diffs = [];
  for (const n of new Set([...Object.keys(pc), ...Object.keys(lc)])) {
    if ((pc[n] || 0) !== (lc[n] || 0)) diffs.push(`${n} patch=${pc[n] || 0} source=${lc[n] || 0}`);
  }
  if ((pc['workflow-ptc'] || 0) === 1 && !(lc['workflow-ptc'] || 0) && (lc['workflow-worker-thread'] || 0) === 1) {
    for (const d of ['workflow-ptc patch=1 source=0', 'workflow-worker-thread patch=0 source=1']) {
      const i = diffs.indexOf(d); if (i >= 0) diffs.splice(i, 1);
    }
  }
  if (diffs.length) fail(p + ': plugin id multiset differs: ' + diffs.join('; '));

  const top = cfg.plugins.filter((r) => r && typeof r.id === 'string').map((r) => r.id);
  for (const m of exp.mcp) if (!top.includes(m)) fail(p + ': missing MCP row ' + m);
  if (p === 'web' && top.includes('mcp-serena')) fail('web: Serena must not be present');

  const fsRow = cfg.plugins.find((r) => r && r.id === 'skill-filesystem');
  const dirs = fsRow && fsRow.config && fsRow.config.customSkillDirs;
  const want = legacyDir + '\\' + p + '\\skills';
  if (!Array.isArray(dirs) || dirs.length !== 1 || dirs[0] !== want) {
    fail(p + ': customSkillDirs ' + JSON.stringify(dirs) + ' != ' + JSON.stringify([want]));
  }
  const onDisk = fs.readdirSync(path.join(legacyDir, p, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).length;
  if (onDisk !== exp.skills) fail(p + ': ' + onDisk + ' skill dirs on disk, expected ' + exp.skills);

  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (pkg.name !== '@local/dsh-' + p + '-preset') fail(p + ': pkg.name ' + pkg.name);
  if (!(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml')) fail(p + ': dsh.bundle.patch wrong');

  console.log(`OK ${p}: ${top.length} top-level rows, order ${cfg.order}, ${onDisk} skills, MCP ${exp.mcp.join('+')}`);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
