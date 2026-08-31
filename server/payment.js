/*
 * ag_mechanic - card payments
 * ============================================================================
 * Bennys is cashless. A mechanic keys an amount into a card machine and it
 * sits 'pending' until a customer taps to pay - no PIN, no cash, and the
 * mechanic never handles the customer's money directly.
 *
 *   shop     the fixed terminal on the counter, at Locations.shop.payment.
 *            One charge waiting at a time - it is one physical machine.
 *   mobile   the `card_reader` item. Each reader a mechanic is holding is its
 *            own device, keyed by its network id, so several can be out on
 *            jobs at once without treading on each other.
 * ============================================================================
 */

AGM.payment = {};

/** device key -> invoice */
const invoices = new Map();

function keyFor(device, netId) {
    return device === 'mobile' ? `mobile:${netId}` : 'shop';
}

function clearTimer(invoice) {
    if (invoice && invoice.timer) clearTimeout(invoice.timer);
}

/**
 * Resolves a mobile reader from a network id.
 *
 * A network id on its own proves nothing - it could name any object, vehicle or
 * ped in the world, or somebody else's reader. Both are worth checking: without
 * the model test a charge could be filed against an arbitrary entity, and
 * without the attachment test one mechanic could overwrite another's pending
 * charge (their $500 quietly becoming $5 before the customer taps).
 *
 * `holderSrc` is the player who must be holding it, or null to accept any
 * genuine reader (the paying customer does not own the machine).
 */
function resolveReader(netId, holderSrc) {
    const id = Number(netId);
    if (!id) return null;

    const prop = NetworkGetEntityFromNetworkId(id);
    if (!prop || !DoesEntityExist(prop)) return null;
    if (GetEntityModel(prop) !== GetHashKey(AGM.Config.payment.mobileProp)) return null;

    if (holderSrc !== null && holderSrc !== undefined) {
        const ped = GetPlayerPed(String(holderSrc));
        if (!ped) return null;
        /* Held out in that mechanic's own hand, not merely near them. */
        if (GetEntityAttachedTo(prop) !== ped) return null;
    }

    return prop;
}

/** Mechanic keys in (or overwrites) the amount owed on a device. */
AGM.rpc.register('payment:charge', async (src, args) => {
    const player = AGM.core.getPlayer(src);
    if (!player || player.job.name !== AGM.Config.job.name) return { ok: false, reason: 'noJob' };

    const cfg = AGM.Config.payment;
    const device = args.device === 'mobile' ? 'mobile' : 'shop';
    const amount = Math.round(Number(args.amount));
    if (!Number.isFinite(amount) || amount < cfg.minAmount || amount > cfg.maxAmount) {
        return { ok: false, reason: 'badAmount' };
    }

    const ped = GetPlayerPed(String(src));
    if (!ped) return { ok: false, reason: 'noPlayer' };

    let netId = 0;
    if (device === 'shop') {
        const shop = AGM.Locations.shop;
        if (!shop.payment) return { ok: false, reason: 'noDevice' };
        if (AGM.util.dist(GetEntityCoords(ped), shop.payment.coords) > cfg.shopDistance) {
            return { ok: false, reason: 'tooFar' };
        }
    } else {
        netId = Number(args.netId);
        /* Must be a real reader, in this mechanic's own hand. */
        if (!resolveReader(netId, src)) return { ok: false, reason: 'noDevice' };
    }

    const key = keyFor(device, netId);
    clearTimer(invoices.get(key));

    const invoice = {
        device, netId, mechanicSrc: src, mechanicName: player.name,
        amount, createdAt: Date.now(), timer: null,
    };
    invoice.timer = setTimeout(() => {
        if (invoices.get(key) !== invoice) return;
        invoices.delete(key);
        AGM.core.notify(src, 'The charge timed out with nobody paying.', 'inform', 'Card Machine');
    }, cfg.pendingTimeout);
    invoices.set(key, invoice);

    AGM.db.log(AGM.Locations.shop.id, player.name, 'payment_charge', { device, amount });
    return { ok: true, amount };
});

/** Mechanic clears a pending charge - a typo, or the customer walked off. */
AGM.rpc.register('payment:cancel', async (src, args) => {
    const device = args.device === 'mobile' ? 'mobile' : 'shop';
    const key = keyFor(device, Number(args.netId));
    const invoice = invoices.get(key);
    if (!invoice) return { ok: true };

    if (device === 'mobile' && invoice.mechanicSrc !== src) return { ok: false, reason: 'notYours' };
    if (device === 'shop' && !AGM.core.hasJob(src, AGM.Config.job.name)) return { ok: false, reason: 'noJob' };

    clearTimer(invoice);
    invoices.delete(key);
    return { ok: true };
});

