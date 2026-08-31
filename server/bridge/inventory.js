/*
 * ag_mechanic - inventory bridge
 * ============================================================================
 * Adapters for ox_inventory, qb-inventory and ESX, plus a database-backed
 * fallback stash so the tablet's parts store still works on a server whose
 * inventory has no stash concept of its own.
 *
 * Player-inventory operations and stash operations are resolved separately:
 * a server can perfectly well run ox_inventory for players while the stash
 * falls back, or vice versa.
 * ============================================================================
 */

AGM.inv = {};

const ag_mechanic_inventory_started = (res) => GetResourceState(res) === 'started';

function ag_mechanic_inventory_tryExport(resource, name, ...args) {
    try {
        /* `global.exports` because server scripts are CommonJS modules, where the
           bare `exports` identifier is module.exports. */
        const target = global.exports[resource];
        const fn = target && target[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    } catch (err) {
        AGM.log.debug(`inventory export ${resource}.${name} failed:`, err && err.message);
        return undefined;
    }
}

/** Which inventory resource is driving player inventories. */
AGM.inv.backend = 'none';
/** Which one is driving the shop stash. */
AGM.inv.stashBackend = 'db';

AGM.inv.detect = function () {
    if (ag_mechanic_inventory_started('ox_inventory')) {
        AGM.inv.backend = 'ox';
        AGM.inv.stashBackend = 'ox';
    } else if (ag_mechanic_inventory_started('qb-inventory')) {
        AGM.inv.backend = 'qb';
        AGM.inv.stashBackend = 'qb';
    } else if (ag_mechanic_inventory_started('es_extended')) {
        AGM.inv.backend = 'esx';
        AGM.inv.stashBackend = 'db';
    } else {
        AGM.inv.backend = 'none';
        AGM.inv.stashBackend = 'db';
    }
    AGM.log.info(`inventory backend: ${AGM.inv.backend} (stash: ${AGM.inv.stashBackend})`);
    return AGM.inv.backend;
};

/* ------------------------------------------------------- player inventories */

/** How many of `item` this player is carrying. */
AGM.inv.count = function (src, item) {
    const id = Number(src);
    switch (AGM.inv.backend) {
        case 'ox': {
            const n = ag_mechanic_inventory_tryExport('ox_inventory', 'GetItemCount', id, item);
            return Number(n) || 0;
        }
        case 'qb': {
            let n = ag_mechanic_inventory_tryExport('qb-inventory', 'GetItemCount', id, item);
            if (n === undefined) {
                const entry = ag_mechanic_inventory_tryExport('qb-inventory', 'GetItemByName', id, item);
                n = entry && entry.amount;
            }
            return Number(n) || 0;
        }
        case 'esx': {
            /* ESX's canonical accessor is the xPlayer object itself, which the
               core bridge keeps hold of. */
            const p = AGM.core.getPlayer(id);
            const raw = p && p._raw;
            if (raw && typeof raw.getInventoryItem === 'function') {
                const entry = raw.getInventoryItem(item);
                return entry ? Number(entry.count) || 0 : 0;
            }
            return 0;
        }
        default:
            return 0;
    }
};

AGM.inv.has = (src, item, count = 1) => AGM.inv.count(src, item) >= count;

/** Removes items. Returns true only if the removal actually happened. */
AGM.inv.remove = function (src, item, count = 1) {
    const id = Number(src);
    const n = Math.max(1, Math.floor(count));
    if (AGM.inv.count(id, item) < n) return false;

    switch (AGM.inv.backend) {
        case 'ox': {
            const ok = ag_mechanic_inventory_tryExport('ox_inventory', 'RemoveItem', id, item, n);
            return ok !== false && ok !== undefined;
        }
        case 'qb': {
            const ok = ag_mechanic_inventory_tryExport('qb-inventory', 'RemoveItem', id, item, n, false, 'ag_mechanic');
            if (ok !== undefined) return ok !== false;
            const p = AGM.core.getPlayer(id);
            const raw = p && p._raw;
            if (raw && raw.Functions && typeof raw.Functions.RemoveItem === 'function') {
                return !!raw.Functions.RemoveItem(item, n);
            }
            return false;
        }
        case 'esx': {
            const p = AGM.core.getPlayer(id);
            const raw = p && p._raw;
            if (raw && typeof raw.removeInventoryItem === 'function') {
                raw.removeInventoryItem(item, n);
                return true;
            }
            return false;
        }
        default:
            return false;
    }
};

/** Gives items. Returns true on success. */
AGM.inv.add = function (src, item, count = 1, metadata) {
    const id = Number(src);
    const n = Math.max(1, Math.floor(count));

    switch (AGM.inv.backend) {
        case 'ox': {
            const ok = ag_mechanic_inventory_tryExport('ox_inventory', 'AddItem', id, item, n, metadata);
            return ok !== false && ok !== undefined;
        }
        case 'qb': {
            const ok = ag_mechanic_inventory_tryExport('qb-inventory', 'AddItem', id, item, n, false, metadata, 'ag_mechanic');
            if (ok !== undefined) return ok !== false;
            const p = AGM.core.getPlayer(id);
            const raw = p && p._raw;
            if (raw && raw.Functions && typeof raw.Functions.AddItem === 'function') {
                return !!raw.Functions.AddItem(item, n, false, metadata);
            }
            return false;
        }
        case 'esx': {
            const p = AGM.core.getPlayer(id);
            const raw = p && p._raw;
            if (raw && typeof raw.addInventoryItem === 'function') {
                raw.addInventoryItem(item, n);
                return true;
            }
            return false;
        }
        default:
            return false;
    }
};

/**
 * Removes the first item in `list` the player actually has. Used for the
 * improvised repairs, where either tape or ties will do.
 * Returns the item consumed, or null.
 */
AGM.inv.removeAny = function (src, list) {
    for (const item of list || []) {
        if (AGM.inv.count(src, item) > 0 && AGM.inv.remove(src, item, 1)) return item;
    }
    return null;
};

/* ------------------------------------------------------------------ stashes */

AGM.inv.registerStash = function (shop) {
    const stash = shop.stash;
    if (!stash) return;

    if (AGM.inv.stashBackend === 'ox') {
        ag_mechanic_inventory_tryExport('ox_inventory', 'RegisterStash', stash.id, stash.label, stash.slots, stash.weight, false, {
            [AGM.Config.job.name]: 0,
        });
    } else if (AGM.inv.stashBackend === 'qb') {
        ag_mechanic_inventory_tryExport('qb-inventory', 'CreateInventory', stash.id, {
            label: stash.label,
            maxweight: stash.weight,
            slots: stash.slots,
        });
    }
    AGM.log.debug(`registered stash ${stash.id} (${AGM.inv.stashBackend})`);
};

/** Opens the stash UI for a player. */
AGM.inv.openStash = function (src, shop) {
    const stash = shop.stash;
    if (!stash) return false;

    if (AGM.inv.stashBackend === 'ox') {
        const ok = ag_mechanic_inventory_tryExport('ox_inventory', 'forceOpenInventory', Number(src), 'stash', stash.id);
        if (ok !== undefined) return true;
        emitNet('ag_mechanic:client:openStash', Number(src), stash.id);
        return true;
    }
    if (AGM.inv.stashBackend === 'qb') {
        const ok = ag_mechanic_inventory_tryExport('qb-inventory', 'OpenInventory', Number(src), stash.id, {
            label: stash.label, maxweight: stash.weight, slots: stash.slots,
        });
        if (ok !== undefined) return true;
        emitNet('ag_mechanic:client:openStash', Number(src), stash.id);
        return true;
    }
    /* Database fallback: the tablet's own stash view is the UI. */
    return false;
};

/**
 * Stash contents as [{ item, label, count }]. The tablet renders this, so it is
 * normalised across every backend.
 */
AGM.inv.stashContents = async function (shop) {
    const stash = shop.stash;
    if (!stash) return [];

    if (AGM.inv.stashBackend === 'ox') {
        let items = ag_mechanic_inventory_tryExport('ox_inventory', 'GetInventoryItems', stash.id);
        if (!items) {
            const inv = ag_mechanic_inventory_tryExport('ox_inventory', 'GetInventory', stash.id);
            items = inv && inv.items;
        }
        return normaliseStashList(items);
    }

    if (AGM.inv.stashBackend === 'qb') {
        const inv = ag_mechanic_inventory_tryExport('qb-inventory', 'GetInventory', stash.id);
        return normaliseStashList(inv && (inv.items || inv));
    }

    /* Database fallback. */
    const rows = await AGM.db.query(
        'SELECT item, count FROM ag_mechanic_stash WHERE shop = ? AND count > 0 ORDER BY item',
        [shop.id],
    ).catch(() => []);
    return (rows || []).map((r) => ({
        item: r.item,
        label: AGM.inv.itemLabel(r.item),
        count: Number(r.count) || 0,
    }));
};

/** Collapses a backend's slot list into per-item totals. */
function normaliseStashList(items) {
    if (!items) return [];
    const totals = new Map();
    const values = Array.isArray(items) ? items : Object.values(items);
    for (const entry of values) {
        if (!entry || !entry.name) continue;
        const count = Number(entry.count !== undefined ? entry.count : entry.amount) || 0;
        if (count <= 0) continue;
        totals.set(entry.name, (totals.get(entry.name) || 0) + count);
    }
    return Array.from(totals.entries())
        .map(([item, count]) => ({ item, label: AGM.inv.itemLabel(item), count }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/** Puts items into the shop stash. Used by deliveries. */
AGM.inv.stashAdd = async function (shop, item, count) {
    const n = Math.max(1, Math.floor(count));
    const stash = shop.stash;
    if (!stash) return false;

    if (AGM.inv.stashBackend === 'ox') {
        const ok = ag_mechanic_inventory_tryExport('ox_inventory', 'AddItem', stash.id, item, n);
        return ok !== false && ok !== undefined;
    }
    if (AGM.inv.stashBackend === 'qb') {
        const ok = ag_mechanic_inventory_tryExport('qb-inventory', 'AddItem', stash.id, item, n, false, null, 'ag_mechanic');
        return ok !== undefined && ok !== false;
    }

    await AGM.db.query(
        `INSERT INTO ag_mechanic_stash (shop, item, count) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE count = count + VALUES(count)`,
        [shop.id, item, n],
    ).catch((err) => AGM.log.error('stashAdd failed:', err && err.message));
    return true;
};

/** Takes items out of the shop stash. */
AGM.inv.stashRemove = async function (shop, item, count) {
    const n = Math.max(1, Math.floor(count));
    const stash = shop.stash;
    if (!stash) return false;

    if (AGM.inv.stashBackend === 'ox') {
        const ok = ag_mechanic_inventory_tryExport('ox_inventory', 'RemoveItem', stash.id, item, n);
        return ok !== false && ok !== undefined;
    }
    if (AGM.inv.stashBackend === 'qb') {
        const ok = ag_mechanic_inventory_tryExport('qb-inventory', 'RemoveItem', stash.id, item, n, false, 'ag_mechanic');
        return ok !== undefined && ok !== false;
    }

    const affected = await AGM.db.update(
        'UPDATE ag_mechanic_stash SET count = count - ? WHERE shop = ? AND item = ? AND count >= ?',
        [n, shop.id, item, n],
    ).catch(() => 0);
    return Number(affected) > 0;
};

/** Best available human label for an item name. */
AGM.inv.itemLabel = function (item) {
    if (AGM.inv.backend === 'ox') {
        const items = ag_mechanic_inventory_tryExport('ox_inventory', 'Items');
        if (items && items[item] && items[item].label) return items[item].label;
    }
    return AGM.Shop.label(item);
};
