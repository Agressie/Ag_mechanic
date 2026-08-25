/*
 * ag_mechanic - vehicle health store
 * ============================================================================
 * The server is the only authority on component health. Records are cached in
 * memory keyed by a stable vehicle key (a VIN state-bag value if some other
 * resource provides one, otherwise the plate) and flushed to the database on a
 * timer, so a busy shop is not hammering MySQL on every wear tick.
 * ============================================================================
 */

AGM.vehicles = {};

/** key -> { key, plate, model, blueprint, health, tiers, symptoms, odometer, dirty, seen } */
const cache = new Map();

/** Recent wear sources per vehicle, so a report can describe symptoms. */
const SYMPTOM_LIMIT = 6;

function fresh(key, plate, model, blueprint) {
    return {
        key,
        plate: AGM.util.normalisePlate(plate),
        model: String(model || '').toLowerCase(),
        blueprint,
        health: AGM.Health.blank(blueprint),
        tiers: AGM.Health.blankTiers(blueprint),
        symptoms: [],
        odometer: 0,
        dirty: true,
        seen: Date.now(),
    };
}

/**
 * Loads (or creates) the record for a vehicle. Always await this before touching
 * health - it is the only path that hits the database.
 */
AGM.vehicles.load = async function (key, plate, model, blueprint) {
    if (!AGM.Classes.isSupported(blueprint)) return null;

    const cached = cache.get(key);
    if (cached) {
        cached.seen = Date.now();
        /* A vehicle can be re-registered with a new plate after a plate change. */
        if (plate) cached.plate = AGM.util.normalisePlate(plate);
        return cached;
    }

    let row = null;
    if (AGM.db.ready) {
        row = await AGM.db.single(
            'SELECT * FROM ag_mechanic_vehicles WHERE vehicle_key = ? LIMIT 1',
            [key],
        ).catch(() => null);
    }

    const record = fresh(key, plate, model, blueprint);

    if (row) {
        /* Trust the stored blueprint if the live one looks wrong (a spawn where
           the class was not resolved yet), but never mix component sets. */
        const storedBlueprint = AGM.Classes.isSupported(row.blueprint) ? row.blueprint : blueprint;
        record.blueprint = storedBlueprint;
        record.health = AGM.Health.sanitise(storedBlueprint, AGM.db.json(row.health, null));
        record.tiers = AGM.Health.sanitiseTiers(storedBlueprint, AGM.db.json(row.tiers, null));
        record.symptoms = (AGM.db.json(row.symptoms, []) || []).slice(0, SYMPTOM_LIMIT);
        record.odometer = Number(row.odometer) || 0;
        record.model = row.model || record.model;
        record.dirty = false;
    }

    cache.set(key, record);
    return record;
};

/** In-memory record only, no database round trip. */
AGM.vehicles.peek = (key) => cache.get(key) || null;

AGM.vehicles.markDirty = function (key) {
    const rec = cache.get(key);
    if (rec) {
        rec.dirty = true;
        rec.seen = Date.now();
    }
};

/** Records that a wear source has been active, for the report's symptom list. */
AGM.vehicles.noteSymptom = function (record, sourceId) {
    if (!record || !sourceId) return;
    const existing = record.symptoms.find((s) => s.source === sourceId);
    if (existing) {
        existing.count += 1;
        existing.at = Date.now();
    } else {
        record.symptoms.unshift({ source: sourceId, count: 1, at: Date.now() });
    }
    record.symptoms.sort((a, b) => b.at - a.at);
    if (record.symptoms.length > SYMPTOM_LIMIT) record.symptoms.length = SYMPTOM_LIMIT;
};

/** Adds distance travelled, converting it into slow honest wear. */
AGM.vehicles.addDistance = function (record, metres) {
    if (!record || !(metres > 0)) return null;
    record.odometer += metres;

    const km = metres / 1000;
    const amount = km * AGM.Damage.detect.mileageWearPerKm;
    if (amount <= 0) return null;

    const changed = AGM.Health.applyWear(record.blueprint, record.health, 'mileage', amount);
    if (!AGM.util.isEmpty(changed)) {
        record.dirty = true;
        AGM.vehicles.noteSymptom(record, 'mileage');
    }
    return changed;
};

/* ---------------------------------------------------------------- persistence */

async function save(record) {
    if (!AGM.db.ready) return;
    await AGM.db.query(
        `INSERT INTO ag_mechanic_vehicles
            (vehicle_key, plate, model, blueprint, health, tiers, symptoms, odometer, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            plate = VALUES(plate),
            model = VALUES(model),
            blueprint = VALUES(blueprint),
            health = VALUES(health),
            tiers = VALUES(tiers),
            symptoms = VALUES(symptoms),
            odometer = VALUES(odometer),
            updated_at = VALUES(updated_at)`,
        [
            record.key,
            record.plate,
            record.model,
            record.blueprint,
            JSON.stringify(record.health),
            JSON.stringify(record.tiers),
            JSON.stringify(record.symptoms),
            AGM.util.round(record.odometer, 1),
            Date.now(),
        ],
    ).catch((err) => AGM.log.error('vehicle save failed:', err && err.message));
    record.dirty = false;
}

/** Flushes every changed record. Called on a timer and on resource stop. */
AGM.vehicles.flush = async function () {
    const pending = [];
    for (const record of cache.values()) {
        if (record.dirty) pending.push(save(record));
    }
    if (pending.length) {
        await Promise.all(pending);
        AGM.log.debug(`flushed ${pending.length} vehicle record(s)`);
    }
    return pending.length;
};

/** Immediately persists one record, e.g. straight after a repair. */
AGM.vehicles.saveNow = async function (key) {
    const record = cache.get(key);
    if (record) await save(record);
};

/** Drops long-untouched records from memory. */
AGM.vehicles.evict = function () {
    const cutoff = Date.now() - AGM.Config.persistence.cacheTtl;
    let dropped = 0;
    for (const [key, record] of cache) {
        if (record.seen > cutoff || record.dirty) continue;
        cache.delete(key);
        dropped++;
    }
    if (dropped) AGM.log.debug(`evicted ${dropped} cached vehicle record(s)`);
};

/** Deletes rows for vehicles nobody has driven in a long time. */
AGM.vehicles.prune = async function () {
    const days = Number(AGM.Config.persistence.pruneAfterDays) || 0;
    if (!days || !AGM.db.ready) return 0;
    const cutoff = Date.now() - days * 86400000;
    const affected = await AGM.db.update(
        'DELETE FROM ag_mechanic_vehicles WHERE updated_at > 0 AND updated_at < ?',
        [cutoff],
    ).catch(() => 0);
    if (affected) AGM.log.info(`pruned ${affected} stale vehicle record(s)`);
    return affected;
};

AGM.vehicles.cacheSize = () => cache.size;

/** Everything the client needs to render the vehicle's state. */
AGM.vehicles.publicState = function (record) {
    if (!record) return null;
    return {
        key: record.key,
        plate: record.plate,
        blueprint: record.blueprint,
        health: record.health,
        tiers: record.tiers,
        performance: AGM.Health.performance(record.blueprint, record.health, record.tiers),
        driveability: AGM.Health.driveability(record.blueprint, record.health),
        odometer: AGM.util.round(record.odometer / 1000, 1),
    };
};

/** Pushes state to everyone who might be simulating this vehicle. */
AGM.vehicles.broadcast = function (record, netId) {
    if (!record) return;
    const state = AGM.vehicles.publicState(record);
    state.netId = netId || null;
    emitNet('ag_mechanic:client:vehicleState', -1, state);
};
