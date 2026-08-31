/*
 * ag_mechanic - health maths
 * ============================================================================
 * Shared by client and server so both sides always agree on what a set of
 * component healths *means*: how much performance is left, whether the thing
 * can be driven, and whether a job can be done at the roadside or needs a lift.
 * ============================================================================
 */

AGM.Health = {};

/* Condition bands. Order matters: first match wins. */
AGM.Health.bands = [
    { id: 'excellent', label: 'Excellent', min: 90 },
    { id: 'good', label: 'Good', min: 70 },
    { id: 'worn', label: 'Worn', min: 45 },
    { id: 'poor', label: 'Poor', min: 20 },
    { id: 'critical', label: 'Critical', min: 0.01 },
    { id: 'dead', label: 'Failed', min: -1 },
];

/** A fresh, undamaged health record for a blueprint. */
AGM.Health.blank = function (blueprint) {
    const out = {};
    for (const comp of AGM.Components.list(blueprint)) out[comp.id] = 100;
    return out;
};

/**
 * Fills in missing components, drops unknown ones and clamps everything to
 * 0-100. Anything arriving from the database or a client goes through here.
 */
AGM.Health.sanitise = function (blueprint, health) {
    const out = {};
    for (const comp of AGM.Components.list(blueprint)) {
        const raw = health ? Number(health[comp.id]) : NaN;
        out[comp.id] = Number.isFinite(raw) ? AGM.util.round(AGM.util.clamp(raw, 0, 100), 1) : 100;
    }
    return out;
};

/** Band for a raw value, taking the component's own dead threshold into account. */
AGM.Health.band = function (value, comp) {
    if (comp && value <= comp.deadAt) return AGM.Health.bands[AGM.Health.bands.length - 1];
    for (const band of AGM.Health.bands) {
        if (value >= band.min) return band;
    }
    return AGM.Health.bands[AGM.Health.bands.length - 1];
};

AGM.Health.isDead = (value, comp) => value <= (comp ? comp.deadAt : 5);

AGM.Health.isWarning = (value, comp) => value < (comp ? comp.warnAt : 35);

/**
 * True when this component genuinely needs work, rather than simply not being
 * brand new. Only these count towards "does this vehicle need a workshop", so a
 * scuffed bumper never turns into a tow truck call.
 */
AGM.Health.needsService = function (value, comp) {
    if (!comp) return false;
    return value <= comp.deadAt || value < comp.serviceAt;
};

/**
 * What failing this component actually does to the vehicle. Derived from the
 * component group so new components inherit sensible behaviour for free.
 */
AGM.Health.deadMode = function (comp) {
    if (!comp || !comp.critical) return 'none';
    switch (comp.group) {
        case 'engine': return 'nostart';      // it will not run at all
        case 'electrical': return 'nostart';
        case 'drivetrain': return 'nodrive';  // runs, goes nowhere
        case 'rotor': return 'nofly';
        case 'controls': return 'nocontrol';
        case 'chassis': return 'nosteer';
        default: return 'nodrive';
    }
};

/**
 * Performance multipliers for every axis, given component health and installed
 * upgrade tiers. 1.0 is "exactly as the factory intended".
 */
AGM.Health.performance = function (blueprint, health, tiers) {
    const out = {};
    const axes = AGM.Components.axes;

    for (const axis of Object.keys(axes)) {
        const total = AGM.Components.axisTotal(blueprint, axis);
        if (total <= 0) continue;

        let weighted = 0;
        for (const comp of AGM.Components.list(blueprint)) {
            const weight = comp.effects[axis];
            if (!weight) continue;
            const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
            weighted += weight * (AGM.util.clamp(value, 0, 100) / 100);
        }

        const floor = axes[axis].floor;
        out[axis] = floor + (1 - floor) * (weighted / total);
    }

    /* Layer the named upgrade tiers on top. */
    if (tiers) {
        for (const [cat, index] of Object.entries(tiers)) {
            const tier = AGM.Tiers.tier(blueprint, cat, Number(index) || 0);
            if (!tier || !tier.perf) continue;
            for (const [axis, mult] of Object.entries(tier.perf)) {
                if (out[axis] === undefined) out[axis] = 1;
                out[axis] *= mult;
            }
        }
    }

    for (const axis of Object.keys(out)) out[axis] = AGM.util.round(out[axis], 4);
    return out;
};

