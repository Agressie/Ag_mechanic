/*
 * ag_mechanic - named upgrade installs
 * ============================================================================
 * Fitting "Titanium Brakes" rather than "Brakes 2". For land vehicles the tier
 * is written through to GTA's own mod slot as well as our record; for aircraft
 * and boats, where GTA has no mod slots, our record is the only truth and the
 * performance effect comes from the tier's own multipliers.
 * ============================================================================
 */

AGM.upgrades = {};

async function resolve(src, args) {
    const player = AGM.core.getPlayer(src);
    if (!player) return { error: 'noPlayer' };

    const netId = Number(args.netId);
    const entity = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
    if (!entity || !DoesEntityExist(entity)) return { error: 'noVehicle' };

    const ped = GetPlayerPed(String(src));
    if (AGM.util.dist(GetEntityCoords(ped), GetEntityCoords(entity)) > AGM.Config.security.maxInteractDistance + 3) {
        return { error: 'tooFar' };
    }

    const plate = AGM.util.normalisePlate(args.plate || GetVehicleNumberPlateText(entity));
    const blueprint = AGM.Classes.resolve(Number(args.classId), args.model);
    if (!AGM.Classes.isSupported(blueprint)) return { error: 'unsupported' };

    const key = AGM.util.vehicleKey(plate, args.vin);
    const record = await AGM.vehicles.load(key, plate, args.model, blueprint);
    if (!record) return { error: 'noRecord' };

    return { player, entity, netId, record, key, blueprint, bay: AGM.repair.bayAt(GetEntityCoords(entity)) };
}

/** Everything fittable to this vehicle, with what is in stock on the mechanic. */
AGM.rpc.register('upgrades:list', async (src, args) => {
    const ctx = await resolve(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const { blueprint, record } = ctx;
    const categories = [];

    for (const [catId, cat] of Object.entries(AGM.Tiers.categories(blueprint))) {
        const current = Number(record.tiers[catId]) || 0;
        const tiers = cat.tiers.map((tier, index) => ({
            index,
            label: tier.label,
            blurb: tier.blurb,
            item: tier.item,
            itemLabel: tier.item ? AGM.Shop.label(tier.item) : null,
            labour: tier.labour,
            install: tier.install,
            fitted: index === current,
            /* Tier 0 is removal - it never needs a part. */
            have: !tier.item || AGM.inv.has(src, tier.item, 1),
            perf: tier.perf,
        }));

        categories.push({
            id: catId,
            label: cat.label,
            native: !cat.virtual,
            mod: cat.mod !== undefined ? cat.mod : null,
            current,
            tiers,
        });
    }

    return {
        ok: true,
        plate: record.plate,
        blueprint,
        blueprintLabel: AGM.Classes.labels[blueprint] || blueprint,
        inBay: !!ctx.bay,
        categories,
        performance: AGM.Health.performance(blueprint, record.health, record.tiers),
    };
});

/** Fits (or removes) a tier. */
AGM.rpc.register('upgrades:install', async (src, args) => {
    const ctx = await resolve(src, args);
    if (ctx.error) return { ok: false, reason: ctx.error };

    const { player, record, blueprint } = ctx;

    if (player.job.name !== AGM.Config.job.name) return { ok: false, reason: 'noJob' };
    const tool = AGM.Config.repair.toolItem;
    if (tool && !AGM.inv.has(src, tool, 1)) return { ok: false, reason: 'noTool' };
    if (GetEntitySpeed(ctx.entity) > 1.0) return { ok: false, reason: 'vehicleMoving' };

    const catId = String(args.category || '');
    const cat = AGM.Tiers.category(blueprint, catId);
    if (!cat) return { ok: false, reason: 'noCategory' };

    const index = Math.floor(Number(args.tier));
    if (!Number.isFinite(index) || index < 0 || index > AGM.Tiers.maxIndex(blueprint, catId)) {
        return { ok: false, reason: 'noTier' };
    }

    const current = Number(record.tiers[catId]) || 0;
    if (index === current) return { ok: false, reason: 'alreadyFitted' };

    const tier = cat.tiers[index];
    if (tier.install === 'garage' && !ctx.bay) return { ok: false, reason: 'notInBay' };

    if (tier.item) {
        if (!AGM.inv.has(src, tier.item, 1)) {
            return { ok: false, reason: 'noItem', item: tier.item, itemLabel: AGM.Shop.label(tier.item) };
        }
        if (!AGM.inv.remove(src, tier.item, 1)) {
            return { ok: false, reason: 'noItem', item: tier.item, itemLabel: AGM.Shop.label(tier.item) };
        }
    }

    record.tiers[catId] = index;
    record.dirty = true;
    await AGM.vehicles.saveNow(ctx.key);

    /* Land vehicles get the real GTA mod written too, so the visual and the
       handling both change. Aircraft and boats are ours alone. */
    if (!cat.virtual && cat.mod !== undefined) {
        emitNet('ag_mechanic:client:applyMod', -1, {
            netId: ctx.netId,
            mod: cat.mod,
            value: AGM.Tiers.toModValue(index),
            toggle: !!cat.toggle,
        });
    }

    AGM.vehicles.broadcast(record, ctx.netId);
    AGM.db.log(ctx.bay ? ctx.bay.shop.id : '', player.name, 'upgrade_install', {
        plate: record.plate, category: catId, tier: index, label: tier.label,
    });

    return {
        ok: true,
        category: catId,
        categoryLabel: cat.label,
        tier: index,
        label: tier.label,
        labour: tier.labour,
        removed: index === 0,
    };
});

/** Read-only export for other resources that want the fitted tier names. */
global.exports('getVehicleTiers', (plate, vin) => {
    const record = AGM.vehicles.peek(AGM.util.vehicleKey(plate, vin));
    if (!record) return null;
    const out = {};
    for (const [catId, index] of Object.entries(record.tiers)) {
        const tier = AGM.Tiers.tier(record.blueprint, catId, index);
        out[catId] = { index, label: tier ? tier.label : String(index) };
    }
    return out;
});
