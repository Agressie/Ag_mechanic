/*
 * ag_mechanic - wear intake
 * ============================================================================
 * Clients detect abuse (they are the only ones who can see RPM, wheel slip and
 * impacts) but they do not decide what it costs. Every report is rate limited,
 * clamped per component, checked against the vehicle's blueprint and only then
 * applied to the server's own health record.
 * ============================================================================
 */

AGM.damage = {};

const limiter = AGM.util.rateLimiter(AGM.Config.security.wearReportInterval);

/*
 * Who was last at the wheel of what.
 *
 * The client flushes one final batch as the player steps out of the vehicle, by
 * which point they are no longer in the driver's seat - so a strict seat check
 * would throw away the last few seconds of every drive. This remembers the
 * driver briefly so that flush still lands, without opening the door to anyone
 * who simply walked past: you must have actually been driving *that* vehicle,
 * moments ago, and still be next to it.
 */
const GRACE_MS = 20000;
const lastDriven = new Map();   // src -> { netId, at }

function wasDriving(src, netId) {
    const entry = lastDriven.get(src);
    if (!entry || entry.netId !== netId) return false;
    return Date.now() - entry.at <= GRACE_MS;
}

on('playerDropped', () => lastDriven.delete(Number(global.source)));

/**
 * Applies a batch of wear. `payload.wear` is { sourceId: amount } accumulated
 * client-side since the last flush; `payload.distance` is metres travelled.
 *
 * Nothing in the payload identifies the vehicle - that is read from the entity
 * behind the network id, and the reporter has to be (or have just been) at the
 * wheel of it. All the payload carries is numbers, and those are capped three
 * ways: per source, per component, and in total across the whole report.
 */
AGM.damage.intake = async function (src, payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (!limiter(src)) return null;

    /* Resolved on proximity, then the seat is checked below - so the grace
       window above can let the final flush through. */
    const ctx = await AGM.vehicles.resolve(src, payload.netId, { maxExtra: 14 });
    if (ctx.error) {
        AGM.log.debug(`wear report from ${src} rejected: ${ctx.error}`);
        return null;
    }
    const { record, netId } = ctx;

    const driving = GetPedInVehicleSeat(ctx.entity, -1) === GetPlayerPed(String(src));
    if (driving) {
        lastDriven.set(src, { netId, at: Date.now() });
    } else if (!wasDriving(src, netId)) {
        AGM.log.debug(`wear report from ${src} rejected: not driving ${netId}`);
        return null;
    }

    const before = { ...record.health };
    const sec = AGM.Config.security;
    const wearOpts = { floor: sec.minHealthFromWear, maxPerComponent: sec.maxWearPerComponent };

    let budget = sec.maxWearTotalPerReport;
    let touched = false;

    for (const [sourceId, rawAmount] of Object.entries(payload.wear || {})) {
        if (budget <= 0) break;

        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        if (!AGM.Damage.applies(sourceId, record.blueprint)) continue;

        /* Each source is capped, and every source drawn from one shared budget
           so naming all of them at once buys nothing. */
        const clamped = Math.min(amount, sec.maxWearPerReport, budget);
        budget -= clamped;

        const changed = AGM.Health.applyWear(record.blueprint, record.health, sourceId, clamped, wearOpts);
        if (!AGM.util.isEmpty(changed)) {
            AGM.vehicles.noteSymptom(record, sourceId);
            touched = true;
        }
    }

    const distance = Number(payload.distance);
    if (Number.isFinite(distance) && distance > 0 && distance < 5000) {
        if (!AGM.util.isEmpty(AGM.vehicles.addDistance(record, distance) || {})) touched = true;
    }

    if (!touched) return null;
    record.dirty = true;

    /* Only push a full state update when something meaningful changed: a part
       crossed its dead threshold, or performance moved enough to feel. */
    if (crossedThreshold(record, before)) {
        AGM.vehicles.broadcast(record, netId);
        await AGM.vehicles.saveNow(record.key);
    } else {
        emitNet('ag_mechanic:client:healthDelta', src, {
            netId,
            health: record.health,
        });
    }

    return { ok: true };
};

/** True when a component just died, or just stopped being dead. */
function crossedThreshold(record, before) {
    for (const comp of AGM.Components.list(record.blueprint)) {
        const was = before[comp.id];
        const now = record.health[comp.id];
        if (was === undefined || now === undefined) continue;
        if (AGM.Health.isDead(was, comp) !== AGM.Health.isDead(now, comp)) return true;
        if (AGM.Health.needsService(was, comp) !== AGM.Health.needsService(now, comp)) return true;
    }
    return false;
}

onNet('ag_mechanic:server:wear', (payload) => {
    const src = Number(global.source);
    AGM.damage.intake(src, payload).catch((err) => AGM.log.error('wear intake failed:', err && err.message));
});

/**
 * Client asks for a vehicle's authoritative state, normally right after taking
 * over simulation of it. Read-only, so being near it is enough.
 */
AGM.rpc.register('vehicle:state', async (src, args) => {
    const ctx = await AGM.vehicles.resolve(src, (args || {}).netId, { maxExtra: 24 });
    if (ctx.error) return null;
    const state = AGM.vehicles.publicState(ctx.record);
    state.netId = ctx.netId;
    return state;
});

/** Exposed so other resources (a tow script, an admin menu) can read health. */
global.exports('getVehicleHealth', (plate) => {
    const record = AGM.vehicles.peek(AGM.util.vehicleKey(plate));
    return record ? AGM.util.clone(record.health) : null;
});

/**
 * Lets another resource apply wear, e.g. a scripted event or a stunt jump.
 * Another resource is trusted code, so this gets the uncapped effect that a
 * client report does not.
 */
global.exports('applyVehicleWear', (plate, sourceId, amount) => {
    const record = AGM.vehicles.peek(AGM.util.vehicleKey(plate));
    if (!record) return false;
    if (!AGM.Damage.applies(sourceId, record.blueprint)) return false;
    const changed = AGM.Health.applyWear(record.blueprint, record.health, sourceId, Number(amount) || 0);
    if (AGM.util.isEmpty(changed)) return false;
    AGM.vehicles.noteSymptom(record, sourceId);
    record.dirty = true;
    AGM.vehicles.broadcast(record);
    return true;
});
