/*
 * ag_mechanic - diagnostics
 * ============================================================================
 * A diagnostic report is the gate on everything else: you cannot fix what you
 * have not found. How much the report tells you depends on how well the
 * minigame went, whether the person holds the job, and whether they had a
 * scanner on them.
 *
 * Reports live in memory only, keyed per vehicle *and* per player, and go stale
 * either on a timer or as soon as the vehicle's condition drifts.
 * ============================================================================
 */

AGM.diagnose = {};

/** `${vehicleKey}:${citizenid}` -> { report, snapshot, at } */
const reports = new Map();

const reportKey = (vehicleKey, citizenid) => `${vehicleKey}:${citizenid}`;

/** Resolves the quality tier a score buys. */
function qualityFor(score) {
    const q = AGM.Config.diagnose.quality;
    if (score >= q.perfect) return 'perfect';
    if (score >= q.good) return 'good';
    if (score >= q.partial) return 'partial';
    return 'vague';
}

/**
 * Builds the report. `quality` decides, per component, whether the reader gets
 * an exact figure, a band, or nothing at all.
 */
function buildReport(record, quality, whoIsMechanic) {
    const blueprint = record.blueprint;
    const health = record.health;

    const groups = [];
    const revealed = [];

    for (const groupDef of AGM.Components.groups) {
        const items = [];

        for (const comp of AGM.Components.list(blueprint)) {
            if (comp.group !== groupDef.id) continue;

            const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
            const needsWork = AGM.Health.needsService(value, comp);
            const band = AGM.Health.band(value, comp);

            let show = 'exact';
            if (quality === 'good') show = needsWork ? 'exact' : 'band';
            else if (quality === 'partial') show = needsWork ? 'band' : (Math.random() < 0.35 ? 'unknown' : 'band');
            else if (quality === 'vague') show = needsWork ? 'band' : 'unknown';

            const entry = {
                id: comp.id,
                label: comp.label,
                critical: !!comp.critical,
                dead: AGM.Health.isDead(value, comp),
                required: needsWork,
                method: AGM.Health.repairMethod(comp, value),
                part: comp.part,
                partLabel: comp.part ? AGM.Shop.label(comp.part) : null,
                field: AGM.Health.canFieldRepair(comp, value),
                fieldItems: AGM.Health.fieldItems(comp),
                health: show === 'exact' ? value : null,
                band: show === 'unknown' ? null : band.id,
                bandLabel: show === 'unknown' ? null : band.label,
                unknown: show === 'unknown',
            };

            /* A dead part is never hidden - you can hear it. */
            if (entry.unknown && entry.dead) {
                entry.unknown = false;
                entry.band = band.id;
                entry.bandLabel = band.label;
            }

            if (!entry.unknown) revealed.push(comp.id);
            items.push(entry);
        }

        if (items.length) groups.push({ id: groupDef.id, label: groupDef.label, items });
    }

    /* Triage over what the report actually revealed. */
    const mobile = [];
    const garage = [];
    for (const group of groups) {
        for (const item of group.items) {
            if (item.unknown || !item.required) continue;
            (item.method === 'garage' ? garage : mobile).push(item.id);
        }
    }

    const symptoms = quality === 'perfect' || quality === 'good'
        ? record.symptoms.slice(0, 4).map((s) => ({ label: AGM.Damage.label(s.source), count: s.count }))
        : quality === 'partial'
            ? record.symptoms.slice(0, 1).map((s) => ({ label: AGM.Damage.label(s.source), count: s.count }))
            : [];

    const overall = AGM.Health.overall(blueprint, health);

    return {
        plate: record.plate,
        blueprint,
        blueprintLabel: AGM.Classes.labels[blueprint] || blueprint,
        quality,
        mechanic: !!whoIsMechanic,
        at: Date.now(),
        expiresAt: Date.now() + AGM.Config.diagnose.reportTtl,
        overall: quality === 'perfect' || quality === 'good' ? overall : null,
        overallBand: AGM.Health.band(overall).id,
        groups,
        symptoms,
        triage: { mobile, garage, tow: garage.length > 0 },
        revealed,
        odometer: AGM.util.round(record.odometer / 1000, 1),
        summary: summarise(quality, garage, mobile, groups),
    };
}

function summarise(quality, garage, mobile, groups) {
    const dead = [];
    for (const group of groups) {
        for (const item of group.items) if (item.dead && !item.unknown) dead.push(item.label);
    }

    if (dead.length) {
        return `${dead.join(', ')} ${dead.length === 1 ? 'has' : 'have'} failed outright.`
            + (garage.length ? ' This one is going on a truck.' : ' It can still be sorted here.');
    }
    if (garage.length) return 'Needs a lift and a workshop - it will have to be brought in.';
    if (mobile.length) return 'All of it can be dealt with at the roadside.';
    if (quality === 'vague' || quality === 'partial') return 'Nothing obvious found, but the read was poor.';
    return 'Nothing needs doing. It is in good order.';
}

/** Stores a report so later repair calls can check what this player knows. */
function store(vehicleKey, citizenid, report, health) {
    reports.set(reportKey(vehicleKey, citizenid), {
        report,
        snapshot: { ...health },
        at: Date.now(),
    });
}

/**
 * The report this player holds for this vehicle, or null. Returns null once the
 * report has expired, or once the vehicle has drifted far enough that the
 * numbers on the paper are no longer true.
 */
