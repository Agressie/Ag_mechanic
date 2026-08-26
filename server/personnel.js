/*
 * ag_mechanic - personnel management (tablet app)
 * ============================================================================
 * Roster, hiring, firing and grade changes. The framework owns the actual job
 * assignment; we keep a shadow roster table alongside it purely so the tablet
 * can show who was hired, when, and by whom - things the core does not record.
 * ============================================================================
 */

AGM.personnel = {};

/** Grade list for the UI, from Config, lowest first. */
function gradeList() {
    return Object.entries(AGM.Config.job.grades)
        .map(([level, def]) => ({ level: Number(level), label: def.label, ...def }))
        .sort((a, b) => a.level - b.level);
}

/**
 * The roster.
 *
 * The framework is the only source of who holds the job - our own table just
 * adds the hire metadata (when, by whom) that the core does not record. Rows in
 * our table for somebody the core no longer knows about are ignored rather than
 * surfaced: an employee is whoever the framework says is an employee, and that
 * is the whole rule.
 */
AGM.personnel.roster = async function (shopId) {
    const members = AGM.core.jobMembers(AGM.Config.job.name);

    let rows = [];
    if (AGM.db.ready) {
        rows = await AGM.db.query(
            'SELECT citizenid, name, grade, hired_at, hired_by, note FROM ag_mechanic_employees WHERE shop = ?',
            [shopId],
        ).catch(() => []);
    }
    const meta = new Map((rows || []).map((r) => [r.citizenid, r]));

    const roster = members.map((m) => {
        const row = meta.get(m.citizenid);
        return {
            citizenid: m.citizenid,
            name: m.name,
            grade: m.job.grade,
            gradeLabel: (AGM.Config.job.grades[m.job.grade] || {}).label || m.job.gradeLabel || '',
            online: !!m.online,
            onDuty: !!m.job.onDuty,
            hiredAt: row ? Number(row.hired_at) || 0 : 0,
            hiredBy: row ? row.hired_by : '',
            note: row ? row.note : '',
        };
    });

    roster.sort((a, b) => (b.grade - a.grade) || a.name.localeCompare(b.name));
    return roster;
};

async function upsertRow(shopId, player, grade, hiredBy) {
    if (!AGM.db.ready) return;
    await AGM.db.query(
        `INSERT INTO ag_mechanic_employees (citizenid, shop, name, grade, hired_at, hired_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE shop = VALUES(shop), name = VALUES(name), grade = VALUES(grade)`,
        [player.citizenid, shopId, player.name, grade, Date.now(), hiredBy || ''],
    ).catch((err) => AGM.log.error('roster upsert failed:', err && err.message));
}

/* ---------------------------------------------------------------------- rpc */

AGM.rpc.register('personnel:roster', async (src, args) => {
    if (!AGM.core.canOpenTablet(src)) return { ok: false, reason: 'noPermission' };
    const me = AGM.core.getPlayer(src);
    const shopId = AGM.Locations.shop.id;

    return {
        ok: true,
        roster: await AGM.personnel.roster(shopId),
        grades: gradeList(),
        me: { citizenid: me.citizenid, grade: me.job.grade },
        can: {
            hire: AGM.core.perm(src, 'hire'),
            fire: AGM.core.perm(src, 'fire'),
            promote: AGM.core.perm(src, 'promote'),
        },
        /* Nearby players, so hiring does not need a citizen id typed by hand. */
        nearby: nearbyPlayers(src),
    };
});

/** Players within hiring distance, for the "hire nearby" list. */
function nearbyPlayers(src) {
    const ped = GetPlayerPed(String(src));
    if (!ped) return [];
    const origin = GetEntityCoords(ped);
    const out = [];

    for (const other of getPlayers()) {
        const id = Number(other);
        if (id === Number(src)) continue;
        const otherPed = GetPlayerPed(other);
        if (!otherPed) continue;
        if (AGM.util.dist(origin, GetEntityCoords(otherPed)) > 12.0) continue;

        const p = AGM.core.getPlayer(id);
        if (!p) continue;
        out.push({
            src: id,
            citizenid: p.citizenid,
            name: p.name,
            currentJob: p.job.label || p.job.name || 'Unemployed',
            alreadyHere: p.job.name === AGM.Config.job.name,
        });
    }
    return out;
}

