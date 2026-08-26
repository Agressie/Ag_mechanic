/*
 * ag_mechanic - repairs
 * ============================================================================
 * Three ways to fix something, and the component decides which are legal:
 *
 *   improvised  tape or cable ties. Anyone can do it, it needs no parts, and it
 *               will never take a component past Config.repair.fieldRepairCap
 *               (40%). Enough to limp somewhere. Not enough to be finished with.
 *   mobile      a mechanic swaps the actual part at the roadside. Back to 100%.
 *   workshop    same, but the vehicle has to be sitting in a bay.
 *
 * Nothing can be repaired that has not been found first: every call checks the
 * caller holds a live diagnostic report covering that component.
 * ============================================================================
 */

AGM.repair = {};

/* ---------------------------------------------------------------- bay checks */

/** Point-in-rotated-box, matching how ox_lib box zones are defined. */
function insideBox(point, bay) {
    const [cx, cy, cz] = bay.coords;
    const [sx, sy, sz] = bay.size;
    const rot = (-(bay.rotation || 0) * Math.PI) / 180;

    const dx = point[0] - cx;
    const dy = point[1] - cy;
    const dz = point[2] - cz;

    const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
    const ry = dx * Math.sin(rot) + dy * Math.cos(rot);

    return Math.abs(rx) <= sx / 2 && Math.abs(ry) <= sy / 2 && Math.abs(dz) <= sz / 2;
}

/** Which shop bay (if any) these coordinates are inside. */
AGM.repair.bayAt = function (coords) {
    const shop = AGM.Locations.shop;
    for (const bay of shop.bays || []) {
        if (insideBox(coords, bay)) return { shop, bay };
    }
    return null;
};

/* ------------------------------------------------------------- shared checks */

/**
 * Resolves everything a repair call needs and runs every guard once, so the
 * three entry points below cannot drift apart.
 */
async function context(src, args, opts = {}) {
    const player = AGM.core.getPlayer(src);
    if (!player) return { error: 'noPlayer' };

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return { error: 'noVehicle' };

    const ped = GetPlayerPed(String(src));
    const pedCoords = GetEntityCoords(ped);
    const vehCoords = GetEntityCoords(entity);
    if (AGM.util.dist(pedCoords, vehCoords) > AGM.Config.security.maxInteractDistance + 3) {
        return { error: 'tooFar' };
    }

    if (GetEntitySpeed(entity) > 1.0) return { error: 'vehicleMoving' };

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const blueprint = AGM.Classes.resolve(Number(args.classId), args.model);
    if (!AGM.Classes.isSupported(blueprint)) return { error: 'unsupported' };

    const key = AGM.util.vehicleKey(plate, args.vin);
    const record = await AGM.vehicles.load(key, plate, args.model, blueprint);
    if (!record) return { error: 'noRecord' };

    const comp = AGM.Components.get(blueprint, String(args.component || ''));
    if (!comp) return { error: 'noComponent' };

    if (!AGM.diagnose.knows(key, player.citizenid, comp.id)) return { error: 'diagnoseFirst' };

    if (opts.requireJob) {
        if (player.job.name !== AGM.Config.job.name) return { error: 'noJob' };
        const tool = AGM.Config.repair.toolItem;
        if (tool && !AGM.inv.has(src, tool, 1)) return { error: 'noTool' };
    }

    const bay = AGM.repair.bayAt(vehCoords);

    return { player, entity, netId, record, comp, key, bay, vehCoords };
}

/** Applies the result of a repair: persist, invalidate reports, tell clients. */
async function commit(ctx, detail) {
    ctx.record.dirty = true;
    AGM.diagnose.noteRepair(ctx.key, ctx.record.blueprint, ctx.comp.id, ctx.record.health[ctx.comp.id]);
    await AGM.vehicles.saveNow(ctx.key);
    AGM.vehicles.broadcast(ctx.record, ctx.netId);
    AGM.db.log(ctx.bay ? ctx.bay.shop.id : '', ctx.player.name, detail.action, detail);
}

/* --------------------------------------------------------- improvised repairs */

