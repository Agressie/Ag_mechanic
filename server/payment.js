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
        const prop = netId ? NetworkGetEntityFromNetworkId(netId) : 0;
        if (!prop || !DoesEntityExist(prop)) return { ok: false, reason: 'noDevice' };
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

/** What is owed on a device right now - read by both the mechanic and the payer. */
AGM.rpc.register('payment:status', async (src, args) => {
    const device = args.device === 'mobile' ? 'mobile' : 'shop';
    const key = keyFor(device, Number(args.netId));
    const invoice = invoices.get(key);
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
        const prop = NetworkGetEntityFromNetworkId(netId);
        if (!prop || !DoesEntityExist(prop)) return { ok: false, reason: 'noDevice' };
        if (AGM.util.dist(GetEntityCoords(ped), GetEntityCoords(prop)) > cfg.mobileDistance) {
            return { ok: false, reason: 'tooFar' };
        }
    }

    if (!AGM.core.removeMoney(src, 'bank', invoice.amount, 'ag_mechanic card payment')) {
        return { ok: false, reason: 'funds' };
    }
    AGM.society.deposit(invoice.amount, `ag_mechanic card payment (${invoice.device})`);

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
