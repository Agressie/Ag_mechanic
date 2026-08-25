/*
 * ag_mechanic - config validator
 * ============================================================================
 * Cross-checks the config files against each other, so a typo in a part name or
 * a source that targets a component no vehicle has is caught at the terminal
 * instead of at 3am when a mechanic cannot fit a clutch.
 *
 *   node tools/validate.js
 *
 * Exits non-zero if anything is wrong. Safe to wire into CI.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* The config files expect FiveM's globals; only these two are actually used at
   load time, so stubbing them is enough to require the files under plain Node. */
global.GetCurrentResourceName = () => 'ag_mechanic';
global.IsDuplicityVersion = () => true;

for (const file of [
    'shared/namespace.js',
    'config/config.js',
    'config/classes.js',
    'config/components.js',
    'config/tiers.js',
    'config/dtc.js',
    'config/damage.js',
    'config/handling.js',
    'config/shop.js',
    'config/locations.js',
    'shared/util.js',
    'shared/health.js',
]) {
    require(path.join(ROOT, file));
}

const AGM = global.AGM;
let problems = 0;
const bad = (m) => { console.log('  x ' + m); problems++; };
const step = (m) => console.log(m);

// 1. every part an item references must exist in the catalogue
step('components -> catalogue');
for (const [bp, list] of Object.entries(AGM.Components.blueprints)) {
  for (const c of list) {
    if (c.part && !AGM.Shop.entry(c.part)) bad(`${bp}.${c.id} needs part '${c.part}' which is not in the catalogue`);
    for (const item of c.fieldItems || []) {
      if (c.field && !AGM.Shop.entry(item)) bad(`${bp}.${c.id} field item '${item}' is not in the catalogue`);
    }
  }
}

step('tiers -> catalogue');
for (const [bp, cats] of Object.entries(AGM.Tiers.byBlueprint)) {
  for (const [cat, def] of Object.entries(cats)) {
    def.tiers.forEach((t, i) => {
      if (i === 0 && t.item) bad(`${bp}.${cat} tier 0 should be the stock part but wants '${t.item}'`);
      if (i > 0 && !t.item) bad(`${bp}.${cat} tier ${i} (${t.label}) has no item`);
      if (t.item && !AGM.Shop.entry(t.item)) bad(`${bp}.${cat} tier ${i} item '${t.item}' is not in the catalogue`);
      if (!['mobile', 'garage'].includes(t.install)) bad(`${bp}.${cat} tier ${i} bad install '${t.install}'`);
    });
  }
}

step('config items -> catalogue');
for (const item of [AGM.Config.tablet.item, AGM.Config.repair.toolItem, AGM.Config.diagnose.scannerItem, ...AGM.Config.repair.improvisedItems]) {
  if (item && !AGM.Shop.entry(item)) bad(`config references item '${item}' which is not in the catalogue`);
}

step('damage sources -> components');
for (const [id, src] of Object.entries(AGM.Damage.sources)) {
  for (const bp of src.blueprints) {
    if (!AGM.Components.blueprints[bp]) { bad(`source '${id}' targets unknown blueprint '${bp}'`); continue; }
    const ids = new Set(AGM.Components.ids(bp));
    const hits = Object.keys(src.weights).filter((k) => ids.has(k));
    if (!hits.length) bad(`source '${id}' applies to '${bp}' but matches none of its components`);
  }
  for (const k of Object.keys(src.weights)) {
    const anywhere = Object.keys(AGM.Components.blueprints).some((bp) => AGM.Components.get(bp, k));
    if (!anywhere) bad(`source '${id}' weights unknown component '${k}'`);
  }
}

