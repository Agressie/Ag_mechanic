/*
 * ag_mechanic - card payments (client)
 * ============================================================================
 * Two devices, one behaviour: a mechanic keys an amount into a keypad screen
 * and the machine goes "pending"; a customer taps to pay on a second, much
 * simpler screen. No PIN either way - this is meant to feel like tap-to-pay,
 * not a bank transfer menu.
 *
 *   shop     a fixed sphere zone at Locations.shop.payment, with a decorative
 *            (non-networked, local-only) prop sat on the counter. The
 *            interaction point is the zone, not the prop.
 *   mobile   the `card_reader` item. Using it holds a networked prop out in
 *            the mechanic's hand; `ox_target.addModel` on that prop's model
 *            is what lets a nearby customer tap it, wherever the mechanic is
 *            standing - registered once, client-side, the same way on
 *            everyone's machine, so no host/relay plumbing is needed.
 * ============================================================================
 */

AGM.payment = {};

function oxTarget(fn, ...args) {
    try {
        if (!exports.ox_target || typeof exports.ox_target[fn] !== 'function') {
            AGM.log.error(`ox_target.${fn} is unavailable - is ox_target started?`);
            return null;
        }
        return exports.ox_target[fn](...args);
    } catch (err) {
        AGM.log.error(`ox_target.${fn} failed:`, err && err.message);
        return null;
    }
}

function addSphereZone(data) {
    emit('ag_mechanic:lua:addSphereZone', JSON.stringify(data));
}

