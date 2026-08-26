/*
 * ag_mechanic - parts ordering (tablet app)
 * ============================================================================
 * Orders take an hour of real time and tick down whether or not anybody is
 * online. Once an order is ready it sits waiting until somebody at the shop
 * checks it in from the tablet, which is what sends the van out.
 * ============================================================================
 */

AGM.shop = {};

const STATUS = { pending: 'pending', ready: 'ready', dispatched: 'dispatched', returned: 'returned', delivered: 'delivered', cancelled: 'cancelled' };

function defaultShopId() {
    return (AGM.Locations.shops[0] || {}).id || '';
}

function resolveShop(shopId) {
    return AGM.Locations.shop(String(shopId || defaultShopId()));
}

function rowToOrder(row) {
    const lines = AGM.db.json(row.lines_json, []) || [];
    return {
        id: Number(row.id),
        shop: row.shop,
        orderedBy: row.ordered_by,
        citizenid: row.citizenid,
        lines: lines.map((l) => ({
            item: l.item,
            qty: Number(l.qty) || 0,
            label: AGM.Shop.label(l.item),
            unit: Number(l.unit) || 0,
        })),
        units: lines.reduce((a, l) => a + (Number(l.qty) || 0), 0),
        cost: Number(row.cost) || 0,
        status: row.status,
        placedAt: Number(row.placed_at) || 0,
        readyAt: Number(row.ready_at) || 0,
        deliveredAt: Number(row.delivered_at) || 0,
        signedBy: row.signed_by || '',
        /* Negative once it is due. */
        etaMs: (Number(row.ready_at) || 0) - Date.now(),
    };
}

AGM.shop.getOrder = async function (orderId) {
    if (!AGM.db.ready) return null;
    const row = await AGM.db.single('SELECT * FROM ag_mechanic_orders WHERE id = ? LIMIT 1', [Number(orderId)]).catch(() => null);
    return row ? rowToOrder(row) : null;
};

AGM.shop.setStatus = async function (orderId, status, extra = {}) {
    if (!AGM.db.ready) return;
    const sets = ['status = ?'];
    const params = [status];
    if (extra.deliveredAt !== undefined) { sets.push('delivered_at = ?'); params.push(extra.deliveredAt); }
    if (extra.signedBy !== undefined) { sets.push('signed_by = ?'); params.push(extra.signedBy); }
    params.push(Number(orderId));
    await AGM.db.update(`UPDATE ag_mechanic_orders SET ${sets.join(', ')} WHERE id = ?`, params).catch(() => 0);
};

/** Moves pending orders whose hour is up into 'ready', and tells the shop. */
AGM.shop.tick = async function () {
    if (!AGM.db.ready) return;
    const now = Date.now();

    const due = await AGM.db.query(
        `SELECT * FROM ag_mechanic_orders WHERE status = ? AND ready_at > 0 AND ready_at <= ?`,
        [STATUS.pending, now],
    ).catch(() => []);

    for (const row of due || []) {
        await AGM.shop.setStatus(row.id, STATUS.ready);
        notifyShop(row.shop, `Order #${row.id} has arrived at the depot. Check it in on the tablet.`, 'inform');
        AGM.db.log(row.shop, 'system', 'order_ready', { order: Number(row.id) });
    }
};

/** Notifies every online employee of a shop. */
function notifyShop(shopId, message, type = 'inform') {
    for (const p of AGM.core.getPlayers()) {
        if (p.job.name !== AGM.Config.job.name) continue;
        AGM.core.notify(p.src, message, type);
    }
}
AGM.shop.notifyShop = notifyShop;

/* ---------------------------------------------------------------------- rpc */

AGM.rpc.register('shop:catalogue', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };

    const stash = await AGM.inv.stashContents(shop);
    const inStock = new Map(stash.map((s) => [s.item, s.count]));

    const items = AGM.Shop.catalogue.map((entry) => ({
        item: entry.item,
        label: entry.label,
        category: entry.category,
        blurb: entry.blurb,
        packs: entry.packs,
        unit: AGM.Shop.price(entry.item, 1),
        inStock: inStock.get(entry.item) || 0,
    }));

    return {
        ok: true,
        shop: { id: shop.id, label: shop.label },
        categories: AGM.Shop.categories,
        items,
        canOrder: AGM.core.perm(src, 'order'),
        balance: AGM.society.balance(AGM.Config.economy.society),
        paymentMode: AGM.Config.economy.orderPaymentAccount,
        orderDurationMs: AGM.Shop.order.durationMs,
    };
});