AGM.diagnose.get = function (vehicleKey, citizenid) {
    const entry = reports.get(reportKey(vehicleKey, citizenid));
    if (!entry) return null;

    if (Date.now() > entry.report.expiresAt) {
        reports.delete(reportKey(vehicleKey, citizenid));
        return null;
    }

    const record = AGM.vehicles.peek(vehicleKey);
    if (record) {
        const drift = AGM.Config.diagnose.reportDriftInvalidate;
        for (const [id, was] of Object.entries(entry.snapshot)) {
            const now = record.health[id];
            if (now === undefined) continue;
            if (Math.abs(now - was) > drift) {
                reports.delete(reportKey(vehicleKey, citizenid));
                return null;
            }
        }
    }

    return entry.report;
};

/** Has this player diagnosed this component? Gates every repair. */
AGM.diagnose.knows = function (vehicleKey, citizenid, componentId) {
    const report = AGM.diagnose.get(vehicleKey, citizenid);
    return !!report && report.revealed.includes(componentId);
};

/**
 * Folds a completed repair into every stored report for that vehicle, instead of
 * throwing the reports away. Fixing one part should not force the mechanic to
 * crawl back under the car and re-diagnose before touching the next one.
 */
AGM.diagnose.applyRepair = function (vehicleKey, blueprint, componentId, value) {
    const comp = AGM.Components.get(blueprint, componentId);
    if (!comp) return;

    for (const [key, entry] of reports) {
        if (!key.startsWith(`${vehicleKey}:`)) continue;

        entry.snapshot[componentId] = value;
        const band = AGM.Health.band(value, comp);

        for (const group of entry.report.groups) {
            for (const item of group.items) {
                if (item.id !== componentId) continue;
                /* Somebody who could not read this part before still cannot -
                   but they can see it has just been worked on. */
                item.unknown = false;
                item.health = item.health === null ? null : value;
                if (item.health === null && entry.report.quality === 'perfect') item.health = value;
                item.band = band.id;
                item.bandLabel = band.label;
                item.dead = AGM.Health.isDead(value, comp);
                item.required = AGM.Health.needsService(value, comp);
                item.method = AGM.Health.repairMethod(comp, value);
                item.field = AGM.Health.canFieldRepair(comp, value);
            }
        }

        if (!entry.report.revealed.includes(componentId)) entry.report.revealed.push(componentId);

        /* Recompute triage from what the report now says. */
        const mobile = [];
        const garage = [];
        for (const group of entry.report.groups) {
            for (const item of group.items) {
                if (item.unknown || !item.required) continue;
                (item.method === 'garage' ? garage : mobile).push(item.id);
            }
        }
        entry.report.triage = { mobile, garage, tow: garage.length > 0 };
        entry.report.summary = summarise(entry.report.quality, garage, mobile, entry.report.groups);
    }
};

/** Invalidates every stored report for a vehicle. */
AGM.diagnose.invalidate = function (vehicleKey) {
    for (const key of reports.keys()) {
        if (key.startsWith(`${vehicleKey}:`)) reports.delete(key);
    }
};

/** Periodic cleanup of expired reports. */
AGM.diagnose.sweep = function () {
    const now = Date.now();
    for (const [key, entry] of reports) {
        if (now > entry.report.expiresAt) reports.delete(key);
    }
};

/* ---------------------------------------------------------------------- rpc */

AGM.rpc.register('diagnose:submit', async (src, args) => {
    const player = AGM.core.getPlayer(src);
    if (!player) return { ok: false, reason: 'noPlayer' };

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return { ok: false, reason: 'noVehicle' };

    const ped = GetPlayerPed(String(src));
    const a = GetEntityCoords(ped);
    const b = GetEntityCoords(entity);
    if (AGM.util.dist(a, b) > AGM.Config.security.maxInteractDistance + 3) {
        return { ok: false, reason: 'tooFar' };
    }

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const blueprint = AGM.Classes.resolve(Number(args.classId), args.model);
    if (!AGM.Classes.isSupported(blueprint)) return { ok: false, reason: 'unsupported' };

    const key = AGM.util.vehicleKey(plate, args.vin);
    const record = await AGM.vehicles.load(key, plate, args.model, blueprint);
    if (!record) return { ok: false, reason: 'noRecord' };

    /* Score comes from the minigame, bonuses are decided here where they can be
       verified - a client cannot claim to be a mechanic holding a scanner. */
    let score = Number(args.score);
    if (!Number.isFinite(score)) score = 0;
    score = AGM.util.clamp(score, 0, 1);

    const isMechanic = player.job.name === AGM.Config.job.name;
    if (isMechanic) score += AGM.Config.diagnose.jobScoreBonus;
    if (AGM.inv.has(src, AGM.Config.diagnose.scannerItem, 1)) score += AGM.Config.diagnose.scannerScoreBonus;
    score = AGM.util.clamp(score, 0, 1);

    const quality = qualityFor(score);
    const report = buildReport(record, quality, isMechanic);
    store(key, player.citizenid, report, record.health);

    AGM.db.log('', player.name, 'diagnose', { plate, quality, score: AGM.util.round(score, 2) });
    return { ok: true, report, vehicleKey: key, score: AGM.util.round(score, 2) };
});

/** Re-opens the last report without redoing the minigame. */
AGM.rpc.register('diagnose:last', async (src, args) => {
    const player = AGM.core.getPlayer(src);
    if (!player) return null;

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return null;

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const key = AGM.util.vehicleKey(plate, args.vin);
    const report = AGM.diagnose.get(key, player.citizenid);
    return report ? { ok: true, report, vehicleKey: key } : null;
});
