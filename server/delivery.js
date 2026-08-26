/*
 * ag_mechanic - parts delivery
 * ============================================================================
 * The server owns the delivery *state*; one client owns the *scenario*. That
 * client (the "host") spawns the van and driver as networked entities so
 * everybody sees them, and reports progress back as it goes.
 *
 * Only one delivery van is ever on the move at a time, across every shop -
 * `active` never holds more than one entry, and `start()` refuses a second
 * while it does.
 *
 * Safety nets, because a scenario that leaves a van parked across the shop door
 * forever is worse than no scenario at all:
 *   - a signature timeout, after which the van loads the pallet back up and
 *     drives back the way it came - the order reverts to 'returned' so the
 *     shop can re-ship it from the tablet
 *   - a hard timeout that tears the whole thing down regardless
 *   - host disconnect handling, which returns the order rather than
 *     stranding it in 'dispatched'
 * ============================================================================
 */

AGM.delivery = {};

/** shopId -> delivery state. Never more than one entry at a time. */
const active = new Map();

AGM.delivery.isActive = (shopId) => active.has(String(shopId));

/** True while any shop, anywhere, has a delivery van on the move. */
AGM.delivery.isBusy = () => active.size > 0;

AGM.delivery.state = (shopId) => active.get(String(shopId)) || null;

/** Nearest on-duty employee to the shop, preferring the person who asked. */
function pickHost(shop, preferredSrc) {
    const target = shop.delivery.park.coords;
    let best = null;

    for (const p of AGM.core.getPlayers()) {
        if (p.job.name !== AGM.Config.job.name) continue;
        const ped = GetPlayerPed(String(p.src));
        if (!ped) continue;
        const distance = AGM.util.dist(GetEntityCoords(ped), target);
        if (distance > 200.0) continue;
        if (Number(p.src) === Number(preferredSrc)) return { src: p.src, distance };
        if (!best || distance < best.distance) best = { src: p.src, distance };
    }
    return best;
}

/** Starts a delivery run for a ready (or previously returned) order. */
AGM.delivery.start = async function (shop, order, requesterSrc) {
    if (active.size > 0) return { ok: false, reason: 'deliveryBusy' };
    if (!shop.delivery) return { ok: false, reason: 'noRoute' };

    const host = pickHost(shop, requesterSrc);
    if (!host) return { ok: false, reason: 'nobodyAtShop' };

    const state = {
        shopId: shop.id,
        orderId: order.id,
        host: host.src,
        phase: 'driving',
        startedAt: Date.now(),
        signedBy: null,
        /* 'pending' -> 'delivered' (signed) or 'returned' (timed out / dropped). */
        outcome: 'pending',
        timers: [],
    };
    active.set(shop.id, state);

    emitNet('ag_mechanic:client:deliveryStart', host.src, {
        shopId: shop.id,
        orderId: order.id,
        route: shop.delivery,
        vehicles: AGM.Shop.delivery.vehicles,
        driverModels: AGM.Shop.delivery.driverModels,
        boxProp: AGM.Shop.delivery.boxProp,
        clipboardProp: AGM.Shop.delivery.clipboardProp,
        approachSpeed: AGM.Shop.delivery.approachSpeed,
        honk: AGM.Shop.delivery.honk,
        anims: AGM.Locations.anims,
        lines: order.lines,
    });

    /* Signature timeout: the driver will not wait forever. The pallet goes
       back in the van and the order becomes re-shippable rather than being
       force-delivered - somebody actually has to sign for it. */
    state.timers.push(setTimeout(() => {
        const current = active.get(shop.id);
        if (!current || current.orderId !== order.id || current.outcome !== 'pending') return;
        AGM.log.info(`delivery for order #${order.id} timed out waiting for a signature - returning it`);
        current.outcome = 'returned';
        returnOrder(shop, order, 'timeout').catch((err) => AGM.log.error('delivery return failed:', err && err.message));
        emitNet('ag_mechanic:client:deliveryReturn', current.host, { shopId: shop.id, reason: 'timeout' });
    }, AGM.Shop.delivery.signTimeout));

    /* Hard stop, so a wedged scenario cannot hold the shop hostage. */
    state.timers.push(setTimeout(() => {
        const current = active.get(shop.id);
        if (!current || current.orderId !== order.id) return;
        AGM.log.warn(`delivery for order #${order.id} hit the hard timeout - tearing down`);
        if (current.outcome === 'pending') {
            current.outcome = 'returned';
            returnOrder(shop, order, 'hardTimeout').catch(() => {});
        }
        emitNet('ag_mechanic:client:deliveryAbort', -1, { shopId: shop.id });
        finish(shop.id);
    }, AGM.Shop.delivery.hardTimeout));

    AGM.db.log(shop.id, AGM.core.playerName(host.src), 'delivery_dispatched', { order: order.id });
    AGM.shop.notifyShop(shop.id, `Parts van for order #${order.id} is on its way.`, 'inform');

    return { ok: true, host: host.src };
};

