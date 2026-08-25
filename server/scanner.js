/*
 * ag_mechanic - the scanner engine
 * ============================================================================
 * Turns component health into something that reads like a real scan: fault
 * codes with locations, a freeze frame from the moment the code set, and live
 * sensor values that move with the vehicle's actual condition.
 *
 * Everything here is deterministic per vehicle. The same car always reports the
 * same cylinder for the same fault, because a mechanic who scans it twice and
 * gets two different answers has learnt nothing.
 * ============================================================================
 */

AGM.scanner = {};

/* FNV-1a. Small, fast, and stable across restarts - which is the whole point. */
function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

const pickBy = (seed, list) => list[hash(seed) % list.length];

/** Cylinder count, fixed per model so a given car is always consistent. */
AGM.scanner.cylinders = function (record) {
    const seed = `${record.model || 'unknown'}:${record.blueprint}`;
    switch (record.blueprint) {
        case 'bike': return pickBy(seed, [1, 2, 2, 4]);
        case 'heli': return 0;
        case 'plane': return pickBy(seed, [4, 6]);
        case 'boat': return pickBy(seed, [6, 8]);
        default: return pickBy(seed, [4, 4, 6, 8]);
    }
};

const WHEEL_NAMES = { 0: 'left front', 1: 'right front', 4: 'left rear', 5: 'right rear' };

/**
 * Resolves the placeholders in a code and its description: which cylinder, which
 * bank, which wheel, which blade. Stable for a given vehicle and component.
 */
AGM.scanner.resolveLocation = function (record, componentId) {
    const entry = AGM.Dtc.get(record.blueprint, componentId);
    const comp = AGM.Components.get(record.blueprint, componentId);
    if (!entry || !comp) return { tokens: {}, label: '', where: '' };

    const seed = `${record.key}:${componentId}`;
    const cylinders = AGM.scanner.cylinders(record);
    const tokens = {};
    let label = '';

    switch (entry.location) {
        case 'cylinder': {
            const cyl = cylinders > 0 ? (hash(seed) % cylinders) + 1 : 1;
            tokens.cyl = cyl;
            tokens.bank = cylinders >= 6 && cyl > cylinders / 2 ? 2 : 1;
            label = cylinders >= 6 ? `Cylinder ${cyl}, bank ${tokens.bank}` : `Cylinder ${cyl}`;
            break;
        }
        case 'bank': {
            tokens.bank = cylinders >= 6 ? (hash(seed) % 2) + 1 : 1;
            label = `Bank ${tokens.bank}`;
            break;
        }
        case 'wheel': {
            const name = WHEEL_NAMES[comp.wheelIndex] || 'affected wheel';
            tokens.wheel = name;
            label = name.replace(/^\w/, (c) => c.toUpperCase());
            break;
        }
        case 'blade': {
            tokens.n = (hash(seed) % 4) + 1;
            label = `Blade ${tokens.n}`;
            break;
        }
        case 'wing': {
            tokens.wing = hash(seed) % 2 ? 'right' : 'left';
            label = `${tokens.wing.replace(/^\w/, (c) => c.toUpperCase())} wing`;
            break;
        }
        default:
            tokens.bank = 1;
            label = '';
    }

    const fill = (text) => String(text || '').replace(/\{(\w+)\}/g, (m, key) => (tokens[key] !== undefined ? tokens[key] : m));

    return { tokens, label, where: fill(entry.where), fill };
};

/* ------------------------------------------------------------------- codes */

/**
 * Every code currently set on a vehicle.
 *
 * `stored` codes are confirmed faults with the light on; `pending` ones have
 * been seen but not confirmed over enough drive cycles. Clearing codes drops
 * everything back to pending until the vehicle has been driven far enough for
 * the fault to re-confirm - which is exactly the loophole a dishonest garage
 * would use before a sale.
 */
