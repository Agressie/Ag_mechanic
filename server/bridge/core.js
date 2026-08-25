/*
 * ag_mechanic - framework bridge (qbx_core / Qbox)
 * ============================================================================
 * Everything this resource needs to know about players, jobs and money goes
 * through here, so retargeting it at another framework means editing one file.
 *
 * Calls are made defensively. Qbox's export surface has changed shape more than
 * once (single job -> multijob), so each helper tries the current API first and
 * falls back to the older one rather than hard-crashing a repair.
 * ============================================================================
 */

AGM.core = {};

const CORE = 'qbx_core';

/** Calls an export, returning undefined instead of throwing. */
function tryExport(resource, name, ...args) {
    try {
        /* `global.exports` because server scripts are CommonJS modules, where the
           bare `exports` identifier is module.exports. */
        const target = global.exports[resource];
        const fn = target && target[name];
        if (typeof fn !== 'function') return undefined;
        return fn(...args);
    } catch (err) {
        AGM.log.debug(`export ${resource}.${name} failed:`, err && err.message);
        return undefined;
    }
}

AGM.core.available = function () {
    return GetResourceState(CORE) === 'started';
};

/* ------------------------------------------------------------------ players */

/** Raw qbx player object, or null. */
function rawPlayer(src) {
    return tryExport(CORE, 'GetPlayer', Number(src)) || null;
}

function rawPlayerByCid(citizenid) {
    return tryExport(CORE, 'GetPlayerByCitizenId', String(citizenid))
        || tryExport(CORE, 'GetOfflinePlayer', String(citizenid))
        || null;
}

/** Normalised player view used everywhere in this resource. */
function normalise(raw, src) {
    if (!raw) return null;
    const data = raw.PlayerData || raw.playerData || raw;
    const job = data.job || {};
    const grade = job.grade || {};
    const charinfo = data.charinfo || {};

    return {
        src: src !== undefined ? Number(src) : Number(data.source) || null,
        citizenid: data.citizenid || data.citizenId || '',
        name: [charinfo.firstname, charinfo.lastname].filter(Boolean).join(' ')
            || data.name
            || (src ? GetPlayerName(String(src)) : '')
            || 'Unknown',
        job: {
            name: job.name || '',
            label: job.label || '',
            grade: Number(grade.level !== undefined ? grade.level : grade) || 0,
            gradeLabel: grade.name || '',
            isBoss: !!job.isboss || !!job.isBoss,
            onDuty: data.job && data.job.onduty !== undefined ? !!data.job.onduty : true,
        },
        _raw: raw,
    };
}

AGM.core.getPlayer = (src) => normalise(rawPlayer(src), src);

AGM.core.getPlayerByCitizenId = (citizenid) => normalise(rawPlayerByCid(citizenid));

/** Every connected player, normalised. */
AGM.core.getPlayers = function () {
    const out = [];
    for (const src of getPlayers()) {
        const p = AGM.core.getPlayer(src);
        if (p) out.push(p);
    }
    return out;
};

/* --------------------------------------------------------------------- jobs */

/** Does this player hold the given job (any grade)? */
AGM.core.hasJob = function (src, jobName) {
    const p = AGM.core.getPlayer(src);
    return !!p && p.job.name === jobName;
};

/**
 * Grade permission lookup, e.g. perm(src, 'hire'). Falls back to "no" so a
 * misconfigured grade table can never accidentally grant access.
 */
AGM.core.perm = function (src, key) {
    const p = AGM.core.getPlayer(src);
    if (!p || p.job.name !== AGM.Config.job.name) return false;
    const grade = AGM.Config.job.grades[p.job.grade];
    if (!grade) return false;
    return !!grade[key];
};

/** May this player open the tablet at all? */
AGM.core.canOpenTablet = function (src) {
    const p = AGM.core.getPlayer(src);
    if (!p || p.job.name !== AGM.Config.job.name) return false;
    return AGM.Config.job.tabletGrades.includes(p.job.grade);
};

/**
 * Hire / promote. Qbox is a multijob framework, so we add the job and make it
 * primary; older single-job builds only have SetJob.
 */