/**
 * What is owed on a device right now - read by both the mechanic and the payer.
 * A mobile reader has to be a genuine one, so a network id cannot be used to
 * fish other people's pending charges out of the map.
 */
AGM.rpc.register('payment:status', async (src, args) => {
    const device = args.device === 'mobile' ? 'mobile' : 'shop';
    const netId = Number(args.netId);

    if (device === 'mobile' && !resolveReader(netId, null)) return { active: false };

    const invoice = invoices.get(keyFor(device, netId));
    if (!invoice) return { active: false };
    return { active: true, amount: invoice.amount, mechanic: invoice.mechanicName };
});

/** Customer taps their card. */
AGM.rpc.register('payment:pay', async (src, args) => {
    const device = args.device === 'mobile' ? 'mobile' : 'shop';
    const netId = Number(args.netId);
    const key = keyFor(device, netId);
    const invoice = invoices.get(key);
    if (!invoice) return { ok: false, reason: 'noCharge' };

    const player = AGM.core.getPlayer(src);
    if (!player) return { ok: false, reason: 'noPlayer' };

    const ped = GetPlayerPed(String(src));
    if (!ped) return { ok: false, reason: 'noPlayer' };

    const cfg = AGM.Config.payment;
    if (device === 'shop') {
        const shop = AGM.Locations.shop;
        if (AGM.util.dist(GetEntityCoords(ped), shop.payment.coords) > cfg.shopDistance) {
            return { ok: false, reason: 'tooFar' };
        }
    } else {
        const prop = resolveReader(netId, null);
        if (!prop) return { ok: false, reason: 'noDevice' };
        if (AGM.util.dist(GetEntityCoords(ped), GetEntityCoords(prop)) > cfg.mobileDistance) {
            return { ok: false, reason: 'tooFar' };
        }
    }

    /*
     * Check the shop's account can take the money *before* touching the
     * customer's. With no banking resource running there is nowhere for it to
     * land, and debiting first would delete it outright. Refusing up front means
     * there is never anything to unwind - no rollback path to go wrong, and no
     * window where the money exists in neither account.
     */
    const account = AGM.Config.economy.society;
    if (!AGM.society.canDeposit(account)) {
        AGM.log.error(`card payment refused: society account '${account}' cannot take a deposit `
            + `(banking backend: ${AGM.society.backend})`);
        return { ok: false, reason: 'terminalDown' };
    }

    if (!AGM.core.removeMoney(src, 'bank', invoice.amount, 'ag_mechanic card payment')) {
        return { ok: false, reason: 'funds' };
    }

    if (!AGM.society.deposit(invoice.amount, `ag_mechanic card payment (${invoice.device})`)) {
        /* The account said yes a moment ago and has now refused. Nothing is
           put back - the charge stands and it is logged loudly for the owner to
           reconcile by hand, rather than handing anyone a refund to farm. */
        AGM.log.error(`card payment of ${invoice.amount} left the customer but the shop account `
            + `refused it - order/shop reconciliation needed`);
        AGM.db.log(AGM.Locations.shop.id, player.name, 'payment_deposit_failed', {
            amount: invoice.amount, mechanic: invoice.mechanicName,
        });
    }

    clearTimer(invoice);
    invoices.delete(key);

    AGM.db.log(AGM.Locations.shop.id, player.name, 'payment_paid', {
        device: invoice.device, amount: invoice.amount, mechanic: invoice.mechanicName,
    });
    AGM.core.notify(invoice.mechanicSrc, `${player.name} paid $${invoice.amount}.`, 'success', 'Card Machine');

    return { ok: true, amount: invoice.amount };
});

/* ------------------------------------------------------------------ lifecycle */

/** A mechanic who disconnects stops holding every charge they had open. */
on('playerDropped', () => {
    const src = Number(global.source);
    for (const [key, invoice] of Array.from(invoices.entries())) {
        if (invoice.mechanicSrc !== src) continue;
        clearTimer(invoice);
        invoices.delete(key);
    }
});

AGM.payment.shutdown = function () {
    for (const [, invoice] of invoices) clearTimer(invoice);
    invoices.clear();
};
