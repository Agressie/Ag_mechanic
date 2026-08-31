/*
 * ag_mechanic - repairs (client)
 * ============================================================================
 * Three flavours, one code path: pick the animation and duration, run the
 * progress bar, then let the server decide whether it worked.
 *
 *   field      tape and cable ties. Anyone, no parts, capped at 40%.
 *   mobile     a mechanic fitting the real part at the roadside.
 *   workshop   the same, on a lift.
 * ============================================================================
 */

AGM.repair = {};

let ag_mechanic_repair_busy = false;

const ANIMS = {
    engine: { dict: 'mini@repair', clip: 'fixing_a_ped', flag: 49 },
    under: { dict: 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@', clip: 'machinic_loop_mechandplayer', flag: 49 },
    wheel: { dict: 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@', clip: 'machinic_loop_mechandplayer', flag: 49 },
};

/** Which animation suits the group being worked on. */
function animFor(group) {
    switch (group) {
        case 'drivetrain':
        case 'chassis':
        case 'rotor':
        case 'controls':
            return ANIMS.under;
        case 'tyres':
        case 'brakes':
            return ANIMS.wheel;
        default:
            return ANIMS.engine;
    }
}

function durationFor(mode) {
    const cfg = AGM.Config.repair;
    if (mode === 'field') return cfg.fieldRepairDuration;
    if (mode === 'workshop') return cfg.garageRepairDuration;
    return cfg.mobileRepairDuration;
}

function labelFor(mode, componentLabel) {
    if (mode === 'field') return `Bodging ${componentLabel}`;
    if (mode === 'workshop') return `Replacing ${componentLabel}`;
    return `Fitting ${componentLabel}`;
}

/** Engine off and stationary, if the config asks for it. */
function preflight(vehicle) {
    if (GetEntitySpeed(vehicle) > 1.0) return AGM.Config.locale.vehicleMoving;
    if (AGM.Config.repair.requireEngineOff && GetIsVehicleEngineRunning(vehicle)) {
        return AGM.Config.locale.engineRunning;
    }
    return null;
}

/**
 * Fixes the *visible* state after a repair. GTA only offers a blunt instrument
 * for glass and panel damage, so we use it and then put back everything it
 * repaired that it had no business touching.
 */
AGM.repair.applyVisuals = function (vehicle, state, componentId) {
    if (!DoesEntityExist(vehicle) || !state) return;

    const comp = AGM.Components.get(state.blueprint, componentId);
    if (!comp) return;

    if (comp.wheelIndex !== null && comp.wheelIndex !== undefined) {
        SetVehicleTyreFixed(vehicle, comp.wheelIndex);
        return;
    }

    /* Glass and body work: SetVehicleFixed is the only thing that unbreaks a
       window, so let it run and then restore what it should not have fixed. */
    if (componentId === 'windows' || componentId === 'body' || componentId === 'hull' || componentId === 'airframe') {
        SetVehicleFixed(vehicle);
        SetVehicleDeformationFixed(vehicle);

        const health = state.health || {};
        const bodyKey = health.body !== undefined ? 'body' : health.hull !== undefined ? 'hull' : 'airframe';
        const bodyValue = health[bodyKey];
        if (Number.isFinite(bodyValue)) {
            SetVehicleBodyHealth(vehicle, AGM.util.clamp((bodyValue / 100) * 1000, 100, 1000));
        }
        /* Re-apply everything else, including re-bursting still-dead tyres. */
        AGM.perf.apply(vehicle, state);
    }
};

/**
 * Runs one repair. `mode` is 'field' | 'mobile' | 'workshop'.
 * Returns true when the part actually moved.
 */
AGM.repair.perform = async function (info, componentId, mode, meta = {}) {
    if (ag_mechanic_repair_busy) return false;
    if (!info) return false;

    const vehicle = info.entity && DoesEntityExist(info.entity)
        ? info.entity
        : (NetworkDoesEntityExistWithNetworkId(info.netId) ? NetworkGetEntityFromNetworkId(info.netId) : 0);

    if (!vehicle || !DoesEntityExist(vehicle)) {
        AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
        return false;
    }

    const problem = preflight(vehicle);
    if (problem) {
        AGM.ui.notify(problem, 'error');
        return false;
    }

    ag_mechanic_repair_busy = true;
    try {
        /* Make sure the server has the newest wear before it decides anything. */
        AGM.monitor.flushNow();

        const label = meta.label || componentId;
        const completed = await AGM.ui.progress({
            duration: durationFor(mode),
            label: labelFor(mode, label),
            canCancel: true,
            anim: animFor(meta.group),
            disable: { car: true, move: true, combat: true },
        });
        if (!completed) return false;

        const rpcName = mode === 'field' ? 'repair:field' : mode === 'workshop' ? 'repair:workshop' : 'repair:mobile';
        const result = await AGM.rpc.call(rpcName, AGM.state.args(info, { component: componentId }));

        if (!result || !result.ok) {
            const reason = result && result.reason;
            if (reason === 'noItem') {
                AGM.ui.notify(AGM.util.fmt(AGM.Config.locale.noItem, result.itemLabel || result.item || 'a part'), 'error');
            } else {
                AGM.ui.notify(AGM.ui.reasonText(reason), 'error');
            }
            return false;
        }

        const state = await AGM.state.fetch(info);
        if (state) {
            AGM.perf.apply(vehicle, state);
            AGM.repair.applyVisuals(vehicle, state, componentId);
        }

        if (mode === 'field') {
            AGM.ui.notify(
                result.capped
                    ? `${result.label} is holding at ${Math.round(result.health)}%. It needs replacing properly.`
                    : `${result.label} bodged up to ${Math.round(result.health)}%.`,
                'success',
            );
        } else {
            AGM.ui.notify(AGM.util.fmt(AGM.Config.locale.repairDone, result.label), 'success');
        }
        return true;
    } finally {
        ag_mechanic_repair_busy = false;
        ClearPedTasks(PlayerPedId());
    }
};

/** Everything the mechanic can legally do where they are standing. */
AGM.repair.fullService = async function (info) {
    if (ag_mechanic_repair_busy || !info) return false;

    const vehicle = info.entity && DoesEntityExist(info.entity) ? info.entity : 0;
    if (!vehicle) {
        AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
        return false;
    }

    const problem = preflight(vehicle);
    if (problem) {
        AGM.ui.notify(problem, 'error');
        return false;
    }

    const triage = await AGM.rpc.call('repair:triage', AGM.state.args(info));
    if (!triage || !triage.ok) {
        AGM.ui.notify(AGM.Config.locale.diagnoseFirst, 'error');
        return false;
    }

    const jobs = triage.plan.jobs.filter((j) => j.required);
    if (!jobs.length) {
        AGM.ui.notify('Nothing on it needs doing.', 'inform');
        return false;
    }

    ag_mechanic_repair_busy = true;
    try {
        const completed = await AGM.ui.progress({
            duration: Math.min(90000, AGM.Config.repair.mobileRepairDuration * jobs.length),
            label: `Working through ${jobs.length} job${jobs.length === 1 ? '' : 's'}`,
            canCancel: true,
            anim: ANIMS.engine,
        });
        if (!completed) return false;

        const result = await AGM.rpc.call('repair:service', AGM.state.args(info));
        if (!result || !result.ok) {
            AGM.ui.notify(AGM.ui.reasonText(result && result.reason), 'error');
            return false;
        }

        const state = await AGM.state.fetch(info);
        if (state) {
            AGM.perf.apply(vehicle, state);
            for (const entry of result.done) AGM.repair.applyVisuals(vehicle, state, entry.id);
        }

        if (result.done.length) {
            AGM.ui.notify(`Replaced: ${result.done.map((d) => d.label).join(', ')}.`, 'success');
        }
        if (result.skipped.length) {
            const towNeeded = result.skipped.filter((s) => s.reason === 'needsWorkshop');
            const missing = result.skipped.filter((s) => s.reason === 'noPart');
            if (towNeeded.length) {
                AGM.ui.notify(`Needs a workshop: ${towNeeded.map((s) => s.label).join(', ')}.`, 'warning');
            }
            if (missing.length) {
                AGM.ui.notify(`No parts on you for: ${missing.map((s) => s.partLabel || s.label).join(', ')}.`, 'warning');
            }
        }
        return true;
    } finally {
        ag_mechanic_repair_busy = false;
        ClearPedTasks(PlayerPedId());
    }
};

/**
 * Quick answer for a driver standing at their own car: can this be sorted here,
 * or is it going on a truck? Reads their own report, so it is only as good as
 * their diagnosis was.
 */
AGM.repair.triage = async function (vehicle) {
    const info = AGM.state.describe(vehicle);
    if (!info) return;

    const result = await AGM.rpc.call('repair:triage', AGM.state.args(info));
    if (!result || !result.ok) {
        AGM.ui.notify(AGM.Config.locale.diagnoseFirst, 'error');
        return;
    }

    const { triage } = result;
    if (triage.tow) {
        AGM.ui.notify(
            `${triage.garage.length} part${triage.garage.length === 1 ? '' : 's'} can only be done in a workshop. This one needs recovering.`,
            'warning', 'Triage',
        );
    } else if (triage.mobile.length) {
        AGM.ui.notify('A mechanic can sort all of this at the roadside.', 'inform', 'Triage');
    } else {
        AGM.ui.notify('Nothing on it needs doing.', 'success', 'Triage');
    }
};

/* --------------------------------------------------------- UI action routing */

on('ag_mechanic:internal:nuiAction', async (action, args) => {
    if (action === 'repair') {
        const info = AGM.nui.context.vehicle;
        if (!info) return;
        AGM.nui.close(true);

        const mode = String(args.mode || 'mobile');
        await AGM.repair.perform(info, String(args.component || ''), mode, {
            label: args.label,
            group: args.group,
        });

        /* Put the report back up, refreshed, so the mechanic can carry on. */
        const vehicle = info.entity && DoesEntityExist(info.entity) ? info.entity : 0;
        if (vehicle) await AGM.diagnose.showLast(vehicle);
        return;
    }

    if (action === 'service') {
        const info = AGM.nui.context.vehicle;
        if (!info) return;
        AGM.nui.close(true);
        await AGM.repair.fullService(info);

        const vehicle = info.entity && DoesEntityExist(info.entity) ? info.entity : 0;
        if (vehicle) await AGM.diagnose.showLast(vehicle);
    }
});

