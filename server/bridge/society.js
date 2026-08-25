/*
 * ag_mechanic - society account bridge
 * ============================================================================
 * Where the money for a parts order comes from. Tries the common banking
 * resources in turn and falls back to charging the ordering player directly, so
 * the shop app is never dead in the water because a banking script is missing.
 * ============================================================================
 */

AGM.society = {};

const started = (res) => GetResourceState(res) === 'started';

function tryExport(resource, name, ...args) {
    try {
        /* `global.exports` because server scripts are CommonJS modules, where the
           bare `exports` identifier is module.exports. */
        const target = global.exports[resource];
        const fn = target && target[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    } catch (err) {
        AGM.log.debug(`society export ${resource}.${name} failed:`, err && err.message);
        return undefined;
    }
}

AGM.society.backend = 'player';

AGM.society.detect = function () {
    if (started('Renewed-Banking')) AGM.society.backend = 'renewed';
    else if (started('fd_banking')) AGM.society.backend = 'fd';
    else if (started('qbx_management')) AGM.society.backend = 'qbx_management';
    else if (started('qb-management')) AGM.society.backend = 'qb_management';
    else AGM.society.backend = 'player';
    AGM.log.info(`society account backend: ${AGM.society.backend}`);
    return AGM.society.backend;
};

AGM.society.balance = function (account) {
    switch (AGM.society.backend) {
        case 'renewed': {
            const n = tryExport('Renewed-Banking', 'getAccountMoney', account);
            return Number(n) || 0;
        }
        case 'fd': {
            const n = tryExport('fd_banking', 'GetAccount', account);
            return Number(n && n.amount !== undefined ? n.amount : n) || 0;
        }
        case 'qbx_management': {
            const n = tryExport('qbx_management', 'GetAccountBalance', 'job', account);
            return Number(n) || 0;
        }
        case 'qb_management': {
            const n = tryExport('qb-management', 'GetAccount', account);
            return Number(n) || 0;
        }
        default:
            return 0;
    }
};

/**
 * Charges an order. `src` is the player placing it, used both for the fallback
 * and for the audit trail. Returns { ok, paidFrom, reason }.
 */
AGM.society.charge = function (src, amount, reason) {
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return { ok: true, paidFrom: 'free' };

    const mode = AGM.Config.economy.orderPaymentAccount;
    if (mode === 'free') return { ok: true, paidFrom: 'free' };

    if (mode === 'cash' || mode === 'bank') {
        if (!AGM.core.removeMoney(src, mode, amt, reason)) {
            return { ok: false, reason: 'funds' };
        }
        return { ok: true, paidFrom: mode };
    }

    const account = AGM.Config.economy.society;

    switch (AGM.society.backend) {
        case 'renewed': {
            const ok = tryExport('Renewed-Banking', 'removeAccountMoney', account, amt);
            if (ok !== undefined && ok !== false) return { ok: true, paidFrom: 'society' };
            break;
        }
        case 'fd': {
            const ok = tryExport('fd_banking', 'RemoveMoney', account, amt, reason);
            if (ok !== undefined && ok !== false) return { ok: true, paidFrom: 'society' };
            break;
        }
        case 'qbx_management': {
            const ok = tryExport('qbx_management', 'RemoveAccountBalance', 'job', account, amt);
            if (ok !== undefined && ok !== false) return { ok: true, paidFrom: 'society' };
            break;
        }
        case 'qb_management': {
            const ok = tryExport('qb-management', 'RemoveMoney', account, amt);
            if (ok !== undefined && ok !== false) return { ok: true, paidFrom: 'society' };
            break;
        }
        default:
            break;
    }

    /* No society account available (or it refused): bill the person ordering. */
    if (AGM.core.removeMoney(src, 'bank', amt, reason)) return { ok: true, paidFrom: 'bank' };
    if (AGM.core.removeMoney(src, 'cash', amt, reason)) return { ok: true, paidFrom: 'cash' };
    return { ok: false, reason: 'funds' };
};

/** Pays money in, e.g. a customer settling a repair invoice. */
AGM.society.deposit = function (amount, reason) {
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return true;
    const account = AGM.Config.economy.society;

    switch (AGM.society.backend) {
        case 'renewed':
            return tryExport('Renewed-Banking', 'addAccountMoney', account, amt) !== undefined;
        case 'fd':
            return tryExport('fd_banking', 'AddMoney', account, amt, reason) !== undefined;
        case 'qbx_management':
            return tryExport('qbx_management', 'AddAccountBalance', 'job', account, amt) !== undefined;
        case 'qb_management':
            return tryExport('qb-management', 'AddMoney', account, amt) !== undefined;
        default:
            return false;
    }
};
