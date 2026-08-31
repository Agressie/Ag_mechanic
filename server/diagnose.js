/*
 * ag_mechanic - what a player knows about a vehicle
 * ============================================================================
 * You cannot fix what you have not found, so every repair checks this file
 * first. Knowledge is held per player, per vehicle, per *component*, because the
 * two diagnostic tools find different things:
 *
 *   scan        the control modules report a fault, with a code and a location.
 *               Exact, but blind to anything without a sensor on it.
 *   inspection  hands and eyes on the vehicle. Sees everything, but how much it
 *               tells you depends on how well the minigame went.
 *
 * The report is *derived* from that knowledge every time it is asked for, rather
 * than stored and patched. A repair only has to update one number, and the
 * report is right again by construction.
 * ============================================================================
 */

AGM.diagnose = {};

/**
 * `${vehicleKey}:${citizenid}` -> {
 *   entries:  { [componentId]: { precision, source, at } },
 *   snapshot: { [componentId]: health when it was learnt },
 *   quality:  best inspection quality so far, or null,
 *   scanned:  timestamp of the last scan, or 0,
 *   at:       last time anything was learnt
 * }
 */
const knowledge = new Map();

const bookKey = (vehicleKey, citizenid) => `${vehicleKey}:${citizenid}`;

function book(vehicleKey, citizenid, create = false) {
    const key = bookKey(vehicleKey, citizenid);
    let entry = knowledge.get(key);
    if (!entry && create) {
        entry = { entries: {}, snapshot: {}, quality: null, scanned: 0, at: Date.now() };
        knowledge.set(key, entry);
    }
    return entry || null;
}

/**
 * Drops anything that has gone out of date: entries older than the TTL, and
 * entries for components that have moved more than the drift allowance since
 * they were learnt. Per component rather than wholesale, so one part changing
 * does not throw away everything the mechanic knows about the rest of the car.
 */
function prune(entry, record) {
    if (!entry) return null;

    const ttl = AGM.Config.diagnose.reportTtl;
    const drift = AGM.Config.diagnose.reportDriftInvalidate;
    const now = Date.now();

    for (const [id, known] of Object.entries(entry.entries)) {
        const expired = now - known.at > ttl;
        const was = entry.snapshot[id];
        const current = record ? record.health[id] : undefined;
        const moved = was !== undefined && current !== undefined && Math.abs(current - was) > drift;

        if (expired || moved) {
            delete entry.entries[id];
            delete entry.snapshot[id];
        }
    }

    /* An emptied book is left in place; sweep() collects it later. Callers all
       check for an empty entries set anyway. */
    return entry;
}

/* ------------------------------------------------------------------ learning */

/**
 * Records what a player now knows. `entries` is { componentId: precision },
 * where precision is 'exact' (a figure) or 'band' (a rough condition).
 */
AGM.diagnose.learn = function (record, citizenid, entries, meta = {}) {
    const entry = book(record.key, citizenid, true);
    const now = Date.now();

    for (const [id, precision] of Object.entries(entries)) {
        if (!AGM.Components.get(record.blueprint, id)) continue;

        const existing = entry.entries[id];
        /* Never downgrade what somebody already knows. */
        const best = existing && existing.precision === 'exact' ? 'exact' : precision;

        entry.entries[id] = { precision: best, source: meta.source || 'inspection', at: now };
        entry.snapshot[id] = record.health[id];
    }

    if (meta.source === 'scan') entry.scanned = now;
    if (meta.quality) {
        const order = ['vague', 'partial', 'good', 'perfect'];
        if (!entry.quality || order.indexOf(meta.quality) > order.indexOf(entry.quality)) {
            entry.quality = meta.quality;
        }
    }
    entry.at = now;
    return entry;
};

/** Has this player found this component? Gates every repair. */
AGM.diagnose.knows = function (vehicleKey, citizenid, componentId) {
    const entry = book(vehicleKey, citizenid);
    if (!entry) return false;

    const record = AGM.vehicles.peek(vehicleKey);
    prune(entry, record);
    return !!entry.entries[componentId];
};

/** True when the player knows anything at all about this vehicle. */
AGM.diagnose.hasAny = function (vehicleKey, citizenid) {
    const entry = book(vehicleKey, citizenid);
    if (!entry) return false;
    prune(entry, AGM.vehicles.peek(vehicleKey));
    return Object.keys(entry.entries).length > 0;
};

/**
 * Folds a completed repair back in. The mechanic who just fitted the part knows
 * exactly what state it is in, so the entry is refreshed rather than aged out by
 * its own change.
 */