AGM.rpc.register('shop:orders', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop || !AGM.db.ready) return { ok: false, reason: 'noShop' };

    const rows = await AGM.db.query(
        `SELECT * FROM ag_mechanic_orders WHERE shop = ? ORDER BY id DESC LIMIT ?`,
        [shop.id, AGM.Shop.order.historyLimit],
    ).catch(() => []);

    const orders = (rows || []).map(rowToOrder);
    return {
        ok: true,
        orders,
        open: orders.filter((o) => (
            o.status === STATUS.pending || o.status === STATUS.ready
            || o.status === STATUS.dispatched || o.status === STATUS.returned
        )),
        canOrder: AGM.core.perm(src, 'order'),
        deliveryActive: AGM.delivery ? AGM.delivery.isBusy() : false,
    };
});

AGM.rpc.register('shop:order', async (src, args) => {
    if (!AGM.core.perm(src, 'order')) return { ok: false, reason: 'noPermission' };
    if (!AGM.db.ready) return { ok: false, reason: 'noDatabase' };

    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };
    const me = AGM.core.getPlayer(src);

    /* Validate the cart before touching money. */
    const raw = Array.isArray(args.lines) ? args.lines : [];
    if (!raw.length) return { ok: false, reason: 'emptyCart' };
    if (raw.length > AGM.Shop.order.maxLines) return { ok: false, reason: 'tooManyLines' };

    const lines = [];
    let units = 0;
    for (const line of raw) {
        const entry = AGM.Shop.entry(String(line.item || ''));
        if (!entry) return { ok: false, reason: 'unknownItem', item: line.item };
        const qty = Math.floor(Number(line.qty));
        if (!Number.isFinite(qty) || qty < 1 || qty > AGM.Shop.order.maxUnits) {
            return { ok: false, reason: 'badQuantity', item: line.item };
        }
        units += qty;
        lines.push({ item: entry.item, qty, unit: AGM.Shop.price(entry.item, qty) });
    }
    if (units > AGM.Shop.order.maxUnits) return { ok: false, reason: 'tooManyUnits' };

    const openCount = await AGM.db.scalar(
        `SELECT COUNT(*) FROM ag_mechanic_orders WHERE shop = ? AND status IN (?, ?, ?)`,
        [shop.id, STATUS.pending, STATUS.ready, STATUS.dispatched],
    ).catch(() => 0);
    if (Number(openCount) >= AGM.Shop.order.maxOpen) return { ok: false, reason: 'tooManyOpen' };

    const cost = lines.reduce((a, l) => a + l.unit * l.qty, 0);
    const payment = AGM.society.charge(src, cost, `ag_mechanic parts order (${shop.id})`);
    if (!payment.ok) return { ok: false, reason: 'funds' };

    const now = Date.now();
    const readyAt = now + AGM.Shop.order.durationMs;

    const id = await AGM.db.insert(
        `INSERT INTO ag_mechanic_orders (shop, citizenid, ordered_by, lines_json, cost, status, placed_at, ready_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [shop.id, me.citizenid, me.name, JSON.stringify(lines), cost, STATUS.pending, now, readyAt],
    ).catch((err) => {
        AGM.log.error('order insert failed:', err && err.message);
        return null;
    });

    if (!id) {
        /* Put the money back rather than silently eating it. */
        AGM.society.deposit(cost, 'ag_mechanic order rollback');
        return { ok: false, reason: 'noDatabase' };
    }

    AGM.db.log(shop.id, me.name, 'order_placed', { order: id, cost, units, paidFrom: payment.paidFrom });
    notifyShop(shop.id, `${me.name} placed order #${id}. Due ${AGM.util.relativeTime(readyAt - now)}.`, 'inform');

    return { ok: true, order: await AGM.shop.getOrder(id), paidFrom: payment.paidFrom };
});