AGM.scanner.codes = function (record) {
    const blueprint = record.blueprint;
    const cleared = record.scanner || { clearedAt: 0, clearedOdo: 0 };
    const sinceCleared = Math.max(0, record.odometer - (cleared.clearedOdo || 0));
    const reconfirmed = !cleared.clearedAt || sinceCleared >= AGM.Config.scanner.reconfirmMetres;

    const out = [];

    for (const comp of AGM.Components.list(blueprint)) {
        if (!AGM.Dtc.visible(blueprint, comp.id)) continue;

        const entry = AGM.Dtc.get(blueprint, comp.id);
        const health = Number.isFinite(record.health[comp.id]) ? record.health[comp.id] : 100;

        const active = entry.codes.filter((code) => health < code.at);
        if (!active.length) continue;

        const location = AGM.scanner.resolveLocation(record, comp.id);
        const confirmed = AGM.Health.needsService(health, comp);

        for (const code of active) {
            out.push({
                code: location.fill(code.code),
                desc: location.fill(code.desc),
                severity: code.severity,
                /* Some faults are not specific to one cylinder or corner. */
                /* Only a confirmed fault turns the light on, and only once it
                   has re-confirmed since the codes were last cleared. */
                status: confirmed && reconfirmed ? 'stored' : 'pending',
                component: comp.id,
                componentLabel: comp.label,
                module: entry.module,
                moduleLabel: AGM.Dtc.moduleLabel(entry.module),
                location: code.loc === false ? '' : location.label,
                where: location.where,
                health,
            });
        }
    }

    const rank = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => (a.status === b.status ? 0 : a.status === 'stored' ? -1 : 1)
        || (rank[a.severity] - rank[b.severity])
        || a.code.localeCompare(b.code));

    return out;
};

/**
 * The vehicle as a tree of systems.
 *
 * Each module lists the parts it actually watches and whether each one is
 * healthy, so the tool can be walked system by system rather than only as a flat
 * list of codes. A clean module is a real answer, so modules with nothing wrong
 * are still listed.
 */
AGM.scanner.moduleScan = function (record, codes) {
    const blueprint = record.blueprint;

    const byComponent = new Map();
    for (const code of codes) {
        if (!byComponent.has(code.component)) byComponent.set(code.component, []);
        byComponent.get(code.component).push(code);
    }

    const byModule = new Map();
    for (const comp of AGM.Components.list(blueprint)) {
        if (!AGM.Dtc.visible(blueprint, comp.id)) continue;

        const moduleId = AGM.Dtc.module(blueprint, comp.id);
        const partCodes = byComponent.get(comp.id) || [];
        const location = AGM.scanner.resolveLocation(record, comp.id);

        const part = {
            id: comp.id,
            label: comp.label,
            where: location.where,
            location: location.label,
            codes: partCodes.map((c) => ({
                code: c.code, desc: c.desc, status: c.status, severity: c.severity,
            })),
            /* A scanner reports faults, not wear percentages - that is what a
               hands-on inspection is for. */
            status: partCodes.some((c) => c.status === 'stored') ? 'fault'
                : partCodes.length ? 'pending' : 'ok',
        };

        if (!byModule.has(moduleId)) byModule.set(moduleId, []);
        byModule.get(moduleId).push(part);
    }

    return AGM.Dtc.modules
        .filter((m) => byModule.has(m.id))
        .map((m) => {
            const parts = byModule.get(m.id);
            const flat = parts.flatMap((p) => p.codes);
            return {
                id: m.id,
                label: m.label,
                short: m.short,
                stored: flat.filter((c) => c.status === 'stored').length,
                pending: flat.filter((c) => c.status === 'pending').length,
                parts,
            };
        });
};

/* --------------------------------------------------------------- sensor data */

/** Clamped, rounded reading with a stable per-vehicle wobble. */
function reading(record, id, base, spread) {
    const jitter = ((hash(`${record.key}:${id}`) % 1000) / 1000 - 0.5) * spread;
    return AGM.util.round(base + jitter, 1);
}

const healthOf = (record, id) => (Number.isFinite(record.health[id]) ? record.health[id] : 100);

/**
 * Live sensor values, derived from condition. A blocked filter shows as a lean
 * fuel trim; a tired radiator shows as a high coolant temperature. The numbers
 * are the same story the codes tell, from a different angle.
 */