AGM.core.setJob = function (citizenid, jobName, grade) {
    const cid = String(citizenid);
    const level = Number(grade) || 0;

    let ok = tryExport(CORE, 'AddPlayerToJob', cid, jobName, level);
    if (ok !== undefined && ok !== false) {
        tryExport(CORE, 'SetPlayerPrimaryJob', cid, jobName);
        return true;
    }

    /* Older single-job API, via the player object. */
    const raw = rawPlayerByCid(cid);
    if (raw && raw.Functions && typeof raw.Functions.SetJob === 'function') {
        try {
            raw.Functions.SetJob(jobName, level);
            return true;
        } catch (err) {
            AGM.log.error('SetJob failed:', err && err.message);
        }
    }

    ok = tryExport(CORE, 'SetJob', cid, jobName, level);
    return ok !== undefined && ok !== false;
};

/** Fire. Returns true when the player no longer holds the job. */
AGM.core.removeJob = function (citizenid, jobName) {
    const cid = String(citizenid);

    let ok = tryExport(CORE, 'RemovePlayerFromJob', cid, jobName);
    if (ok !== undefined && ok !== false) return true;

    /* Single-job frameworks: put them back on unemployed. */
    const raw = rawPlayerByCid(cid);
    if (raw && raw.Functions && typeof raw.Functions.SetJob === 'function') {
        try {
            raw.Functions.SetJob('unemployed', 0);
            return true;
        } catch (err) {
            AGM.log.error('removeJob fallback failed:', err && err.message);
        }
    }
    return false;
};

/**
 * Everyone on the payroll, online or not. Online players come from the core;
 * offline names come from our own shadow roster table, which is why we keep it.
 */
AGM.core.jobMembers = function (jobName) {
    const seen = new Map();

    /* Qbox keeps a group index; use it when present. */
    const members = tryExport(CORE, 'GetGroupMembers', jobName, 'job');
    if (Array.isArray(members)) {
        for (const cid of members) {
            const p = AGM.core.getPlayerByCitizenId(cid);
            if (p) seen.set(p.citizenid, { ...p, online: !!rawPlayer(p.src) });
        }
    }

    for (const p of AGM.core.getPlayers()) {
        if (p.job.name !== jobName) continue;
        seen.set(p.citizenid, { ...p, online: true });
    }

    return Array.from(seen.values());
};

/* -------------------------------------------------------------------- money */

AGM.core.removeMoney = function (src, account, amount, reason) {
    const raw = rawPlayer(src);
    if (!raw) return false;
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return true;

    if (raw.Functions && typeof raw.Functions.RemoveMoney === 'function') {
        try {
            return !!raw.Functions.RemoveMoney(account, amt, reason || 'ag_mechanic');
        } catch (err) {
            AGM.log.error('RemoveMoney failed:', err && err.message);
        }
    }
    const ok = tryExport(CORE, 'RemoveMoney', Number(src), account, amt, reason || 'ag_mechanic');
    return ok !== undefined && ok !== false;
};

AGM.core.addMoney = function (src, account, amount, reason) {
    const raw = rawPlayer(src);
    if (!raw) return false;
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!amt) return true;

    if (raw.Functions && typeof raw.Functions.AddMoney === 'function') {
        try {
            return !!raw.Functions.AddMoney(account, amt, reason || 'ag_mechanic');
        } catch (err) {
            AGM.log.error('AddMoney failed:', err && err.message);
        }
    }
    const ok = tryExport(CORE, 'AddMoney', Number(src), account, amt, reason || 'ag_mechanic');
    return ok !== undefined && ok !== false;
};

AGM.core.getMoney = function (src, account) {
    const raw = rawPlayer(src);
    if (!raw) return 0;
    const data = raw.PlayerData || raw.playerData || {};
    return Number((data.money || {})[account]) || 0;
};

/* ---------------------------------------------------------------- messaging */

/** Notification, rendered client-side through ox_lib. */
AGM.core.notify = function (src, message, type = 'inform', title = 'Mechanic') {
    if (!src) return;
    emitNet('ag_mechanic:client:notify', Number(src), { title, description: message, type });
};

AGM.core.playerName = function (src) {
    const p = AGM.core.getPlayer(src);
    return p ? p.name : GetPlayerName(String(src)) || 'Unknown';
};