/**
 * Can this thing be driven / flown, and if not, why. `modes` collects the dead
 * modes so the client knows whether to kill the engine, the drivetrain or the
 * controls.
 */
AGM.Health.driveability = function (blueprint, health) {
    const failed = [];
    const modes = new Set();

    for (const comp of AGM.Components.list(blueprint)) {
        const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        if (!AGM.Health.isDead(value, comp)) continue;
        if (comp.critical) {
            failed.push(comp.id);
            modes.add(AGM.Health.deadMode(comp));
        }
    }

    return {
        drivable: failed.length === 0,
        failed,
        modes: Array.from(modes),
    };
};

/**
 * Where a component can be fixed *right now*. This is the rule that decides
 * whether a vehicle needs a tow: 'garage' means a lift, nothing else will do.
 */
AGM.Health.repairMethod = function (comp, value) {
    if (!comp) return 'garage';
    if (comp.repair === 'garage') return 'garage';
    if (comp.garageBelow !== null && comp.garageBelow !== undefined && value < comp.garageBelow) return 'garage';
    return comp.repair;
};

/** Can a player bodge this with tape or ties? */
AGM.Health.canFieldRepair = function (comp, value) {
    if (!comp || !comp.field) return false;
    return value < AGM.Config.repair.fieldRepairCap;
};

/** Which improvised item(s) this component accepts. */
AGM.Health.fieldItems = (comp) => (comp && comp.field ? comp.fieldItems || [] : []);

/**
 * Full work list for a vehicle: every component that is not at 100, what it
 * would take to fix it, and where. This is what the mechanic's bay menu and the
 * "does this need towing" check are both built on.
 */
AGM.Health.repairPlan = function (blueprint, health) {
    const jobs = [];
    let needsGarage = false;

    for (const comp of AGM.Components.list(blueprint)) {
        const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        if (value >= 99.95) continue;

        const method = AGM.Health.repairMethod(comp, value);
        const required = AGM.Health.needsService(value, comp);
        if (required && method === 'garage') needsGarage = true;

        jobs.push({
            id: comp.id,
            label: comp.label,
            group: comp.group,
            health: value,
            band: AGM.Health.band(value, comp).id,
            dead: AGM.Health.isDead(value, comp),
            critical: !!comp.critical,
            method,
            required,
            part: comp.part,
            field: AGM.Health.canFieldRepair(comp, value),
            fieldItems: AGM.Health.fieldItems(comp),
        });
    }

    /* Worst first - that is the order a mechanic would work in. */
    jobs.sort((a, b) => a.health - b.health);
    return {
        jobs,
        needsGarage,
        required: jobs.filter((j) => j.required).length,
        advisory: jobs.filter((j) => !j.required).length,
    };
};

/**
 * True when at least one damaged component can only be dealt with on a lift.
 * A vehicle that fails this is the one that has to be towed in.
 */
AGM.Health.needsWorkshop = function (blueprint, health) {
    for (const comp of AGM.Components.list(blueprint)) {
        const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        if (!AGM.Health.needsService(value, comp)) continue;
        if (AGM.Health.repairMethod(comp, value) === 'garage') return true;
    }
    return false;
};

/**
 * Everything a mechanic could deal with without a lift. Used to answer the
 * question the driver actually cares about: "can you fix it here, or is this a
 * tow?" Returns { mobile, garage } lists of component ids that need service.
 */