AGM.scanner.liveData = function (record) {
    const bp = record.blueprint;
    const airFilter = healthOf(record, 'air_filter');
    const cooling = Math.min(healthOf(record, 'radiator'), healthOf(record, 'cooling'));
    const oil = healthOf(record, 'oil_system');
    const battery = healthOf(record, 'battery');
    const fuel = healthOf(record, 'fuel_system');
    const engine = healthOf(record, 'engine');

    const pids = [];
    const add = (pid, label, value, unit, ok) => pids.push({ pid, label, value, unit, ok });

    add('0C', 'Engine RPM', reading(record, 'rpm', 780 + (100 - engine) * 1.4, 40), 'rpm', engine > 40);
    add('0D', 'Vehicle speed', 0, 'km/h', true);

    if (bp !== 'heli' && bp !== 'plane') {
        const temp = 88 + (100 - cooling) * 0.42;
        add('05', 'Coolant temperature', reading(record, 'ect', temp, 2), '°C', temp < 105);
    } else {
        const egt = 620 + (100 - engine) * 1.6;
        add('05', 'Turbine gas temp', reading(record, 'tgt', egt, 8), '°C', egt < 760);
    }

    add('04', 'Calculated load', reading(record, 'load', 18 + (100 - engine) * 0.25, 3), '%', true);

    /* A restricted intake reads as the engine adding fuel to compensate. */
    const trim = (100 - airFilter) * 0.24 - (100 - fuel) * 0.08;
    add('06', 'Short term fuel trim B1', reading(record, 'stft', trim * 0.4, 1.5), '%', Math.abs(trim) < 18);
    add('07', 'Long term fuel trim B1', reading(record, 'ltft', trim * 0.6, 1.0), '%', Math.abs(trim) < 18);

    add('10', 'Mass air flow', reading(record, 'maf', 3.6 * (airFilter / 100) + 0.4, 0.2), 'g/s', airFilter > 35);
    add('0F', 'Intake air temp', reading(record, 'iat', 24 + (100 - cooling) * 0.12, 1.5), '°C', true);
    add('0A', 'Fuel rail pressure', reading(record, 'frp', 3.8 * (fuel / 100) + 0.3, 0.1), 'bar', fuel > 40);
    add('42', 'Control module voltage', reading(record, 'volt', 11.4 + (battery / 100) * 2.6, 0.15), 'V', battery > 35);

    if (bp === 'car' || bp === 'bike' || bp === 'boat') {
        add('5C', 'Engine oil temperature', reading(record, 'oilt', 92 + (100 - oil) * 0.5, 3), '°C', oil > 30);
    }
    if (bp === 'heli') {
        add('T1', 'Main rotor RPM', reading(record, 'nr', 100 - (100 - healthOf(record, 'main_rotor')) * 0.06, 0.4), '% Nr', true);
        add('T2', 'Torque', reading(record, 'trq', 42 + (100 - healthOf(record, 'main_gearbox')) * 0.2, 2), '%', true);
        add('T3', 'Transmission oil press', reading(record, 'xoil', 55 * (healthOf(record, 'oil_system') / 100) + 8, 2), 'psi', oil > 30);
    }
    if (bp === 'plane') {
        add('T4', 'Manifold pressure', reading(record, 'map', 28 * (airFilter / 100) + 2, 0.6), 'inHg', airFilter > 35);
        add('T5', 'Hydraulic pressure', reading(record, 'hyd', 3000 * (healthOf(record, 'hydraulics') / 100), 60), 'psi', healthOf(record, 'hydraulics') > 40);
    }

    return pids;
};

/**
 * The freeze frame stored when a code set. Derived from the same values, but
 * captured under load rather than at idle - which is when faults actually show.
 */