AGM.rpc.register('personnel:hire', async (src, args) => {
    if (!AGM.core.perm(src, 'hire')) return { ok: false, reason: 'noPermission' };

    const me = AGM.core.getPlayer(src);
    const shopId = AGM.Locations.shop.id;

    /* Accept either a nearby player id or a citizen id typed into the tablet. */
    let target = null;
    if (args.src !== undefined && args.src !== null) {
        target = AGM.core.getPlayer(Number(args.src));
        if (target) {
            const ped = GetPlayerPed(String(src));
            const targetPed = GetPlayerPed(String(args.src));
            if (!targetPed || AGM.util.dist(GetEntityCoords(ped), GetEntityCoords(targetPed)) > 12.0) {
                return { ok: false, reason: 'tooFar' };
            }
        }
    } else if (args.citizenid) {
        target = AGM.core.getPlayerByCitizenId(String(args.citizenid));
    }

    if (!target) return { ok: false, reason: 'noTarget' };
    if (target.job.name === AGM.Config.job.name) return { ok: false, reason: 'alreadyEmployed' };

    const grade = AGM.util.clamp(Math.floor(Number(args.grade) || 0), 0, highestAssignable(me));

    if (!AGM.core.setJob(target.citizenid, AGM.Config.job.name, grade)) {
        return { ok: false, reason: 'coreRefused' };
    }
    await upsertRow(shopId, target, grade, me.name);
    AGM.db.log(shopId, me.name, 'hire', { target: target.name, citizenid: target.citizenid, grade });

    if (target.src) {
        AGM.core.notify(target.src, `You have been taken on at ${shopLabel()}.`, 'success');
    }
    return { ok: true, roster: await AGM.personnel.roster(shopId) };
});

AGM.rpc.register('personnel:fire', async (src, args) => {
    if (!AGM.core.perm(src, 'fire')) return { ok: false, reason: 'noPermission' };

    const me = AGM.core.getPlayer(src);
    const shopId = AGM.Locations.shop.id;
    const citizenid = String(args.citizenid || '');
    if (!citizenid) return { ok: false, reason: 'noTarget' };
    if (citizenid === me.citizenid) return { ok: false, reason: 'notYourself' };

    /*
     * The target has to be resolvable and actually employed here - the grade
     * guard below is the whole protection against sacking your own boss, and it
     * cannot be applied to somebody the framework cannot tell us about.
     */
    const target = AGM.core.getPlayerByCitizenId(citizenid);
    if (!target) return { ok: false, reason: 'noTarget' };
    if (target.job.name !== AGM.Config.job.name) return { ok: false, reason: 'notEmployed' };
    if (target.job.grade >= me.job.grade) return { ok: false, reason: 'gradeTooHigh' };

    if (!AGM.core.removeJob(citizenid, AGM.Config.job.name)) {
        return { ok: false, reason: 'coreRefused' };
    }

    if (AGM.db.ready) {
        await AGM.db.update('DELETE FROM ag_mechanic_employees WHERE citizenid = ? AND shop = ?', [citizenid, shopId]).catch(() => 0);
    }
    AGM.db.log(shopId, me.name, 'fire', { citizenid, name: target.name });

    if (target.src) AGM.core.notify(target.src, 'You have been let go.', 'error');
    return { ok: true, roster: await AGM.personnel.roster(shopId) };
});

AGM.rpc.register('personnel:grade', async (src, args) => {
    if (!AGM.core.perm(src, 'promote')) return { ok: false, reason: 'noPermission' };

    const me = AGM.core.getPlayer(src);
    const shopId = AGM.Locations.shop.id;
    const citizenid = String(args.citizenid || '');
    if (!citizenid) return { ok: false, reason: 'noTarget' };
    if (citizenid === me.citizenid) return { ok: false, reason: 'notYourself' };

    const target = AGM.core.getPlayerByCitizenId(citizenid);
    if (!target) return { ok: false, reason: 'noTarget' };
    if (target.job.name !== AGM.Config.job.name) return { ok: false, reason: 'notEmployed' };
    if (target.job.grade >= me.job.grade) return { ok: false, reason: 'gradeTooHigh' };

    const ceiling = highestAssignable(me);
    const grade = Math.floor(Number(args.grade));
    if (!Number.isFinite(grade) || !AGM.Config.job.grades[grade]) return { ok: false, reason: 'noGrade' };
    if (grade > ceiling) return { ok: false, reason: 'gradeTooHigh' };

    const promotion = grade > target.job.grade;
    if (!AGM.core.setJob(citizenid, AGM.Config.job.name, grade)) {
        return { ok: false, reason: 'coreRefused' };
    }
    await upsertRow(shopId, target, grade, me.name);
    AGM.db.log(shopId, me.name, promotion ? 'promote' : 'demote', { citizenid, from: target.job.grade, to: grade });

    if (target.src) {
        const label = (AGM.Config.job.grades[grade] || {}).label || `grade ${grade}`;
        AGM.core.notify(target.src, `You are now ${label}.`, promotion ? 'success' : 'inform');
    }
    return { ok: true, roster: await AGM.personnel.roster(shopId) };
});

/** Highest grade this player may assign to somebody else. */
function highestAssignable(me) {
    const max = Math.max(...Object.keys(AGM.Config.job.grades).map(Number));
    if (!AGM.Config.job.promoteBelowSelf) return max;
    return Math.max(0, me.job.grade - 1);
}

function shopLabel() {
    return AGM.Locations.shop.label;
}