AGM.diagnose.noteRepair = function (vehicleKey, blueprint, componentId, value) {
    for (const [key, entry] of knowledge) {
        if (!key.startsWith(`${vehicleKey}:`)) continue;
        if (!entry.entries[componentId]) continue;

        entry.entries[componentId] = {
            precision: 'exact',
            source: entry.entries[componentId].source,
            at: Date.now(),
        };
        entry.snapshot[componentId] = value;
    }
};

/** Forgets everything about a vehicle, for every player. */
AGM.diagnose.forget = function (vehicleKey) {
    for (const key of Array.from(knowledge.keys())) {
        if (key.startsWith(`${vehicleKey}:`)) knowledge.delete(key);
    }
};

AGM.diagnose.sweep = function () {
    const ttl = AGM.Config.diagnose.reportTtl;
    const now = Date.now();
    for (const [key, entry] of knowledge) {
        if (now - entry.at > ttl * 2) knowledge.delete(key);
    }
};

/* -------------------------------------------------------------------- report */

/**
 * Builds the report from what this player currently knows plus the vehicle's
 * real condition. Components they have not found are marked unknown rather than
 * guessed at.
 */
AGM.diagnose.report = function (record, citizenid) {
    const entry = book(record.key, citizenid);
    if (!entry) return null;
    prune(entry, record);
    if (!Object.keys(entry.entries).length) return null;

    const blueprint = record.blueprint;
    const groups = [];
    const revealed = [];
    const codesByComponent = new Map();

    /* Codes are only attached where the player learnt from a scan. */
    if (entry.scanned) {
        for (const code of AGM.scanner.codes(record)) {
            if (!entry.entries[code.component]) continue;
            if (entry.entries[code.component].source !== 'scan') continue;
            if (!codesByComponent.has(code.component)) codesByComponent.set(code.component, []);
            codesByComponent.get(code.component).push({
                code: code.code, desc: code.desc, status: code.status, severity: code.severity,
            });
        }
    }

    for (const groupDef of AGM.Components.groups) {
        const items = [];

        for (const comp of AGM.Components.list(blueprint)) {
            if (comp.group !== groupDef.id) continue;

            const value = Number.isFinite(record.health[comp.id]) ? record.health[comp.id] : 100;
            const known = entry.entries[comp.id];
            const band = AGM.Health.band(value, comp);
            const needsWork = AGM.Health.needsService(value, comp);
            const location = AGM.scanner.resolveLocation(record, comp.id);

            /* A dead part announces itself whether you diagnosed it or not. */
            const audible = AGM.Health.isDead(value, comp);
            const unknown = !known && !audible;

            items.push({
                id: comp.id,
                label: comp.label,
                critical: !!comp.critical,
                dead: audible,
                required: needsWork,
                method: AGM.Health.repairMethod(comp, value),
                part: comp.part,
                partLabel: comp.part ? AGM.Shop.label(comp.part) : null,
                field: AGM.Health.canFieldRepair(comp, value),
                fieldItems: AGM.Health.fieldItems(comp),
                health: known && known.precision === 'exact' ? value : null,
                band: unknown ? null : band.id,
                bandLabel: unknown ? null : band.label,
                unknown,
                source: known ? known.source : null,
                where: location.where || null,
                scannable: AGM.Dtc.visible(blueprint, comp.id),
                codes: codesByComponent.get(comp.id) || [],
            });

            if (!unknown) revealed.push(comp.id);
        }

        if (items.length) groups.push({ id: groupDef.id, label: groupDef.label, items });
    }

    const mobile = [];
    const garage = [];
    for (const group of groups) {
        for (const item of group.items) {
            if (item.unknown || !item.required) continue;
            (item.method === 'garage' ? garage : mobile).push(item.id);
        }
    }

    /* Symptoms are earned by inspecting, not by plugging a cable in - the wear
       history is something you read off the vehicle, not the ECU. */
    const quality = entry.quality;
    const symptoms = quality === 'perfect' || quality === 'good'
        ? record.symptoms.slice(0, 4).map((s) => ({ label: AGM.Damage.label(s.source), count: s.count }))
        : quality === 'partial'
            ? record.symptoms.slice(0, 1).map((s) => ({ label: AGM.Damage.label(s.source), count: s.count }))
            : [];

    const overall = AGM.Health.overall(blueprint, record.health);
    const total = AGM.Components.ids(blueprint).length;

    return {
        plate: record.plate,
        blueprint,
        blueprintLabel: AGM.Classes.labels[blueprint] || blueprint,
        quality,
        scanned: entry.scanned,
        inspected: !!quality,
        coverage: { known: revealed.length, total },
        at: entry.at,
        expiresAt: entry.at + AGM.Config.diagnose.reportTtl,
        /* An overall figure is only honest once most of the vehicle is known. */
        overall: revealed.length >= total * 0.75 ? overall : null,
        overallBand: AGM.Health.band(overall).id,
        groups,
        symptoms,
        triage: { mobile, garage, tow: garage.length > 0 },
        revealed,
        odometer: AGM.util.round(record.odometer / 1000, 1),
        summary: summarise(groups, garage, mobile, revealed.length, total),
    };
};