AGM.scanner.freezeFrame = function (record, componentId) {
    const live = AGM.scanner.liveData(record);
    const pick = (pid) => live.find((p) => p.pid === pid);

    const rpm = pick('0C');
    const load = pick('04');
    const ect = pick('05');

    return [
        { label: 'Engine speed', value: AGM.util.round((rpm ? rpm.value : 800) * 3.4, 0), unit: 'rpm' },
        { label: 'Vehicle speed', value: reading(record, `${componentId}:spd`, 62, 20), unit: 'km/h' },
        { label: 'Calculated load', value: AGM.util.round(Math.min(99, (load ? load.value : 20) * 3.1), 0), unit: '%' },
        { label: ect ? ect.label : 'Coolant temperature', value: ect ? ect.value : 90, unit: ect ? ect.unit : '°C' },
        { label: 'Short term fuel trim', value: (pick('06') || { value: 0 }).value, unit: '%' },
        { label: 'Long term fuel trim', value: (pick('07') || { value: 0 }).value, unit: '%' },
        { label: 'Module voltage', value: (pick('42') || { value: 13.8 }).value, unit: 'V' },
    ];
};

/** Readiness monitors, in the shape a scanner shows them. */
AGM.scanner.monitors = function (record, codes) {
    const cleared = record.scanner || {};
    const since = Math.max(0, record.odometer - (cleared.clearedOdo || 0));
    /* Clearing codes resets the monitors, and they take driving to come back. */
    const incomplete = cleared.clearedAt && since < AGM.Config.scanner.reconfirmMetres;

    const failed = new Set(codes.filter((c) => c.status === 'stored').map((c) => c.module));

    return [
        { id: 'MIS', label: 'Misfire', state: monitorState(incomplete, failed.has('ECM')) },
        { id: 'FUE', label: 'Fuel system', state: monitorState(incomplete, failed.has('ECM')) },
        { id: 'CCM', label: 'Comprehensive components', state: monitorState(incomplete, failed.size > 0) },
        { id: 'CAT', label: 'Catalyst', state: monitorState(incomplete, failed.has('ECM')) },
        { id: 'EVP', label: 'Evaporative system', state: monitorState(incomplete, false) },
        { id: 'O2S', label: 'Oxygen sensor', state: monitorState(incomplete, failed.has('ECM')) },
    ];
};

const monitorState = (incomplete, failed) => (incomplete ? 'incomplete' : failed ? 'failed' : 'ready');

/** The full payload the scanner UI runs on. */
AGM.scanner.buildScan = function (record) {
    const codes = AGM.scanner.codes(record);
    const stored = codes.filter((c) => c.status === 'stored');
    const device = AGM.Dtc.deviceFor(record.blueprint);

    return {
        device: device ? {
            id: device.id,
            label: device.label,
            model: device.model,
            bus: device.bus,
            lexicon: device.lexicon,
        } : null,
        plate: record.plate,
        vin: record.key.startsWith('vin:') ? record.key.slice(4) : synthVin(record),
        blueprint: record.blueprint,
        blueprintLabel: AGM.Classes.labels[record.blueprint] || record.blueprint,
        protocol: AGM.Dtc.protocol(record.blueprint),
        odometer: AGM.util.round(record.odometer / 1000, 1),
        mil: stored.length > 0,
        codes,
        counts: { stored: stored.length, pending: codes.length - stored.length },
        modules: AGM.scanner.moduleScan(record, codes),
        live: AGM.scanner.liveData(record),
        monitors: AGM.scanner.monitors(record, codes),
        calibration: `AGM-${(hash(record.key) % 900000 + 100000)}`,
        clearedAt: (record.scanner || {}).clearedAt || 0,
    };
};

/** A stable, plausible VIN for vehicles that have no real one. */
function synthVin(record) {
    const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let out = '';
    let h = hash(record.key);
    for (let i = 0; i < 17; i++) {
        out += alphabet[h % alphabet.length];
        h = Math.imul(h ^ (i + 1), 0x01000193) >>> 0;
    }
    return out;
}

/* ---------------------------------------------------------------------- rpc */

/**
 * Checks the player is holding the tool that can actually talk to this machine.
 * Returns null when they are, or a refusal naming what they should have brought.
 */
