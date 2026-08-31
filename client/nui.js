/*
 * ag_mechanic - NUI bus
 * ============================================================================
 * One Svelte app hosts every screen this resource shows: the tablet, the
 * diagnostic report, the repair and upgrade menus, and the diagnose minigame.
 * They are all "screens" on the same page, which keeps the look consistent and
 * means there is exactly one focus owner to reason about.
 * ============================================================================
 */

AGM.nui = {
    open: false,
    screen: null,
    /** Vehicle the open screen is acting on, so UI callbacks can be scoped. */
    context: { vehicle: null },
};

let resultResolver = null;

function setFocus(on, cursor = true) {
    SetNuiFocus(on, on && cursor);
    SetNuiFocusKeepInput(false);
}

/** Sends a message to the page without changing focus. */
AGM.nui.send = function (action, data = {}) {
    SendNuiMessage(JSON.stringify({ action, data }));
};

/** Opens a screen and takes focus. */
AGM.nui.show = function (screen, data = {}, opts = {}) {
    AGM.nui.open = true;
    AGM.nui.screen = screen;
    if (opts.vehicle !== undefined) AGM.nui.context.vehicle = opts.vehicle;

    setFocus(true, opts.cursor !== false);
    AGM.nui.send('show', { screen, payload: data });
};

/** Closes whatever is open and hands input back to the game. */
AGM.nui.close = function (silent = false) {
    if (!AGM.nui.open) return;
    AGM.nui.open = false;
    AGM.nui.screen = null;
    AGM.nui.context.vehicle = null;
    setFocus(false);
    if (!silent) AGM.nui.send('hide', {});

    if (resultResolver) {
        const resolve = resultResolver;
        resultResolver = null;
        resolve(null);
    }
};

/**
 * Opens a screen and waits for it to post a result - how the minigame and the
 * confirm-style menus report back. Resolves null if the player closes it.
 */
AGM.nui.awaitResult = function (screen, data = {}, opts = {}) {
    return new Promise((resolve) => {
        if (resultResolver) {
            /* Never leave a previous waiter hanging. */
            const previous = resultResolver;
            resultResolver = null;
            previous(null);
        }
        resultResolver = resolve;
        AGM.nui.show(screen, data, opts);
    });
};

function deliverResult(value) {
    if (!resultResolver) return;
    const resolve = resultResolver;
    resultResolver = null;
    resolve(value);
}

/* ------------------------------------------------------------- nui callbacks */

RegisterNuiCallbackType('close');
on('__cfx_nui:close', (_data, cb) => {
    /* Not silent: the page waits to be told 'hide' before it clears itself, so
       closing silently here hands input back to the player while leaving the
       screen still drawn over the top of it. */
    AGM.nui.close();
    cb({ ok: true });
});

RegisterNuiCallbackType('result');
on('__cfx_nui:result', (data, cb) => {
    deliverResult(data);
    cb({ ok: true });
});

/** Closes the page but keeps the promise alive, e.g. minigame -> progress bar. */
RegisterNuiCallbackType('release');
on('__cfx_nui:release', (_data, cb) => {
    AGM.nui.open = false;
    AGM.nui.screen = null;
    setFocus(false);
    cb({ ok: true });
});

/**
 * Generic bridge from the page to a server handler. The page never talks to the
 * server directly; the client fills in vehicle context and the server validates
 * everything regardless.
 */
const ALLOWED_RPC = [
    'tablet:open', 'tablet:dashboard',
    'personnel:roster', 'personnel:hire', 'personnel:fire', 'personnel:grade',
    'shop:catalogue', 'shop:orders', 'shop:order', 'shop:cancel', 'shop:receive',
    'shop:stash', 'shop:stashOpen', 'shop:stashTake', 'shop:stashPut',
    'delivery:status',
    'upgrades:list', 'upgrades:install',
    'repair:field', 'repair:mobile', 'repair:workshop', 'repair:service', 'repair:triage',
    'diagnose:last',
    'scanner:scan', 'scanner:live', 'scanner:freeze',
];

RegisterNuiCallbackType('rpc');
on('__cfx_nui:rpc', async (data, cb) => {
    const name = String((data && data.name) || '');
    if (!ALLOWED_RPC.includes(name)) {
        AGM.log.warn(`NUI tried to call a handler that is not exposed: ${name}`);
        return cb({ ok: false, reason: 'notAllowed' });
    }

    let args = (data && data.args) || {};
    if (data && data.withVehicle) {
        const info = AGM.nui.context.vehicle;
        if (!info) return cb({ ok: false, reason: 'noVehicle' });
        args = { ...AGM.state.args(info), ...args };
    }

    const result = await AGM.rpc.call(name, args);
    cb(result === null || result === undefined ? { ok: false, reason: 'failed' } : result);
});

/** Lets the page trigger client-side behaviour (open a real stash UI, etc). */
RegisterNuiCallbackType('client');
on('__cfx_nui:client', (data, cb) => {
    const action = String((data && data.action) || '');
    emit('ag_mechanic:internal:nuiAction', action, (data && data.args) || {});
    cb({ ok: true });
});

/* ox_inventory / qb-inventory fallback: open the stash from the client side. */
onNet('ag_mechanic:client:openStash', (stashId) => {
    if (GetResourceState('ox_inventory') === 'started') {
        emit('ox_inventory:openInventory', 'stash', stashId);
    } else if (GetResourceState('qb-inventory') === 'started') {
        emitNet('inventory:server:OpenInventory', 'stash', stashId);
    }
});

/* Escape always closes, whatever screen is showing. */
setTick(() => {
    if (!AGM.nui.open) return;
    if (IsControlJustReleased(0, 200) || IsDisabledControlJustReleased(0, 200)) {
        AGM.nui.close();
    }
});
