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
        /*
         * The blueprint is derived server-side from the vehicle itself, so a
         * disagreement means this plate now belongs to a different kind of
         * machine than the cached record describes. Reusing it would hand out
         * rotor components for a hatchback, so the record is rebuilt instead.
         */
        if (cached.blueprint !== blueprint) {
            AGM.log.warn(`${key} was cached as '${cached.blueprint}' but is a '${blueprint}' - rebuilding`);
            cache.delete(key);
            /* Whatever anybody had diagnosed described the old component set. */
            if (AGM.diagnose) AGM.diagnose.forget(key);
        } else {
            cached.seen = Date.now();
            if (plate) cached.plate = AGM.util.normalisePlate(plate);
            return cached;
        }
    }

    let row = null;
    if (AGM.db.ready) {
        row = await AGM.db.single(
            'SELECT * FROM ag_mechanic_vehicles WHERE vehicle_key = ? LIMIT 1',
            [key],
        ).catch(() => null);
    }

    const record = fresh(key, plate, model, blueprint);

    /* Only reuse a stored row that describes the same kind of machine. A plate
       moved onto a different vehicle starts a clean record. */
    if (row && row.blueprint === blueprint) {
        record.health = AGM.Health.sanitise(blueprint, AGM.db.json(row.health, null));
        record.tiers = AGM.Health.sanitiseTiers(blueprint, AGM.db.json(row.tiers, null));
        record.symptoms = (AGM.db.json(row.symptoms, []) || []).slice(0, SYMPTOM_LIMIT);
        record.odometer = Number(row.odometer) || 0;
        record.model = row.model || record.model;
        record.dirty = false;
    } else if (row) {
        AGM.log.warn(`${key} stored as '${row.blueprint}' but is a '${blueprint}' - starting a fresh record`);
    }

    cache.set(key, record);
    return record;
};

/* ------------------------------------------------------------- identity */

/**
 * Everything that identifies a vehicle, read from the entity itself.
 *
 * This is the whole point: the plate decides which health record gets written
 * to and the type decides which components it has, so neither may come from
 * the client. A modified client that lies about its plate would otherwise be
 * able to repair, wreck or read any vehicle on the server from anywhere.
 */
AGM.vehicles.identify = function (entity) {
    if (!entity || !DoesEntityExist(entity)) return null;

    const plate = AGM.util.normalisePlate(GetVehicleNumberPlateText(entity));
    if (!plate) return null;

    const model = String(GetEntityModel(entity) || '');

    /*
     * GetVehicleType is server-side; GetVehicleClass is not. On a build old
     * enough to lack it there is nothing trustworthy to fall back on, so the
     * vehicle is treated as unsupported rather than taking the client's word.
     */
    let type = '';
    if (typeof GetVehicleType === 'function') {
        try {
            type = GetVehicleType(entity) || '';
        } catch (_) {
            type = '';
        }
    }
    if (!type) {
        AGM.log.warn('GetVehicleType is unavailable on this server build - vehicles cannot be classified');
        return null;
    }

    const blueprint = AGM.Classes.fromType(type, model);
    if (!AGM.Classes.isSupported(blueprint)) return null;

    return { plate, model, blueprint, type, key: AGM.util.vehicleKey(plate) };
};

/**
 * Resolves the vehicle a player is acting on, from a network id and nothing
 * else. Returns { error } or the full context every vehicle RPC needs.
 *
 * `opts.maxExtra`   metres of slack on top of Config.security.maxInteractDistance
 * `opts.stationary` refuse while the vehicle is moving
 */
AGM.vehicles.resolve = async function (src, netId, opts = {}) {
    const player = AGM.core.getPlayer(src);
    if (!player) return { error: 'noPlayer' };

    const id = Number(netId);
    const entity = id ? NetworkGetEntityFromNetworkId(id) : 0;
    if (!entity || !DoesEntityExist(entity)) return { error: 'noVehicle' };

    const ped = GetPlayerPed(String(src));
    /* No ped means no way to verify where this player is. Fail closed. */
    if (!ped) return { error: 'noPlayer' };

    const reach = AGM.Config.security.maxInteractDistance + (opts.maxExtra || 0);
    if (AGM.util.dist(GetEntityCoords(ped), GetEntityCoords(entity)) > reach) {
        return { error: 'tooFar' };
    }

    if (opts.stationary && GetEntitySpeed(entity) > 1.0) return { error: 'vehicleMoving' };

    const ident = AGM.vehicles.identify(entity);
    if (!ident) return { error: 'unsupported' };

    const record = await AGM.vehicles.load(ident.key, ident.plate, ident.model, ident.blueprint);
    if (!record) return { error: 'noRecord' };

    return {
        player, entity, netId: id, record,
        key: ident.key, plate: ident.plate, blueprint: ident.blueprint,
        vehCoords: GetEntityCoords(entity),
    };
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

/**
 * Pushes state to the players who can actually see this vehicle.
 *
 * The client applies degraded handling to anything within 30m, so standing next
 * to a car is enough to need its condition - but the whole server is not. With
 * no entity to measure from (the applyVehicleWear export, say) it falls back to
 * telling everyone, because there is no position to filter on.
 */
AGM.vehicles.broadcast = function (record, netId) {
    if (!record) return;
    const state = AGM.vehicles.publicState(record);
    state.netId = netId || null;

    const id = Number(netId);
    const entity = id ? NetworkGetEntityFromNetworkId(id) : 0;
    if (!entity || !DoesEntityExist(entity)) {
        emitNet('ag_mechanic:client:vehicleState', -1, state);
        return;
    }

    const origin = GetEntityCoords(entity);
    const radius = AGM.Config.net.stateRadius;

    for (const p of getPlayers()) {
        const ped = GetPlayerPed(p);
        if (!ped) continue;
        if (AGM.util.dist(GetEntityCoords(ped), origin) > radius) continue;
        emitNet('ag_mechanic:client:vehicleState', Number(p), state);
    }
};
