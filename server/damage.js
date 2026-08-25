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

/** Resolves and validates the vehicle a client claims to be reporting on. */
async function resolveVehicle(src, payload) {
    const netId = Number(payload.netId);
    if (!netId) return null;

    const entity = NetworkGetEntityFromNetworkId(netId);
    if (!entity || !DoesEntityExist(entity)) return null;

    /* The reporter must actually be at the vehicle. */
    const ped = GetPlayerPed(String(src));
    if (ped) {
        const a = GetEntityCoords(ped);
        const b = GetEntityCoords(entity);
        const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > 25.0) {
            AGM.log.debug(`wear report from ${src} rejected: too far from vehicle`);
            return null;
        }
    }

    const plate = AGM.util.normalisePlate(payload.plate || GetVehicleNumberPlateText(entity));
    const blueprint = AGM.Classes.resolve(Number(payload.classId), payload.model);
    if (!AGM.Classes.isSupported(blueprint)) return null;

    const key = AGM.util.vehicleKey(plate, payload.vin);
    const record = await AGM.vehicles.load(key, plate, payload.model, blueprint);
    if (!record) return null;

    return { record, entity, netId };
}

/**
 * Applies a batch of wear. `payload.wear` is { sourceId: amount } accumulated
 * client-side since the last flush; `payload.distance` is metres travelled.
 */
AGM.damage.intake = async function (src, payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (!limiter(src)) return null;

    const resolved = await resolveVehicle(src, payload);
    if (!resolved) return null;
    const { record, netId } = resolved;

    const before = { ...record.health };
    const cap = AGM.Config.security.maxWearPerReport;
    let touched = false;

    for (const [sourceId, rawAmount] of Object.entries(payload.wear || {})) {
        const amount = Number(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        if (!AGM.Damage.applies(sourceId, record.blueprint)) continue;

        const clamped = Math.min(amount, cap);
        const changed = AGM.Health.applyWear(record.blueprint, record.health, sourceId, clamped);
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
 * over simulation of it.
 */
AGM.rpc.register('vehicle:state', async (src, args) => {
    const resolved = await resolveVehicle(src, args || {});
    if (!resolved) return null;
    const state = AGM.vehicles.publicState(resolved.record);
    state.netId = resolved.netId;
    return state;
});

/** Exposed so other resources (a tow script, an admin menu) can read health. */
global.exports('getVehicleHealth', (plate, vin) => {
    const record = AGM.vehicles.peek(AGM.util.vehicleKey(plate, vin));
    return record ? AGM.util.clone(record.health) : null;
});

/** Lets another resource apply wear, e.g. a scripted event or a stunt jump. */
global.exports('applyVehicleWear', (plate, vin, sourceId, amount) => {
    const record = AGM.vehicles.peek(AGM.util.vehicleKey(plate, vin));
    if (!record) return false;
    if (!AGM.Damage.applies(sourceId, record.blueprint)) return false;
    const changed = AGM.Health.applyWear(record.blueprint, record.health, sourceId, Number(amount) || 0);
    if (AGM.util.isEmpty(changed)) return false;
    AGM.vehicles.noteSymptom(record, sourceId);
    record.dirty = true;
    AGM.vehicles.broadcast(record);
    return true;
});
