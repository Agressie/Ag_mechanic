/*
 * ag_mechanic - server entry point
 * ============================================================================
 * Boot order, timers and the handful of RPCs that do not belong to any single
 * subsystem.
 * ============================================================================
 */

let booted = false;
const intervals = [];

async function boot() {
    if (booted) return;
    booted = true;

    await AGM.db.migrate();

    AGM.inv.detect();
    AGM.society.detect();

    if (!AGM.core.available()) {
        AGM.log.warn('qbx_core is not started - jobs, money and identity will not work until it is.');
    }

    AGM.inv.registerStash(AGM.Locations.shop);

    /* Persist changed vehicles, expire caches, advance orders. */
    intervals.push(setInterval(() => {
        AGM.vehicles.flush().catch((err) => AGM.log.error('flush failed:', err && err.message));
    }, AGM.Config.persistence.saveInterval));

    intervals.push(setInterval(() => {
        AGM.vehicles.evict();
        AGM.diagnose.sweep();
    }, 5 * 60 * 1000));

    intervals.push(setInterval(() => {
        AGM.shop.tick().catch((err) => AGM.log.error('order tick failed:', err && err.message));
    }, 60 * 1000));

    /* One prune on boot is plenty. */
    setTimeout(() => AGM.vehicles.prune().catch(() => {}), 30 * 1000);

    /* Catch up on any orders that came due while the server was down. */
    setTimeout(() => AGM.shop.tick().catch(() => {}), 5 * 1000);

    AGM.log.info(`ready - ${Object.keys(AGM.Components.blueprints).length} vehicle blueprints`);
}

on('onResourceStart', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    boot().catch((err) => AGM.log.error('boot failed:', err && err.stack ? err.stack : err));
});

on('onResourceStop', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    for (const handle of intervals) clearInterval(handle);
    if (AGM.delivery) AGM.delivery.shutdown();
    /* Best effort: the runtime does not wait for us, but small flushes land. */
    AGM.vehicles.flush().catch(() => {});
});

/* ------------------------------------------------------------------- tablet */

AGM.rpc.register('tablet:open', async (src) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'tabletNoAccess' };

    const item = AGM.Config.tablet.item;
    if (item && !AGM.inv.has(src, item, 1)) {
        return { ok: false, reason: 'noItem', item, itemLabel: AGM.Shop.label(item) };
    }

    const me = AGM.core.getPlayer(src);
    const shop = AGM.Locations.shop;

    const gradeDef = AGM.Config.job.grades[me.job.grade] || {};
    const apps = AGM.Config.tablet.apps.filter((app) => me.job.grade >= (app.grade || 0));

    return {
        ok: true,
        user: {
            name: me.name,
            citizenid: me.citizenid,
            grade: me.job.grade,
            gradeLabel: gradeDef.label || me.job.gradeLabel || '',
        },
        shop: { id: shop.id, label: shop.label },
        apps,
        can: {
            hire: !!gradeDef.hire,
            fire: !!gradeDef.fire,
            promote: !!gradeDef.promote,
            order: !!gradeDef.order,
            stashTake: !!gradeDef.stashTake,
            stashPut: !!gradeDef.stashPut,
        },
    };
});

/** Home screen figures. Cheap enough to call every time the app opens. */
AGM.rpc.register('tablet:dashboard', async (src) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const shop = AGM.Locations.shop;

    let openOrders = [];
    if (AGM.db.ready) {
        const rows = await AGM.db.query(
            `SELECT id, status, ready_at, cost FROM ag_mechanic_orders
             WHERE shop = ? AND status IN ('pending','ready','dispatched') ORDER BY ready_at ASC`,
            [shop.id],
        ).catch(() => []);
        openOrders = (rows || []).map((r) => ({
            id: Number(r.id),
            status: r.status,
            readyAt: Number(r.ready_at) || 0,
            cost: Number(r.cost) || 0,
            etaMs: (Number(r.ready_at) || 0) - Date.now(),
        }));
    }

    const staff = AGM.core.jobMembers(AGM.Config.job.name);
    const stash = await AGM.inv.stashContents(shop);

    return {
        ok: true,
        shop: { id: shop.id, label: shop.label },
        openOrders,
        readyCount: openOrders.filter((o) => o.status === 'ready').length,
        staff: { total: staff.length, online: staff.filter((s) => s.online).length },
        stash: {
            lines: stash.length,
            units: stash.reduce((a, s) => a + s.count, 0),
            slots: shop.stash ? shop.stash.slots : 0,
            lowStock: lowStock(stash),
        },
        delivery: AGM.delivery.isBusy() ? AGM.delivery.state().phase : null,
        balance: AGM.society.balance(AGM.Config.economy.society),
    };
});

/** Consumables the shop is nearly out of - the thing a manager wants to see. */
function lowStock(stash) {
    const counts = new Map(stash.map((s) => [s.item, s.count]));
    const watch = ['ducttape', 'zipties', 'air_filter', 'oil_filter', 'brake_pads', 'tire', 'spark_plugs', 'glass_set'];
    return watch
        .map((item) => ({ item, label: AGM.Shop.label(item), count: counts.get(item) || 0 }))
        .filter((entry) => entry.count < 5);
}

/** Minimal identity lookup, for clients that cannot read the core directly. */
AGM.rpc.register('player:me', async (src) => {
    const me = AGM.core.getPlayer(src);
    if (!me) return null;
    return { citizenid: me.citizenid, name: me.name, job: me.job.name, grade: me.job.grade };
});

/* ---------------------------------------------------------------- admin bits */

RegisterCommand('agmechanic', async (source, args) => {
    const src = Number(source);
    const sub = String(args[0] || '').toLowerCase();

    /* Console only, or an admin with ace permission. */
    if (src !== 0 && !IsPlayerAceAllowed(String(src), 'command.agmechanic')) {
        AGM.core.notify(src, 'Not allowed.', 'error');
        return;
    }

    const say = (msg) => (src === 0 ? AGM.log.info(msg) : AGM.core.notify(src, msg, 'inform'));

    switch (sub) {
        case 'flush': {
            const n = await AGM.vehicles.flush();
            say(`flushed ${n} vehicle record(s)`);
            break;
        }
        case 'stats':
            say(`cached vehicles: ${AGM.vehicles.cacheSize()} | inventory: ${AGM.inv.backend} | society: ${AGM.society.backend} | db: ${AGM.db.ready}`);
            break;
        case 'orders': {
            await AGM.shop.tick();
            say('order tick run');
            break;
        }
        case 'reset': {
            /* Wipes health for one plate, for testing. */
            const plate = AGM.util.normalisePlate(args[1] || '');
            if (!plate) return say('usage: agmechanic reset <plate>');
            const key = AGM.util.vehicleKey(plate);
            const record = AGM.vehicles.peek(key);
            if (record) {
                record.health = AGM.Health.blank(record.blueprint);
                record.symptoms = [];
                record.dirty = true;
                await AGM.vehicles.saveNow(key);
                AGM.vehicles.broadcast(record);
                say(`reset ${plate}`);
            } else if (AGM.db.ready) {
                await AGM.db.update('DELETE FROM ag_mechanic_vehicles WHERE vehicle_key = ?', [key]).catch(() => 0);
                say(`deleted stored record for ${plate}`);
            } else {
                say('no record for that plate');
            }
            break;
        }
        default:
            say('usage: agmechanic <flush|stats|orders|reset [plate]>');
    }
}, false);