function deviceCheck(src, blueprint) {
    const device = AGM.Dtc.deviceFor(blueprint);
    if (!device) return { ok: false, reason: 'unsupported' };

    if (device.item && !AGM.inv.has(src, device.item, 1)) {
        /* Carrying the wrong tool is worth saying out loud - it is a different
           mistake from carrying none, and the player should know which. */
        const carrying = AGM.Dtc.devices.find((d) => d.item && d.item !== device.item && AGM.inv.has(src, d.item, 1));
        return {
            ok: false,
            reason: carrying ? 'wrongDevice' : 'noItem',
            item: device.item,
            itemLabel: AGM.Shop.label(device.item),
            carrying: carrying ? AGM.Shop.label(carrying.item) : null,
            bus: device.bus,
        };
    }
    return null;
}
AGM.scanner.deviceCheck = deviceCheck;

/**
 * Plugs in and reads the vehicle. Requires the scanner item, and grants the
 * player knowledge of every module-visible component: exact where a code names
 * the part, a rough condition where the module simply reports no fault.
 */
AGM.rpc.register('scanner:scan', async (src, args) => {
    const ctx = await AGM.diagnose.resolveVehicle(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const refusal = deviceCheck(src, ctx.record.blueprint);
    if (refusal) return refusal;

    const { player, record } = ctx;
    const scan = AGM.scanner.buildScan(record);

    /* A code names its part exactly. A module reporting nothing is still
       information, but only worth a rough condition. */
    const findings = {};
    const faulted = new Set(scan.codes.map((c) => c.component));
    for (const id of AGM.Dtc.visibleComponents(record.blueprint)) {
        findings[id] = faulted.has(id) ? 'exact' : 'band';
    }

    AGM.diagnose.learn(record, player.citizenid, findings, { source: 'scan' });

    AGM.db.log('', player.name, 'scan', {
        plate: record.plate,
        device: scan.device ? scan.device.id : null,
        stored: scan.counts.stored,
        pending: scan.counts.pending,
    });

    return { ok: true, scan, vehicleKey: record.key };
});

/** Refreshes the live data page without re-reading the whole vehicle. */
AGM.rpc.register('scanner:live', async (src, args) => {
    const ctx = await AGM.diagnose.resolveVehicle(src, args);
    if (ctx.error) return null;

    if (deviceCheck(src, ctx.record.blueprint)) return null;

    return { ok: true, live: AGM.scanner.liveData(ctx.record) };
});

/** Freeze frame for one code. */
AGM.rpc.register('scanner:freeze', async (src, args) => {
    const ctx = await AGM.diagnose.resolveVehicle(src, args);
    if (ctx.error) return null;

    const componentId = String(args.component || '');
    if (!AGM.Components.get(ctx.record.blueprint, componentId)) return null;

    return { ok: true, frame: AGM.scanner.freezeFrame(ctx.record, componentId) };
});

/**
 * Clears stored codes. This repairs precisely nothing - it turns the light off
 * and resets the monitors, and the fault re-confirms as soon as the vehicle has
 * been driven far enough. Logged, because it is exactly the trick somebody pulls
 * before selling a car.
 */
AGM.rpc.register('scanner:erase', async (src, args) => {
    if (!AGM.Config.scanner.allowErase) return { ok: false, reason: 'eraseDisabled' };

    const ctx = await AGM.diagnose.resolveVehicle(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const refusal = deviceCheck(src, ctx.record.blueprint);
    if (refusal) return refusal;

    const { player, record } = ctx;
    if (AGM.Config.scanner.eraseRequiresJob && player.job.name !== AGM.Config.job.name) {
        return { ok: false, reason: 'noJob' };
    }

    const before = AGM.scanner.codes(record).filter((c) => c.status === 'stored').length;

    record.scanner = { clearedAt: Date.now(), clearedOdo: record.odometer };
    record.dirty = true;
    await AGM.vehicles.saveNow(record.key);

    AGM.db.log('', player.name, 'scanner_erase', { plate: record.plate, cleared: before });

    return { ok: true, cleared: before, scan: AGM.scanner.buildScan(record) };
});
