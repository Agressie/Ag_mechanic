/*
 * ag_mechanic - client RPC + ox_lib wrappers
 * ============================================================================
 * The client half of the request/response layer, plus promise wrappers around
 * the Lua bridge so the rest of the client code can just `await` a progress bar.
 * ============================================================================
 */

AGM.rpc = {};

let nextRequestId = 1;
const ag_mechanic_rpc_pending = new Map();

/** Calls a server handler and resolves with its return value (null on error). */
AGM.rpc.call = function (name, args = {}, timeoutMs = 15000) {
    return new Promise((resolve) => {
        const id = nextRequestId++;
        const timer = setTimeout(() => {
            if (!ag_mechanic_rpc_pending.has(id)) return;
            ag_mechanic_rpc_pending.delete(id);
            AGM.log.warn(`rpc '${name}' timed out`);
            resolve(null);
        }, timeoutMs);

        ag_mechanic_rpc_pending.set(id, { resolve, timer });
        emitNet('ag_mechanic:rpc', name, id, args);
    });
};

onNet('ag_mechanic:rpcResult', (requestId, value) => {
    const entry = ag_mechanic_rpc_pending.get(requestId);
    if (!entry) return;
    ag_mechanic_rpc_pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.resolve(value);
});

/* ------------------------------------------------------------ ox_lib bridge */

AGM.ui = {};

let nextToken = 1;
const progressWaiters = new Map();
const confirmWaiters = new Map();
const inputWaiters = new Map();

on('ag_mechanic:lua:progressResult', (token, ok) => {
    const resolve = progressWaiters.get(token);
    if (!resolve) return;
    progressWaiters.delete(token);
    resolve(!!ok);
});

on('ag_mechanic:lua:confirmResult', (token, ok) => {
    const resolve = confirmWaiters.get(token);
    if (!resolve) return;
    confirmWaiters.delete(token);
    resolve(!!ok);
});

on('ag_mechanic:lua:inputResult', (token, json) => {
    const resolve = inputWaiters.get(token);
    if (!resolve) return;
    inputWaiters.delete(token);
    let parsed = null;
    if (json) {
        try {
            parsed = JSON.parse(json);
        } catch (_) {
            parsed = null;
        }
    }
    resolve(parsed);
});

/*
 * Server refusal reasons, in English. One table for the whole client: these
 * used to live in both diagnose.js and payment.js, and because every file in a
 * resource shares one scope the second declaration quietly replaced the first,
 * so half the resource reported the wrong reason - or none at all.
 *
 * A few codes ('tooFar', 'funds') mean something different at a card machine
 * than they do under a bonnet, so payment.js wraps this with its own wording
 * rather than fighting over the same case labels.
 */
AGM.ui.reasonText = function (reason) {
    const L = AGM.Config.locale;
    switch (reason) {
        case 'noJob': return L.noJob;
        case 'noPermission': return L.noPermission;
        case 'noTool': return L.noTool;
        case 'notInBay': return L.notInBay;
        case 'vehicleMoving': return L.vehicleMoving;
        case 'tooFar': return L.noVehicle;
        case 'noVehicle': return L.noVehicle;
        case 'diagnoseFirst': return L.diagnoseFirst;
        case 'fieldCapReached': return L.fieldCapReached;
        case 'fieldNotPossible': return L.fieldNotPossible;
        case 'needsWorkshop': return L.needsGarage;
        case 'repairFailed': return L.repairFailed;
        case 'unsupported': return 'This is not something a mechanic can work on.';
        case 'alreadyFine': return 'That part is already as good as it gets.';
        case 'deliveryBusy': return L.deliveryBusy;
        case 'funds': return L.orderFunds;
        case 'tooFast': return L.tooFast;
        default: return 'That did not work.';
    }
};

AGM.ui.notify = function (description, type = 'inform', title = 'Mechanic', extra = {}) {
    emit('ag_mechanic:lua:notify', JSON.stringify({ title, description, type, ...extra }));
};

/** Resolves true when the bar completed, false when the player cancelled. */
AGM.ui.progress = function (opts) {
    return new Promise((resolve) => {
        const token = nextToken++;
        progressWaiters.set(token, resolve);
        emit('ag_mechanic:lua:progress', token, JSON.stringify(opts || {}));
    });
};

AGM.ui.progressCircle = function (opts) {
    return new Promise((resolve) => {
        const token = nextToken++;
        progressWaiters.set(token, resolve);
        emit('ag_mechanic:lua:progressCircle', token, JSON.stringify(opts || {}));
    });
};

AGM.ui.confirm = function (opts) {
    return new Promise((resolve) => {
        const token = nextToken++;
        confirmWaiters.set(token, resolve);
        emit('ag_mechanic:lua:confirm', token, JSON.stringify(opts || {}));
    });
};

AGM.ui.input = function (opts) {
    return new Promise((resolve) => {
        const token = nextToken++;
        inputWaiters.set(token, resolve);
        emit('ag_mechanic:lua:input', token, JSON.stringify(opts || {}));
    });
};

AGM.ui.textUI = function (text, opts = {}) {
    emit('ag_mechanic:lua:textUI', JSON.stringify({ show: true, text, ...opts }));
};

AGM.ui.hideTextUI = function () {
    emit('ag_mechanic:lua:textUI', JSON.stringify({ show: false }));
};

AGM.ui.cancelProgress = function () {
    emit('ag_mechanic:lua:cancelProgress');
};

/* Server-pushed notifications go through the same path. */
onNet('ag_mechanic:client:notify', (data) => {
    AGM.ui.notify(data.description, data.type, data.title);
});