AGM.Health.triage = function (blueprint, health) {
    const mobile = [];
    const garage = [];
    for (const comp of AGM.Components.list(blueprint)) {
        const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        if (!AGM.Health.needsService(value, comp)) continue;
        (AGM.Health.repairMethod(comp, value) === 'garage' ? garage : mobile).push(comp.id);
    }
    return { mobile, garage, tow: garage.length > 0 };
};

/**
 * Single overall condition figure, 0-100. Critical components count double so
 * a car with a dead gearbox never reads as "mostly fine".
 */
AGM.Health.overall = function (blueprint, health) {
    let total = 0;
    let weight = 0;
    for (const comp of AGM.Components.list(blueprint)) {
        const value = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        const w = comp.critical ? 2 : 1;
        total += value * w;
        weight += w;
    }
    return weight ? AGM.util.round(total / weight, 1) : 100;
};

/**
 * Applies a wear source to a health record, in place, honouring per-component
 * decay rates and the wearOn chains (a dry sump eating an engine).
 * Returns the components that actually moved.
 *
 * `opts.floor` stops wear at a health value rather than at zero, and
 * `opts.maxPerComponent` caps how far any single component may move in one
 * call. Both are used for client-reported wear, where the numbers cannot be
 * trusted; server-side callers leave them off and get the full effect.
 */
AGM.Health.applyWear = function (blueprint, health, sourceId, amount, opts = {}) {
    const source = AGM.Damage.sources[sourceId];
    if (!source || !source.blueprints.includes(blueprint) || !(amount > 0)) return {};

    const floor = Number.isFinite(opts.floor) ? AGM.util.clamp(opts.floor, 0, 100) : 0;
    const maxPerComponent = Number.isFinite(opts.maxPerComponent) ? opts.maxPerComponent : Infinity;

    const changed = {};
    for (const comp of AGM.Components.list(blueprint)) {
        const weight = source.weights[comp.id];
        if (!weight) continue;

        let wear = amount * weight * comp.decay;

        /* Neglected support systems accelerate wear on what they protect. */
        for (const other of AGM.Components.list(blueprint)) {
            if (!other.wearOn || !other.wearOn[comp.id]) continue;
            const otherHealth = Number.isFinite(health[other.id]) ? health[other.id] : 100;
            if (otherHealth >= 50) continue;
            const severity = (50 - otherHealth) / 50; // 0 at 50%, 1 at 0%
            wear *= 1 + (other.wearOn[comp.id] - 1) * severity;
        }

        if (wear <= 0) continue;
        wear = Math.min(wear, maxPerComponent);

        const before = Number.isFinite(health[comp.id]) ? health[comp.id] : 100;
        /* Already at or under the floor: this source cannot push it lower. */
        if (before <= floor) continue;

        const after = AGM.util.round(AGM.util.clamp(before - wear, floor, 100), 1);
        if (after !== before) {
            health[comp.id] = after;
            changed[comp.id] = after;
        }
    }
    return changed;
};

/** Adds health back to one component, clamped to `cap`. Returns the new value. */
AGM.Health.repairComponent = function (health, id, amount, cap = 100) {
    const before = Number.isFinite(health[id]) ? health[id] : 100;
    const after = AGM.util.round(AGM.util.clamp(before + amount, 0, cap), 1);
    health[id] = Math.max(before, after);
    return health[id];
};

/** Default tier record: everything stock. */
AGM.Health.blankTiers = function (blueprint) {
    const out = {};
    for (const cat of Object.keys(AGM.Tiers.categories(blueprint))) out[cat] = 0;
    return out;
};

/** Clamp a tier record to valid indexes for the blueprint. */
AGM.Health.sanitiseTiers = function (blueprint, tiers) {
    const out = {};
    for (const cat of Object.keys(AGM.Tiers.categories(blueprint))) {
        const raw = tiers ? Math.floor(Number(tiers[cat])) : 0;
        out[cat] = Number.isFinite(raw) ? AGM.util.clamp(raw, 0, AGM.Tiers.maxIndex(blueprint, cat)) : 0;
    }
    return out;
};
