/*
 * Maps GTA's 22 vehicle classes onto the five component blueprints this
 * resource understands. Everything downstream (components, tiers, damage
 * sources, performance handling) is keyed off the blueprint name.
 */
AGM.Classes = {
    /* GTA vehicle class id -> blueprint */
    byClass: {
        0: 'car', 1: 'car', 2: 'car', 3: 'car', 4: 'car', 5: 'car', 6: 'car', 7: 'car',
        8: 'bike',
        9: 'car', 10: 'car', 11: 'car', 12: 'car',
        13: 'cycle',
        14: 'boat',
        15: 'heli',
        16: 'plane',
        17: 'car', 18: 'car', 19: 'car', 20: 'car',
        21: 'unsupported', // trains
    },

    /* Blueprints that this resource will not touch at all. */
    unsupported: ['unsupported', 'cycle'],

    /* Human labels used in the diagnostic report header. */
    labels: {
        car: 'Automobile',
        bike: 'Motorcycle',
        boat: 'Watercraft',
        heli: 'Rotorcraft',
        plane: 'Fixed-Wing Aircraft',
    },

    /* Per-model blueprint overrides, for anything GTA classifies oddly. */
    overrides: {
        // blimp: 'plane',
    },

    /*
     * GetVehicleType() -> blueprint.
     *
     * GetVehicleClass is a client-only native, so the server cannot use it -
     * and a client-supplied class id decides which component set a vehicle
     * gets, which makes it worth forging. GetVehicleType *is* available
     * server-side, so this is the mapping the server uses instead.
     */
    byType: {
        automobile: 'car',
        bike: 'bike',
        quadbike: 'bike',
        amphibious_automobile: 'car',
        amphibious_quadbike: 'bike',
        boat: 'boat',
        heli: 'heli',
        blimp: 'heli',
        plane: 'plane',
        bicycle: 'cycle',
        submarine: 'unsupported',
        submarinecar: 'car',
        trailer: 'unsupported',
        train: 'unsupported',
    },
};

/**
 * Override lookup for a model, which may arrive either as a spawn name
 * ('blimp') on the client or as a model hash on the server, where there is no
 * native to turn a hash back into a name. Both are matched, so `overrides`
 * stays written in readable spawn names either way.
 */
function overrideFor(model) {
    if (model === undefined || model === null || model === '') return null;

    const asString = String(model).toLowerCase();
    if (AGM.Classes.overrides[asString]) return AGM.Classes.overrides[asString];

    const asNumber = Number(model);
    if (Number.isFinite(asNumber) && asNumber !== 0 && typeof GetHashKey === 'function') {
        for (const [name, blueprint] of Object.entries(AGM.Classes.overrides)) {
            if (GetHashKey(name) === asNumber) return blueprint;
        }
    }
    return null;
}

/** Resolve a blueprint from a GTA class id (and optional model). */
AGM.Classes.resolve = function (classId, model) {
    return overrideFor(model) || AGM.Classes.byClass[classId] || 'unsupported';
};

/** Resolve a blueprint from a GetVehicleType() string, server-side. */
AGM.Classes.fromType = function (type, model) {
    return overrideFor(model) || AGM.Classes.byType[String(type || '').toLowerCase()] || 'unsupported';
};

AGM.Classes.isSupported = function (blueprint) {
    return !!blueprint && !AGM.Classes.unsupported.includes(blueprint);
};
