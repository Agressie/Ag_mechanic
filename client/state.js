/*
 * ag_mechanic - client state
 * ============================================================================
 * Local mirror of the server's vehicle health, plus the small identity helpers
 * every other client file needs (what vehicle is this, what blueprint does it
 * use, do I work here).
 * ============================================================================
 */

AGM.state = {
    /** netId -> last known server state */
    vehicles: new Map(),
    /** The vehicle the player is currently in, or null. */
    current: null,
    /** Cached job info. */
    job: { name: '', grade: 0, isMechanic: false },
    /** The last diagnostic report this player received, per vehicle key. */
    reports: new Map(),
};

/* ------------------------------------------------------------ identification */

/**
 * Everything the server needs to identify a vehicle. Returns null for anything
 * this resource does not model (bicycles, trains).
 */
AGM.state.describe = function (vehicle) {
    if (!vehicle || !DoesEntityExist(vehicle)) return null;

    const classId = GetVehicleClass(vehicle);
    const model = String(GetDisplayNameFromVehicleModel(GetEntityModel(vehicle)) || '').toLowerCase();
    const blueprint = AGM.Classes.resolve(classId, model);
    if (!AGM.Classes.isSupported(blueprint)) return null;

    return {
        entity: vehicle,
        netId: NetworkGetNetworkIdFromEntity(vehicle),
        plate: AGM.util.normalisePlate(GetVehicleNumberPlateText(vehicle)),
        model,
        classId,
        blueprint,
        key: AGM.util.vehicleKey(GetVehicleNumberPlateText(vehicle)),
    };
};

/**
 * Arguments shape shared by every vehicle-scoped RPC.
 *
 * Only the network id goes up. The server reads the plate and the vehicle type
 * off the entity itself, because those decide which health record is written to
 * and which components it has - so they are not ours to state.
 */
AGM.state.args = function (info, extra = {}) {
    if (!info) return null;
    return { netId: info.netId, ...extra };
};

AGM.state.get = (netId) => AGM.state.vehicles.get(Number(netId)) || null;

/** Health for an entity, or null if we have not been told about it yet. */
AGM.state.healthFor = function (vehicle) {
    const netId = NetworkGetNetworkIdFromEntity(vehicle);
    const state = AGM.state.get(netId);
    return state ? state.health : null;
};

/** Fetches authoritative state for a vehicle and caches it. */
AGM.state.fetch = async function (info) {
    if (!info) return null;
    const state = await AGM.rpc.call('vehicle:state', AGM.state.args(info));
    if (state) {
        AGM.state.vehicles.set(Number(state.netId || info.netId), state);
        emit('ag_mechanic:internal:stateUpdated', Number(state.netId || info.netId));
    }
    return state;
};

/** Cached state if we have it, otherwise fetched. */
AGM.state.ensure = async function (info) {
    if (!info) return null;
    const cached = AGM.state.get(info.netId);
    if (cached) return cached;
    return AGM.state.fetch(info);
};

/* --------------------------------------------------------------- server push */

onNet('ag_mechanic:client:vehicleState', (state) => {
    if (!state) return;
    const netId = Number(state.netId);
    if (!netId) return;

    /* Only keep state for vehicles that exist locally - otherwise every client
       would accumulate the whole server's fleet. */
    const entity = NetworkDoesEntityExistWithNetworkId(netId)
        ? NetworkGetEntityFromNetworkId(netId)
        : 0;
    if (!entity || !DoesEntityExist(entity)) return;

    AGM.state.vehicles.set(netId, state);
    emit('ag_mechanic:internal:stateUpdated', netId);
});

onNet('ag_mechanic:client:healthDelta', (payload) => {
    if (!payload) return;
    const netId = Number(payload.netId);
    const state = AGM.state.get(netId);
    if (!state) return;
    state.health = payload.health;
    state.performance = AGM.Health.performance(state.blueprint, state.health, state.tiers);
    state.driveability = AGM.Health.driveability(state.blueprint, state.health);
    emit('ag_mechanic:internal:stateUpdated', netId);
});

/** Writes a GTA mod slot after a named tier is fitted. */
onNet('ag_mechanic:client:applyMod', (payload) => {
    if (!payload) return;
    const netId = Number(payload.netId);
    if (!NetworkDoesEntityExistWithNetworkId(netId)) return;
    const vehicle = NetworkGetEntityFromNetworkId(netId);
    if (!vehicle || !DoesEntityExist(vehicle)) return;

    SetVehicleModKit(vehicle, 0);
    if (payload.toggle) {
        SetVehicleToggleMod(vehicle, payload.mod, payload.value >= 0);
    } else {
        SetVehicleMod(vehicle, payload.mod, payload.value, false);
    }
});

/* ------------------------------------------------------------------ identity */

/** Reads job info from qbx_core, falling back to asking the server. */
AGM.state.refreshJob = async function () {
    try {
        const data = exports.qbx_core && exports.qbx_core.GetPlayerData
            ? exports.qbx_core.GetPlayerData()
            : null;
        if (data && data.job) {
            const grade = data.job.grade || {};
            AGM.state.job = {
                name: data.job.name || '',
                grade: Number(grade.level !== undefined ? grade.level : grade) || 0,
                isMechanic: data.job.name === AGM.Config.job.name,
            };
            return AGM.state.job;
        }
    } catch (_) {
        /* fall through to the server */
    }

    const me = await AGM.rpc.call('player:me');
    if (me) {
        AGM.state.job = {
            name: me.job || '',
            grade: Number(me.grade) || 0,
            isMechanic: me.job === AGM.Config.job.name,
        };
    }
    return AGM.state.job;
};

AGM.state.isMechanic = () => AGM.state.job.isMechanic;

/* -------------------------------------------------------------------- lookups */

/** Closest vehicle to the player within `radius`, or null. */
AGM.state.nearestVehicle = function (radius = 6.0) {
    const ped = PlayerPedId();
    const inside = GetVehiclePedIsIn(ped, false);
    if (inside) return inside;

    const coords = GetEntityCoords(ped, true);
    const found = GetClosestVehicle(coords[0], coords[1], coords[2], radius, 0, 71);
    return found && DoesEntityExist(found) ? found : null;
};

/** Local report cache, so the repair menu knows what the player has found. */
AGM.state.setReport = function (vehicleKey, report) {
    AGM.state.reports.set(vehicleKey, report);
};

AGM.state.getReport = function (vehicleKey) {
    const report = AGM.state.reports.get(vehicleKey);
    if (!report) return null;
    if (Date.now() > report.expiresAt) {
        AGM.state.reports.delete(vehicleKey);
        return null;
    }
    return report;
};

AGM.state.clearReport = function (vehicleKey) {
    AGM.state.reports.delete(vehicleKey);
};
