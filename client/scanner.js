/*
 * ag_mechanic - the scanner (client)
 * ============================================================================
 * Find the port, plug in, wait for the tool to link up, then work the device.
 *
 * The scan itself happens server-side the moment the link is made; this file
 * sets the scene and hands the results to the device UI. What the player does
 * with the buttons after that is reading, not re-querying - the same as holding
 * a real one.
 * ============================================================================
 */

/* Own scope: FiveM evaluates every file in a resource into one shared global,
   so a top-level `const`/`let` here would collide with the same name in another
   file and kill this one on load with a SyntaxError. */
(() => {
AGM.scanner = {};

let busy = false;

/** Where the port lives, per machine. Flavour for the progress bar. */
function portLocation(blueprint) {
    switch (blueprint) {
        case 'car': return 'under the dashboard';
        case 'bike': return 'under the seat';
        case 'heli': return 'in the avionics bay';
        case 'plane': return 'in the panel sub-bay';
        case 'boat': return 'at the engine loom';
        default: return 'at the diagnostic port';
    }
}

async function crouchAnim(ped) {
    const dict = 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@';
    RequestAnimDict(dict);
    const deadline = GetGameTimer() + 2000;
    while (!HasAnimDictLoaded(dict) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (HasAnimDictLoaded(dict)) {
        TaskPlayAnim(ped, dict, 'machinic_loop_mechandplayer', 8.0, -8.0, -1, 49, 0, false, false, false);
    }
}

/**
 * Plugs in and opens the device. Needs the scanner item - checked here for a
 * quick answer, and again on the server, which is the one that counts.
 */
AGM.scanner.run = async function (vehicle) {
    if (busy) return null;

    const info = AGM.state.describe(vehicle);
    if (!info) {
        AGM.ui.notify('There is no diagnostic port on that.', 'error');
        return null;
    }
    if (GetEntitySpeed(vehicle) > 1.0) {
        AGM.ui.notify(AGM.Config.locale.vehicleMoving, 'error');
        return null;
    }

    /* Different machines speak different buses, so they need different tools.
       Checked here for an instant answer, and again on the server. */
    const device = AGM.Dtc.deviceFor(info.blueprint);
    if (!device) {
        AGM.ui.notify('Nothing on this reports to a diagnostic tool.', 'error');
        return null;
    }

    busy = true;
    const ped = PlayerPedId();

    try {
        await crouchAnim(ped);

        const pluggedIn = await AGM.ui.progressCircle({
            duration: AGM.Config.scanner.hookupDuration,
            label: `Connecting the ${device.model} ${portLocation(info.blueprint)}`,
            canCancel: true,
        });
        if (!pluggedIn) return null;

        /* Make sure the server has the newest wear before it reads the codes -
           otherwise the scan can lag a fault the driver just caused. */
        AGM.monitor.flushNow();
        await new Promise((resolve) => setTimeout(resolve, 250));

        const result = await AGM.rpc.call('scanner:scan', AGM.state.args(info));

        if (!result || !result.ok) {
            const reason = result && result.reason;
            if (reason === 'wrongDevice') {
                AGM.ui.notify(
                    `A ${result.carrying} cannot talk to this. It runs ${result.bus} - you want the ${result.itemLabel}.`,
                    'error', 'Wrong tool',
                );
            } else if (reason === 'noItem') {
                AGM.ui.notify(
                    AGM.util.fmt(AGM.Config.locale.noItem, result.itemLabel || device.label),
                    'error',
                );
            } else {
                AGM.ui.notify(AGM.diagnose.reasonText(reason), 'error');
            }
            return null;
        }

        await AGM.state.fetch(info);

        AGM.nui.show('scanner', {
            scan: result.scan,
            liveInterval: AGM.Config.scanner.liveInterval,
        }, { vehicle: info });

        return result.scan;
    } finally {
        busy = false;
        ClearPedTasks(PlayerPedId());
    }
};

/* --------------------------------------------------------------- interactions */

onNet('ag_mechanic:client:targetScan', (data) => {
    const vehicle = data && data.entity && DoesEntityExist(data.entity)
        ? data.entity
        : AGM.state.nearestVehicle(6.0);

    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.scanner.run(vehicle);
});

})();
