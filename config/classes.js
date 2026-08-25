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
};

/** Resolve a blueprint from a GTA class id (and optional model name). */
AGM.Classes.resolve = function (classId, modelName) {
    if (modelName) {
        const key = String(modelName).toLowerCase();
        if (AGM.Classes.overrides[key]) return AGM.Classes.overrides[key];
    }
    return AGM.Classes.byClass[classId] || 'unsupported';
};

AGM.Classes.isSupported = function (blueprint) {
    return !!blueprint && !AGM.Classes.unsupported.includes(blueprint);
};
