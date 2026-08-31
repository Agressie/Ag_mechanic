/*
 * ag_mechanic - diagnostics
 * ============================================================================
 * Pop the bonnet, back a few bolts out without rounding them, unplug a sensor
 * line without snapping the tab, and read what the vehicle tells you. How
 * cleanly that goes decides how much of the report you actually get.
 *
 * The minigame itself lives in the NUI page; this file sets the scene, waits for
 * a score, and hands it to the server.
 * ============================================================================
 */

AGM.diagnose = {};

let ag_mechanic_diagnose_busy = false;

/** Bonnet-equivalent access for the blueprint, or null where there is none. */
function accessPanel(blueprint) {
    switch (blueprint) {
        case 'car': return { door: 4, label: 'bonnet' };
        case 'bike': return { door: null, label: 'side panels' };
        case 'heli': return { door: null, label: 'engine cowling' };
        case 'plane': return { door: null, label: 'engine cowling' };
        case 'boat': return { door: null, label: 'engine hatch' };
        default: return null;
    }
}

async function playSceneAnim(ped) {
    const dict = 'mini@repair';
    RequestAnimDict(dict);
    const deadline = GetGameTimer() + 2000;
    while (!HasAnimDictLoaded(dict) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (HasAnimDictLoaded(dict)) {
        TaskPlayAnim(ped, dict, 'fixing_a_ped', 8.0, -8.0, -1, 49, 0, false, false, false);
    } else {
        TaskStartScenarioInPlace(ped, 'WORLD_HUMAN_VEHICLE_MECHANIC', 0, true);
    }
}

function stopSceneAnim(ped) {
    ClearPedTasks(ped);
}

/** Difficulty scales with how complicated the machine is. */
function minigameConfig(blueprint) {
    const cfg = AGM.Config.diagnose;
    const complex = blueprint === 'heli' || blueprint === 'plane';

    return {
        bolts: AGM.util.randInt(cfg.bolts.min, cfg.bolts.max) + (complex ? 1 : 0),
        lines: AGM.util.randInt(cfg.lines.min, cfg.lines.max) + (complex ? 1 : 0),
        blueprint,
        blueprintLabel: AGM.Classes.labels[blueprint] || blueprint,
        /* Mechanics have done this a thousand times; the bands are kinder. */
        skilled: AGM.state.isMechanic(),
    };
}

/**
 * Runs a full diagnosis on a vehicle. Returns the report, or null if the player
 * backed out or the server refused.
 */
AGM.diagnose.run = async function (vehicle) {
    if (ag_mechanic_diagnose_busy) return null;

    const info = AGM.state.describe(vehicle);
    if (!info) {
        AGM.ui.notify('There is nothing here worth diagnosing.', 'error');
        return null;
    }
    if (GetEntitySpeed(vehicle) > 1.0) {
        AGM.ui.notify(AGM.Config.locale.vehicleMoving, 'error');
        return null;
    }

    ag_mechanic_diagnose_busy = true;
    const ped = PlayerPedId();
    const panel = accessPanel(info.blueprint);

    try {
        if (panel && panel.door !== null) SetVehicleDoorOpen(vehicle, panel.door, false, false);
        await playSceneAnim(ped);

        const opened = await AGM.ui.progressCircle({
            duration: 3500,
            label: `Getting to the ${panel ? panel.label : 'engine'}`,
            canCancel: true,
        });
        if (!opened) return null;

        const result = await AGM.nui.awaitResult('diagnose', minigameConfig(info.blueprint), { vehicle: info });
        if (!result || result.cancelled) {
            AGM.ui.notify('You gave up halfway through.', 'inform');
            return null;
        }

        const score = AGM.util.clamp(Number(result.score) || 0, 0, 1);
        const response = await AGM.rpc.call('diagnose:submit', AGM.state.args(info, { score }));

        if (!response || !response.ok) {
            AGM.ui.notify(AGM.ui.reasonText(response && response.reason), 'error');
            return null;
        }

        AGM.state.setReport(response.vehicleKey, response.report);
        await AGM.state.fetch(info);

        AGM.nui.show('report', {
            report: response.report,
            canRepair: true,
            isMechanic: AGM.state.isMechanic(),
        }, { vehicle: info });

        return response.report;
    } finally {
        ag_mechanic_diagnose_busy = false;
        stopSceneAnim(ped);
        if (panel && panel.door !== null && DoesEntityExist(vehicle)) {
            SetVehicleDoorShut(vehicle, panel.door, false);
        }
    }
};

/** Re-opens the last report for a vehicle without redoing the work. */
AGM.diagnose.showLast = async function (vehicle) {
    const info = AGM.state.describe(vehicle);
    if (!info) return null;

    const cached = AGM.state.getReport(info.key);
    if (cached) {
        AGM.nui.show('report', { report: cached, canRepair: true, isMechanic: AGM.state.isMechanic() }, { vehicle: info });
        return cached;
    }

    const response = await AGM.rpc.call('diagnose:last', AGM.state.args(info));
    if (!response || !response.ok) {
        AGM.ui.notify(AGM.Config.locale.diagnoseFirst, 'error');
        return null;
    }

    AGM.state.setReport(response.vehicleKey, response.report);
    AGM.nui.show('report', { report: response.report, canRepair: true, isMechanic: AGM.state.isMechanic() }, { vehicle: info });
    return response.report;
};

/** Shared translation of server refusal codes into something readable. */