async function loadModel(model) {
    const hash = typeof model === 'string' ? GetHashKey(model) : model;
    RequestModel(hash);
    const deadline = GetGameTimer() + 5000;
    while (!HasModelLoaded(hash) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HasModelLoaded(hash) ? hash : null;
}

async function loadAnim(dict) {
    RequestAnimDict(dict);
    const deadline = GetGameTimer() + 3000;
    while (!HasAnimDictLoaded(dict) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HasAnimDictLoaded(dict);
}

function reasonText(reason) {
    const L = AGM.Config.locale;
    switch (reason) {
        case 'noJob': return L.noJob;
        case 'tooFar': return L.paymentTooFar;
        case 'funds': return L.paymentFunds;
        case 'badAmount': return L.paymentBadAmount;
        case 'noCharge': return L.paymentNoCharge;
        case 'noDevice': return 'That machine is not available right now.';
        case 'notYours': return 'That is not your reader.';
        default: return 'That did not work.';
    }
}

/* --------------------------------------------------------------- shared flow */

/** Mechanic side: set, adjust or clear the amount owed on a device. */
async function openKeypad(device, netId) {
    const status = await AGM.rpc.call('payment:status', { device, netId });
    const result = await AGM.nui.awaitResult('keypad', {
        device,
        pending: status || { active: false },
    });
    if (!result) return;

    if (result.action === 'charge') {
        const response = await AGM.rpc.call('payment:charge', { device, netId, amount: result.amount });
        if (response && response.ok) {
            AGM.ui.notify(AGM.Config.locale.paymentSet, 'success', 'Card Machine');
        } else {
            AGM.ui.notify(reasonText(response && response.reason), 'error', 'Card Machine');
        }
    } else if (result.action === 'cancel') {
        await AGM.rpc.call('payment:cancel', { device, netId });
        AGM.ui.notify(AGM.Config.locale.paymentCancelled, 'inform', 'Card Machine');
    } else if (result.action === 'stow' && device === 'mobile') {
        await AGM.rpc.call('payment:cancel', { device, netId });
        stowReader();
    }
}

/** Customer side: read what is owed, then tap to pay it. */
async function openPaymentScreen(device, netId) {
    const status = await AGM.rpc.call('payment:status', { device, netId });
    if (!status || !status.active) {
        AGM.ui.notify(AGM.Config.locale.paymentNoCharge, 'inform', 'Card Machine');
        return;
    }

    const result = await AGM.nui.awaitResult('payment', {
        device, amount: status.amount, mechanic: status.mechanic,
    });
    if (!result || !result.paid) return;

    const response = await AGM.rpc.call('payment:pay', { device, netId });
    if (response && response.ok) {
        AGM.ui.notify(AGM.Config.locale.paymentPaid, 'success', 'Card Machine');
    } else {
        AGM.ui.notify(reasonText(response && response.reason), 'error', 'Card Machine');
    }
}

/* --------------------------------------------------------------- shop terminal */

let terminalProp = 0;

/** Set dressing only - the interaction is the sphere zone below, not this prop. */
async function spawnTerminalProp() {
    const shop = AGM.Locations.shop;
    if (!shop.payment) return;
    const hash = await loadModel(AGM.Config.payment.terminalProp);
    if (!hash) return;

    const [x, y, z] = shop.payment.coords;
    const prop = CreateObject(hash, x, y, z, false, false, false);
    SetModelAsNoLongerNeeded(hash);
    if (!prop || !DoesEntityExist(prop)) return;

    SetEntityHeading(prop, shop.payment.heading || 0.0);
    PlaceObjectOnGroundProperly(prop);
    FreezeEntityPosition(prop, true);
    SetEntityCollision(prop, true, true);
    terminalProp = prop;
}

function despawnTerminalProp() {
    if (terminalProp && DoesEntityExist(terminalProp)) DeleteEntity(terminalProp);
    terminalProp = 0;
}

AGM.payment.registerShop = function () {
    const shop = AGM.Locations.shop;
    if (!shop.payment) return;

    spawnTerminalProp();

    addSphereZone({
        coords: shop.payment.coords,
        radius: AGM.Config.payment.shopDistance,
        debug: AGM.Config.debug,
        options: [
            {
                name: 'ag_mechanic_bill_shop',
                label: 'Bill a customer',
                icon: 'fa-solid fa-cash-register',
                distance: AGM.Config.payment.shopDistance,
                groups: { [AGM.Config.job.name]: 0 },
                event: 'ag_mechanic:client:paymentBillShop',
            },
            {
                name: 'ag_mechanic_pay_shop',
                label: 'Pay with card',
                icon: 'fa-solid fa-credit-card',
                distance: AGM.Config.payment.shopDistance,
                event: 'ag_mechanic:client:paymentPayShop',
            },
        ],
    });
};

onNet('ag_mechanic:client:paymentBillShop', async () => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');
    await openKeypad('shop', 0);
});

onNet('ag_mechanic:client:paymentPayShop', () => openPaymentScreen('shop', 0));

/* --------------------------------------------------------------- mobile reader */

/** { prop, netId } while a reader is held out, otherwise null. */
let held = null;

AGM.payment.registerMobile = function () {
    oxTarget('addModel', GetHashKey(AGM.Config.payment.mobileProp), [{
        name: 'ag_mechanic_pay_mobile',
        label: 'Pay with card',
        icon: 'fa-solid fa-credit-card',
        distance: AGM.Config.payment.mobileDistance,
        event: 'ag_mechanic:client:paymentPayMobile',
    }]);
};

async function holdReader() {
    if (held) return;
    const hash = await loadModel(AGM.Config.payment.mobileProp);
    if (!hash) return;

    const ped = PlayerPedId();
    const coords = GetEntityCoords(ped, true);
    const prop = CreateObject(hash, coords[0], coords[1], coords[2], true, true, false);
    SetModelAsNoLongerNeeded(hash);
    if (!prop || !DoesEntityExist(prop)) return;

    AttachEntityToEntity(prop, ped, GetPedBoneIndex(ped, 60309), 0.05, 0.03, 0.0, 10.0, 0.0, 0.0, true, true, false, true, 2, true);

    const anim = AGM.Config.payment.holdAnim;
    if (await loadAnim(anim.dict)) {
        TaskPlayAnim(ped, anim.dict, anim.clip, 3.0, -1, -1, 49, 0, false, false, false);
    }

    held = { prop, netId: NetworkGetNetworkIdFromEntity(prop) };
}

function stowReader() {
    if (!held) return;
    if (DoesEntityExist(held.prop)) DeleteEntity(held.prop);
    ClearPedTasks(PlayerPedId());
    held = null;
}

/**
 * Item use: nothing held -> hold the reader out and go straight to the keypad.
 * Already holding -> reopen the keypad (adjust the amount, cancel, or put it
 * away - all handled inside that one screen).
 */
async function useCardReader() {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');

    if (!held) {
        await holdReader();
        if (!held) return;
    }
    await openKeypad('mobile', held.netId);
}

/* ox_inventory calls the client export directly; qb-inventory triggers the
   client event instead - both reach the same handler, like the tablet. */
exports('useCardReader', useCardReader);
onNet('ag_mechanic:client:useCardReader', useCardReader);

onNet('ag_mechanic:client:paymentPayMobile', (data) => {
    const entity = data && data.entity;
    if (!entity || !DoesEntityExist(entity)) return;
    const netId = NetworkGetNetworkIdFromEntity(entity);
    if (!netId) return;
    openPaymentScreen('mobile', netId);
});

/* ------------------------------------------------------------------ lifecycle */

on('onResourceStop', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    despawnTerminalProp();
    stowReader();
});
