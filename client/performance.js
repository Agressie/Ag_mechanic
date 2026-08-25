/*
 * ag_mechanic - performance degradation
 * ============================================================================
 * Turns component health into something the driver can feel, by scaling the
 * vehicle's own handling fields rather than bolting on an artificial speed cap.
 * Stock values are cached per model the first time we see one, before anything
 * is written, so degradation is always relative to the factory figure.
 *
 * A field whose stock value reads back as zero or non-finite is skipped: that
 * means the handling sub-class is not exposed on this build, and writing to it
 * would either do nothing or produce nonsense.
 * ============================================================================
 */

AGM.perf = {};

/** `${modelHash}:${class}:${field}` -> stock value */
const stock = new Map();
/** Entities we have written handling to, so we know what to restore. */
const applied = new Map();
/** Fields we have already found to be unsupported, to stop retrying them. */
const unsupported = new Set();

function stockKey(model, entry) {
    return `${model}:${entry.class}:${entry.field}`;
}

function readStock(vehicle, model, entry) {
    const key = stockKey(model, entry);
    if (stock.has(key)) return stock.get(key);
    if (unsupported.has(`${entry.class}:${entry.field}`)) return null;

    let value = null;
    try {
        value = GetVehicleHandlingFloat(vehicle, entry.class, entry.field);
    } catch (_) {
        value = null;
    }

    if (!Number.isFinite(value) || value === 0) {
        unsupported.add(`${entry.class}:${entry.field}`);
        AGM.log.debug(`handling field ${entry.class}.${entry.field} unavailable on this build - skipping`);
        return null;
    }

    stock.set(key, value);
    return value;
}

function axisProduct(perf, axes) {
    let mult = 1;
    for (const axis of axes) {
        const value = perf[axis];
        mult *= Number.isFinite(value) ? value : 1;
    }
    return mult;
}

/**
 * Writes the degraded handling for a vehicle. Safe to call repeatedly - it only
 * touches the game when a value actually changed.
 */
AGM.perf.apply = function (vehicle, state) {
    if (!vehicle || !DoesEntityExist(vehicle) || !state) return;

    const map = AGM.Handling[state.blueprint];
    if (!map) return;

    const model = GetEntityModel(vehicle);
    const perf = state.performance || {};
    const drive = state.driveability || { modes: [] };
    const cripple = {};
    for (const mode of drive.modes || []) Object.assign(cripple, AGM.Handling.crippled[mode] || {});

    const written = applied.get(vehicle) || {};

    for (const entry of map) {
        const base = readStock(vehicle, model, entry);
        if (base === null) continue;

        let mult = AGM.util.clamp(axisProduct(perf, entry.axes), entry.min, entry.max);
        if (entry.invert) mult = 1 / mult;

        /* Dead-component overrides win outright. */
        if (entry.field === 'fInitialDriveForce' && cripple.driveForce !== undefined) mult = cripple.driveForce;
        if (entry.field === 'fSteeringLock' && cripple.steeringLock !== undefined) mult = cripple.steeringLock;
        if (cripple.controlMult !== undefined && (entry.field === 'fPitchMult' || entry.field === 'fRollMult')) {
            mult = Math.min(mult, cripple.controlMult);
        }

        const target = base * mult;
        const key = `${entry.class}.${entry.field}`;
        if (written[key] !== undefined && Math.abs(written[key] - target) < 0.0001) continue;

        try {
            SetVehicleHandlingFloat(vehicle, entry.class, entry.field, target);
            written[key] = target;
        } catch (_) {
            unsupported.add(`${entry.class}:${entry.field}`);
        }
    }

    applied.set(vehicle, written);
    applyCrippling(vehicle, state, cripple);
};