function summarise(groups, garage, mobile, known, total) {
    const dead = [];
    for (const group of groups) {
        for (const item of group.items) if (item.dead && !item.unknown) dead.push(item.label);
    }

    const blindSpot = known < total * 0.6
        ? ' There is a lot of it you have not looked at yet.'
        : '';

    if (dead.length) {
        return `${dead.join(', ')} ${dead.length === 1 ? 'has' : 'have'} failed outright.`
            + (garage.length ? ' This one is going on a truck.' : ' It can still be sorted here.')
            + blindSpot;
    }
    if (garage.length) return `Needs a lift and a workshop - it will have to be brought in.${blindSpot}`;
    if (mobile.length) return `All of it can be dealt with at the roadside.${blindSpot}`;
    if (known < total) return `Nothing wrong with what you have checked.${blindSpot}`;
    return 'Nothing needs doing. It is in good order.';
}

/* --------------------------------------------------- physical inspection rpc */

/** Resolves the quality tier a minigame score buys. */
function qualityFor(score) {
    const q = AGM.Config.diagnose.quality;
    if (score >= q.perfect) return 'perfect';
    if (score >= q.good) return 'good';
    if (score >= q.partial) return 'partial';
    return 'vague';
}

/** What an inspection of that quality actually tells you, per component. */
function inspectionFindings(record, quality) {
    const findings = {};

    for (const comp of AGM.Components.list(record.blueprint)) {
        const value = Number.isFinite(record.health[comp.id]) ? record.health[comp.id] : 100;
        const needsWork = AGM.Health.needsService(value, comp);

        if (quality === 'perfect') {
            findings[comp.id] = 'exact';
        } else if (quality === 'good') {
            findings[comp.id] = needsWork ? 'exact' : 'band';
        } else if (quality === 'partial') {
            if (needsWork) findings[comp.id] = 'band';
            else if (Math.random() < 0.65) findings[comp.id] = 'band';
        } else if (needsWork) {
            findings[comp.id] = 'band';
        }
    }
    return findings;
}

/** Shared vehicle resolution for both diagnostic tools. */
const resolveVehicle = (src, args, maxExtra = 3) =>
    AGM.vehicles.resolve(src, (args || {}).netId, { maxExtra });
AGM.diagnose.resolveVehicle = resolveVehicle;

AGM.rpc.register('diagnose:submit', async (src, args) => {
    const ctx = await resolveVehicle(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const { player, record } = ctx;

    /* Getting your hands into a vehicle needs the toolbox, the same as any
       other physical work on it. */
    const tool = AGM.Config.repair.toolItem;
    if (tool && !AGM.inv.has(src, tool, 1)) return { ok: false, reason: 'noTool' };

    /* Score comes from the minigame; the bonus is decided here, where it can be
       verified - a client cannot simply claim to be a mechanic. */
    let score = Number(args.score);
    if (!Number.isFinite(score)) score = 0;
    score = AGM.util.clamp(score, 0, 1);

    if (player.job.name === AGM.Config.job.name) score += AGM.Config.diagnose.jobScoreBonus;
    score = AGM.util.clamp(score, 0, 1);

    const quality = qualityFor(score);
    AGM.diagnose.learn(record, player.citizenid, inspectionFindings(record, quality), {
        source: 'inspection',
        quality,
    });

    AGM.db.log('', player.name, 'inspect', { plate: record.plate, quality, score: AGM.util.round(score, 2) });

    return {
        ok: true,
        report: AGM.diagnose.report(record, player.citizenid),
        vehicleKey: record.key,
        quality,
        score: AGM.util.round(score, 2),
    };
});

/** Re-opens what the player already knows, without redoing any work. */
AGM.rpc.register('diagnose:last', async (src, args) => {
    const ctx = await resolveVehicle(src, args);
    if (ctx.error) return null;

    const report = AGM.diagnose.report(ctx.record, ctx.player.citizenid);
    return report ? { ok: true, report, vehicleKey: ctx.record.key } : null;
});