/** Signed for: moves the parts into the stash and closes the order out. */
async function settleDelivered(shop, order, signer) {
    for (const line of order.lines) {
        await AGM.inv.stashAdd(shop, line.item, line.qty);
    }

    await AGM.shop.setStatus(order.id, 'delivered', {
        deliveredAt: Date.now(),
        signedBy: signer.name,
    });

    AGM.db.log(shop.id, signer.name, 'delivery_settled', {
        order: order.id, lines: order.lines.map((l) => `${l.qty}x ${l.item}`),
    });

    const summary = order.lines.map((l) => `${l.qty}x ${l.label || AGM.Shop.label(l.item)}`).join(', ');
    AGM.shop.notifyShop(shop.id, `Order #${order.id} is in the stash: ${summary}.`, 'success');
}

/** Not signed for in time: the van takes it back. Nothing lands in the stash. */
async function returnOrder(shop, order, how) {
    await AGM.shop.setStatus(order.id, 'returned', {
        signedBy: how === 'hostLeft' ? 'unsigned (driver had to leave)' : 'unsigned (nobody signed in time)',
    });

    AGM.db.log(shop.id, 'system', 'delivery_returned', { order: order.id, how });
    AGM.shop.notifyShop(
        shop.id,
        `Nobody signed for order #${order.id} in time - the van is taking it back to the depot. Re-ship it from the tablet when you're ready.`,
        'warning',
    );
}

/** Clears server-side state and stops the guards. */
function finish(shopId) {
    const state = active.get(String(shopId));
    if (!state) return;
    for (const t of state.timers) clearTimeout(t);
    active.delete(String(shopId));
}
AGM.delivery.finish = finish;

/* ---------------------------------------------------------------------- rpc */

/** The host client reporting progress, so the tablet can show a live status. */
onNet('ag_mechanic:server:deliveryPhase', (payload) => {
    const src = Number(global.source);
    const state = active.get(String(payload && payload.shopId));
    if (!state || Number(state.host) !== src) return;

    const phase = String(payload.phase || '');
    if (!['driving', 'parking', 'unloading', 'waiting', 'returning', 'leaving', 'done'].includes(phase)) return;

    state.phase = phase;
    AGM.log.debug(`delivery ${state.shopId} phase -> ${phase}`);

    if (phase === 'done') finish(state.shopId);
});

/**
 * Signing for the delivery. This is the ox_target interaction on the driver, so
 * it is checked properly: right shop, right job, actually standing there.
 */
AGM.rpc.register('delivery:sign', async (src, args) => {
    const shop = AGM.Locations.shop(String(args.shopId || ''));
    if (!shop) return { ok: false, reason: 'noShop' };

    const state = active.get(shop.id);
    if (!state) return { ok: false, reason: 'noDelivery' };
    if (state.outcome !== 'pending') return { ok: false, reason: 'alreadySigned' };

    const player = AGM.core.getPlayer(src);
    if (!player || player.job.name !== AGM.Config.job.name) return { ok: false, reason: 'noJob' };

    const ped = GetPlayerPed(String(src));
    if (!ped) return { ok: false, reason: 'noPlayer' };
    if (AGM.util.dist(GetEntityCoords(ped), shop.delivery.sign.coords) > 8.0) {
        return { ok: false, reason: 'tooFar' };
    }

    const order = await AGM.shop.getOrder(state.orderId);
    if (!order) return { ok: false, reason: 'noOrder' };

    state.signedBy = player.citizenid;
    state.outcome = 'delivered';
    await settleDelivered(shop, order, player);

    /* Tell the host to send the driver on their way. */
    emitNet('ag_mechanic:client:deliverySigned', state.host, { shopId: shop.id });

    return {
        ok: true,
        lines: order.lines.map((l) => ({ item: l.item, label: l.label, qty: l.qty })),
    };
});

/** Live status for the tablet's shop app. */
AGM.rpc.register('delivery:status', async (src, args) => {
    const shop = AGM.Locations.shop(String(args.shopId || (AGM.Locations.shops[0] || {}).id));
    if (!shop) return null;
    const state = active.get(shop.id);
    if (!state) return { active: false };
    return {
        active: true,
        orderId: state.orderId,
        phase: state.phase,
        signed: state.outcome === 'delivered',
        startedAt: state.startedAt,
    };
});

/* ------------------------------------------------------------------ lifecycle */

/**
 * If the host leaves mid-run nobody is simulating the van, so close the
 * delivery out rather than leaving the order stuck in 'dispatched'. Nobody
 * signed for it, so it goes back to 'returned' rather than being auto-delivered.
 */
on('playerDropped', () => {
    const src = Number(global.source);
    for (const state of Array.from(active.values())) {
        if (Number(state.host) !== src) continue;

        const shop = AGM.Locations.shop(state.shopId);
        AGM.log.warn(`delivery host for ${state.shopId} disconnected - returning order #${state.orderId}`);

        if (shop && state.outcome === 'pending') {
            state.outcome = 'returned';
            AGM.shop.getOrder(state.orderId)
                .then((order) => (order ? returnOrder(shop, order, 'hostLeft') : null))
                .catch((err) => AGM.log.error('delivery return on drop failed:', err && err.message));
        }
        emitNet('ag_mechanic:client:deliveryAbort', -1, { shopId: state.shopId });
        finish(state.shopId);
    }
});

/** Anything still running when the resource stops has to be torn down. */
AGM.delivery.shutdown = function () {
    for (const state of Array.from(active.values())) {
        emitNet('ag_mechanic:client:deliveryAbort', -1, { shopId: state.shopId });
        finish(state.shopId);
    }
};