AGM.rpc.register('repair:field', async (src, args) => {
    const ctx = await context(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const { comp, record } = ctx;
    const value = record.health[comp.id];
    const cap = AGM.Config.repair.fieldRepairCap;

    if (!comp.field) return { ok: false, reason: 'fieldNotPossible' };
    if (value >= cap) return { ok: false, reason: 'fieldCapReached' };

    const consumed = AGM.inv.removeAny(src, comp.fieldItems);
    if (!consumed) {
        return { ok: false, reason: 'noItem', item: (comp.fieldItems[0] || '') };
    }

    /* Tape does not always hold. The item is gone either way. */
    if (Math.random() < AGM.Config.repair.fieldRepairFailChance) {
        AGM.db.log('', ctx.player.name, 'repair_field_failed', { plate: record.plate, component: comp.id, consumed });
        return { ok: false, reason: 'repairFailed', consumed };
    }

    const gain = AGM.util.randFloat(AGM.Config.repair.fieldRepairGain.min, AGM.Config.repair.fieldRepairGain.max);
    const after = AGM.Health.repairComponent(record.health, comp.id, gain, cap);

    await commit(ctx, {
        action: 'repair_field',
        plate: record.plate,
        component: comp.id,
        consumed,
        from: value,
        to: after,
    });

    return {
        ok: true,
        component: comp.id,
        label: comp.label,
        health: after,
        capped: after >= cap - 0.05,
        consumed,
    };
});

/* ----------------------------------------------------------- proper repairs */

async function properRepair(src, args, requireBay) {
    const ctx = await context(src, args, { requireJob: true });
    if (ctx.error) return { ok: false, reason: ctx.error };

    const { comp, record } = ctx;
    const value = record.health[comp.id];
    if (value >= 99.95) return { ok: false, reason: 'alreadyFine' };

    const method = AGM.Health.repairMethod(comp, value);

    if (method === 'garage') {
        if (!ctx.bay) return { ok: false, reason: 'notInBay' };
    } else if (requireBay && !ctx.bay) {
        return { ok: false, reason: 'notInBay' };
    }

    if (comp.part && !AGM.inv.has(src, comp.part, 1)) {
        return { ok: false, reason: 'noItem', item: comp.part, itemLabel: AGM.Shop.label(comp.part) };
    }
    if (comp.part && !AGM.inv.remove(src, comp.part, 1)) {
        return { ok: false, reason: 'noItem', item: comp.part, itemLabel: AGM.Shop.label(comp.part) };
    }

    const after = AGM.Health.repairComponent(record.health, comp.id, 100, AGM.Config.repair.partRepairTarget);

    await commit(ctx, {
        action: method === 'garage' ? 'repair_workshop' : 'repair_mobile',
        plate: record.plate,
        component: comp.id,
        part: comp.part,
        from: value,
        to: after,
    });

    return { ok: true, component: comp.id, label: comp.label, health: after, method, part: comp.part };
}

/** Roadside part swap. Refuses anything the component says needs a lift. */
AGM.rpc.register('repair:mobile', (src, args) => properRepair(src, args, false));

/** Workshop repair. Same code path, but the bay is mandatory. */
AGM.rpc.register('repair:workshop', (src, args) => properRepair(src, args, true));

/* --------------------------------------------------------------- full service */

/**
 * Works through everything the mechanic has a diagnosis for and can legally fix
 * where they are standing, consuming parts as it goes. Reports back exactly what
 * it did and what it could not, rather than silently doing half a job.
 */
AGM.rpc.register('repair:service', async (src, args) => {
    const player = AGM.core.getPlayer(src);
    if (!player) return { ok: false, reason: 'noPlayer' };
    if (player.job.name !== AGM.Config.job.name) return { ok: false, reason: 'noJob' };

    const tool = AGM.Config.repair.toolItem;
    if (tool && !AGM.inv.has(src, tool, 1)) return { ok: false, reason: 'noTool' };

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return { ok: false, reason: 'noVehicle' };
    if (GetEntitySpeed(entity) > 1.0) return { ok: false, reason: 'vehicleMoving' };

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const blueprint = AGM.Classes.resolve(Number(args.classId), args.model);
    if (!AGM.Classes.isSupported(blueprint)) return { ok: false, reason: 'unsupported' };

    const key = AGM.util.vehicleKey(plate, args.vin);
    const record = await AGM.vehicles.load(key, plate, args.model, blueprint);
    if (!record) return { ok: false, reason: 'noRecord' };

    if (!AGM.diagnose.hasAny(key, player.citizenid)) return { ok: false, reason: 'diagnoseFirst' };

    const vehCoords = GetEntityCoords(entity);
    const bay = AGM.repair.bayAt(vehCoords);

    const done = [];
    const skipped = [];

    for (const job of AGM.Health.repairPlan(blueprint, record.health).jobs) {
        if (!job.required) continue;
        if (!AGM.diagnose.knows(key, player.citizenid, job.id)) {
            skipped.push({ id: job.id, label: job.label, reason: 'undiagnosed' });
            continue;
        }
        if (job.method === 'garage' && !bay) {
            skipped.push({ id: job.id, label: job.label, reason: 'needsWorkshop' });
            continue;
        }

        const comp = AGM.Components.get(blueprint, job.id);
        if (comp.part) {
            if (!AGM.inv.has(src, comp.part, 1) || !AGM.inv.remove(src, comp.part, 1)) {
                skipped.push({ id: job.id, label: job.label, reason: 'noPart', part: comp.part, partLabel: AGM.Shop.label(comp.part) });
                continue;
            }
        }

        const from = record.health[job.id];
        const to = AGM.Health.repairComponent(record.health, job.id, 100, AGM.Config.repair.partRepairTarget);
        done.push({ id: job.id, label: job.label, from, to, part: comp.part });
    }

    if (done.length) {
        record.dirty = true;
        for (const entry of done) AGM.diagnose.noteRepair(key, blueprint, entry.id, entry.to);
        await AGM.vehicles.saveNow(key);
        AGM.vehicles.broadcast(record, netId);
        AGM.db.log(bay ? bay.shop.id : '', player.name, 'repair_service', { plate, done: done.map((d) => d.id) });
    }

    return { ok: true, done, skipped, inBay: !!bay };
});

/* ----------------------------------------------------------------- utilities */

/**
 * "Can you fix it here?" - the question a driver asks before deciding whether to
 * call a tow. Answered from the caller's own report, so it is only as good as
 * their diagnosis.
 */
AGM.rpc.register('repair:triage', async (src, args) => {
    const player = AGM.core.getPlayer(src);
    if (!player) return null;

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return null;

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const key = AGM.util.vehicleKey(plate, args.vin);
    const record = AGM.vehicles.peek(key);
    if (!record) return null;

    const report = AGM.diagnose.report(record, player.citizenid);
    if (!report) return { ok: false, reason: 'diagnoseFirst' };

    return { ok: true, triage: report.triage, plan: AGM.Health.repairPlan(record.blueprint, record.health) };
});