step('sources used by the client monitor exist');
const monitor = fs.readFileSync(path.join(ROOT, 'client', 'monitor.js'), 'utf8');
for (const m of monitor.matchAll(/add\('([a-z_]+)'/g)) {
  if (!AGM.Damage.sources[m[1]]) bad(`monitor.js adds unknown source '${m[1]}'`);
}

step('handling axes exist');
for (const [bp, entries] of Object.entries(AGM.Handling)) {
  if (bp === 'crippled') continue;
  if (!AGM.Components.blueprints[bp]) { bad(`handling map for unknown blueprint '${bp}'`); continue; }
  for (const e of entries) for (const axis of e.axes) {
    if (!AGM.Components.axes[axis]) bad(`${bp} handling '${e.field}' uses unknown axis '${axis}'`);
    if (AGM.Components.axisTotal(bp, axis) <= 0) bad(`${bp} handling '${e.field}' uses axis '${axis}' that no ${bp} component affects`);
  }
}

step('component groups are declared');
const groups = new Set(AGM.Components.groups.map((g) => g.id));
for (const [bp, list] of Object.entries(AGM.Components.blueprints)) {
  for (const c of list) if (!groups.has(c.group)) bad(`${bp}.${c.id} has undeclared group '${c.group}'`);
}

step('every blueprint has at least one critical part and is repairable');
for (const bp of Object.keys(AGM.Components.blueprints)) {
  const list = AGM.Components.list(bp);
  if (!list.some((c) => c.critical)) bad(`${bp} has no critical component`);
  if (!list.some((c) => c.field)) bad(`${bp} has nothing that can be bodged`);
  if (!list.some((c) => AGM.Health.repairMethod(c, 100) === 'garage')) bad(`${bp} has no workshop-only work`);
}

step('dtc -> components');
{
    const TOKENS = {
        cylinder: ['cyl', 'bank'],
        bank: ['bank'],
        wheel: ['wheel'],
        blade: ['n'],
        wing: ['wing'],
        fixed: ['bank'],
    };

    for (const [bp, set] of Object.entries(AGM.Dtc.sets)) {
        if (!AGM.Components.blueprints[bp]) { bad(`dtc set for unknown blueprint '${bp}'`); continue; }
        const ids = AGM.Components.ids(bp);

        for (const id of Object.keys(set)) {
            if (!ids.includes(id)) bad(`dtc: ${bp}.${id} is not a component of ${bp}`);
        }
        for (const id of ids) {
            if (!set[id]) bad(`dtc: ${bp}.${id} has no entry, so it is neither scannable nor documented`);
        }

        for (const [id, entry] of Object.entries(set)) {
            if (!ids.includes(id)) continue;

            if (!TOKENS[entry.location]) bad(`dtc: ${bp}.${id} has unknown location kind '${entry.location}'`);
            if (!entry.where) bad(`dtc: ${bp}.${id} has no 'where' text`);
            if (entry.module && !AGM.Dtc.modules.some((m) => m.id === entry.module)) {
                bad(`dtc: ${bp}.${id} reports to unknown module '${entry.module}'`);
            }
            if (entry.ecu !== false && !entry.codes.length) {
                bad(`dtc: ${bp}.${id} is marked visible but has no codes`);
            }

            /* A placeholder the location kind cannot fill would render as
               literal "{cyl}" on the scanner. */
            const allowed = TOKENS[entry.location] || [];
            const texts = entry.codes.flatMap((c) => [c.code, c.desc]).concat([entry.where]);
            for (const text of texts) {
                for (const match of String(text).matchAll(/\{(\w+)\}/g)) {
                    if (!allowed.includes(match[1])) {
                        bad(`dtc: ${bp}.${id} uses {${match[1]}} but its location is '${entry.location}'`);
                    }
                }
            }

            for (const code of entry.codes) {
                if (!(code.at > 0 && code.at <= 100)) bad(`dtc: ${bp}.${id} code ${code.code} has an out-of-range threshold ${code.at}`);
                if (!['low', 'medium', 'high'].includes(code.severity)) {
                    bad(`dtc: ${bp}.${id} code ${code.code} has bad severity '${code.severity}'`);
                }
            }
        }
    }
}

step('both diagnostic tools matter on every machine');
for (const bp of Object.keys(AGM.Components.blueprints)) {
    const visible = AGM.Dtc.visibleComponents(bp);
    const hidden = AGM.Components.ids(bp).filter((id) => !visible.includes(id));
    if (!visible.length) bad(`${bp} has nothing the scanner can read`);
    if (!hidden.length) bad(`${bp} has nothing that needs a hands-on inspection`);
}

step('locations sanity');
for (const shop of AGM.Locations.shops) {
  if (!shop.bays || !shop.bays.length) bad(`shop '${shop.id}' has no bays`);
  if (!shop.stash) bad(`shop '${shop.id}' has no stash`);
  if (shop.job !== AGM.Config.job.name) bad(`shop '${shop.id}' job '${shop.job}' != Config.job.name '${AGM.Config.job.name}'`);
  const d = shop.delivery;
  for (const mark of ['spawn', 'park', 'drop', 'sign', 'exit']) {
    if (!d || !d[mark] || !Array.isArray(d[mark].coords)) bad(`shop '${shop.id}' delivery is missing '${mark}'`);
  }
}

step('tablet apps map to grades that exist');
for (const app of AGM.Config.tablet.apps) {
  if (AGM.Config.job.grades[app.grade] === undefined) bad(`app '${app.id}' needs grade ${app.grade}, which is not defined`);
}

console.log(problems ? `\n${problems} problem(s) found` : '\nall cross-references clean');