/** The non-handling consequences: burst tyres, dead rotors, a seized engine. */
function applyCrippling(vehicle, state, cripple) {
    const blueprint = state.blueprint;
    const health = state.health || {};

    if (cripple.engineOff) {
        if (GetIsVehicleEngineRunning(vehicle)) SetVehicleEngineOn(vehicle, false, true, true);
        SetVehicleUndriveable(vehicle, true);
        if (GetVehicleEngineHealth(vehicle) > 0) SetVehicleEngineHealth(vehicle, 0.0);
    } else if (cripple.undriveable) {
        SetVehicleUndriveable(vehicle, true);
    }

    /* Tyres: a component at or under its dead threshold is a flat. */
    for (const comp of AGM.Components.list(blueprint)) {
        if (comp.wheelIndex === null || comp.wheelIndex === undefined) continue;
        const value = health[comp.id];
        if (value === undefined) continue;

        const dead = AGM.Health.isDead(value, comp);
        const burst = IsVehicleTyreBurst(vehicle, comp.wheelIndex, false);
        if (dead && !burst) {
            SetVehicleTyreBurst(vehicle, comp.wheelIndex, true, 1000.0);
        } else if (!dead && burst) {
            SetVehicleTyreFixed(vehicle, comp.wheelIndex);
        }
    }

    /* Rotorcraft: map our rotor health onto the natives that actually fly it. */
    if (blueprint === 'heli') {
        const main = health.main_rotor;
        const tail = health.tail_rotor;
        if (Number.isFinite(main)) {
            const target = cripple.rotorDead ? 0 : Math.max(1, (main / 100) * 1000);
            if (Math.abs(GetHeliMainRotorHealth(vehicle) - target) > 25) SetHeliMainRotorHealth(vehicle, target);
        }
        if (Number.isFinite(tail)) {
            const target = Math.max(0, (tail / 100) * 1000);
            if (Math.abs(GetHeliTailRotorHealth(vehicle) - target) > 25) SetHeliTailRotorHealth(vehicle, target);
        }
    }

    /* Engine health tracks the engine component, so smoke and fire show up when
       the internals are genuinely finished rather than at random. */
    const engine = health.engine;
    if (Number.isFinite(engine) && !cripple.engineOff) {
        const target = AGM.util.clamp((engine / 100) * 1000, 100, 1000);
        if (GetVehicleEngineHealth(vehicle) > target + 40) SetVehicleEngineHealth(vehicle, target);
    }
}

/** Puts a vehicle's handling back to stock, e.g. when it despawns. */
AGM.perf.restore = function (vehicle) {
    const written = applied.get(vehicle);
    if (!written) return;
    applied.delete(vehicle);

    if (!DoesEntityExist(vehicle)) return;
    const model = GetEntityModel(vehicle);

    for (const key of Object.keys(written)) {
        const [cls, field] = key.split('.');
        const base = stock.get(`${model}:${cls}:${field}`);
        if (base === undefined) continue;
        try {
            SetVehicleHandlingFloat(vehicle, cls, field, base);
        } catch (_) { /* nothing sensible to do */ }
    }
};

/** Drops bookkeeping for vehicles that no longer exist. */
AGM.perf.sweep = function () {
    for (const vehicle of Array.from(applied.keys())) {
        if (!DoesEntityExist(vehicle)) applied.delete(vehicle);
    }
};

/** Convenience: fetch state if needed, then apply it. */
AGM.perf.refresh = async function (vehicle) {
    const info = AGM.state.describe(vehicle);
    if (!info) return;
    const state = await AGM.state.ensure(info);
    if (state) AGM.perf.apply(vehicle, state);
};

/* Re-apply whenever the server tells us something changed. */
on('ag_mechanic:internal:stateUpdated', (netId) => {
    if (!NetworkDoesEntityExistWithNetworkId(netId)) return;
    const vehicle = NetworkGetEntityFromNetworkId(netId);
    if (!vehicle || !DoesEntityExist(vehicle)) return;
    const state = AGM.state.get(netId);
    if (state) AGM.perf.apply(vehicle, state);
});