AGM.rpc.register('shop:cancel', async (src, args) => {
    if (!AGM.core.perm(src, 'order')) return { ok: false, reason: 'noPermission' };
    const order = await AGM.shop.getOrder(args.order);
    if (!order) return { ok: false, reason: 'noOrder' };
    if (order.status !== STATUS.pending) return { ok: false, reason: 'tooLate' };

    /* Full refund inside the first five minutes, half after that. */
    const elapsed = Date.now() - order.placedAt;
    const refund = elapsed < 5 * 60 * 1000 ? order.cost : Math.floor(order.cost * 0.5);

    await AGM.shop.setStatus(order.id, STATUS.cancelled);
    if (refund > 0) AGM.society.deposit(refund, `ag_mechanic order #${order.id} cancelled`);

    const me = AGM.core.getPlayer(src);
    AGM.db.log(order.shop, me.name, 'order_cancelled', { order: order.id, refund });
    return { ok: true, refund };
});

/**
 * Checks a ready (or previously returned) order in. This is what actually
 * sends the van, so it is the step the shop has to remember to do.
 */
AGM.rpc.register('shop:receive', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const order = await AGM.shop.getOrder(args.order);
    if (!order) return { ok: false, reason: 'noOrder' };
    if (order.status !== STATUS.ready && order.status !== STATUS.returned) return { ok: false, reason: 'notReady' };

    const shop = resolveShop(order.shop);
    if (!shop) return { ok: false, reason: 'noShop' };

    if (AGM.delivery.isBusy()) return { ok: false, reason: 'deliveryBusy' };

    const started = await AGM.delivery.start(shop, order, src);
    if (!started.ok) return started;

    await AGM.shop.setStatus(order.id, STATUS.dispatched);
    return { ok: true, order: await AGM.shop.getOrder(order.id) };
});

/* -------------------------------------------------------------------- stash */

AGM.rpc.register('shop:stash', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };

    return {
        ok: true,
        backend: AGM.inv.stashBackend,
        /* With a real inventory resource the tablet shows a read-only manifest
           and offers to open the proper UI; with the fallback it is the UI. */
        native: AGM.inv.stashBackend !== 'db',
        items: await AGM.inv.stashContents(shop),
        can: {
            take: AGM.core.perm(src, 'stashTake'),
            put: AGM.core.perm(src, 'stashPut'),
        },
        stash: { id: shop.stash.id, label: shop.stash.label, slots: shop.stash.slots },
    };
});

AGM.rpc.register('shop:stashOpen', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };
    const opened = AGM.inv.openStash(src, shop);
    return { ok: opened, reason: opened ? undefined : 'noNativeStash' };
});

AGM.rpc.register('shop:stashTake', async (src, args) => {
    if (!AGM.core.perm(src, 'stashTake')) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };

    const item = String(args.item || '');
    const qty = AGM.util.clamp(Math.floor(Number(args.qty) || 1), 1, 100);
    if (!AGM.Shop.entry(item)) return { ok: false, reason: 'unknownItem' };

    if (!await AGM.inv.stashRemove(shop, item, qty)) return { ok: false, reason: 'notInStash' };
    if (!AGM.inv.add(src, item, qty)) {
        /* Could not carry it - put it straight back. */
        await AGM.inv.stashAdd(shop, item, qty);
        return { ok: false, reason: 'cannotCarry' };
    }

    const me = AGM.core.getPlayer(src);
    AGM.db.log(shop.id, me.name, 'stash_take', { item, qty });
    return { ok: true, items: await AGM.inv.stashContents(shop) };
});

AGM.rpc.register('shop:stashPut', async (src, args) => {
    if (!AGM.core.perm(src, 'stashPut')) return { ok: false, reason: 'noPermission' };
    const shop = resolveShop(args.shop);
    if (!shop) return { ok: false, reason: 'noShop' };

    const item = String(args.item || '');
    const qty = AGM.util.clamp(Math.floor(Number(args.qty) || 1), 1, 100);
    if (!AGM.inv.has(src, item, qty)) return { ok: false, reason: 'noItem' };
    if (!AGM.inv.remove(src, item, qty)) return { ok: false, reason: 'noItem' };

    await AGM.inv.stashAdd(shop, item, qty);
    const me = AGM.core.getPlayer(src);
    AGM.db.log(shop.id, me.name, 'stash_put', { item, qty });
    return { ok: true, items: await AGM.inv.stashContents(shop) };
});
