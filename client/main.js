/*
 * ag_mechanic - client entry point
 * ============================================================================
 * Boot, teardown and the couple of loops that do not belong to a subsystem.
 * ============================================================================
 */

let started = false;

async function boot() {
    if (started) return;
    started = true;

    await AGM.state.refreshJob();

    AGM.targets.registerVehicles();
    AGM.targets.registerShops();
    AGM.payment.registerShop();
    AGM.payment.registerMobile();
    AGM.monitor.start();

    AGM.log.info('client ready');
}

on('onClientResourceStart', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    boot().catch((err) => AGM.log.error('client boot failed:', err && err.stack ? err.stack : err));
});

on('onResourceStop', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    AGM.targets.remove();
    AGM.nui.close(true);
    AGM.ui.hideTextUI();

    /* Give every vehicle we degraded its factory handling back, otherwise a
       restart leaves half the city driving like it needs a service. */
    for (const vehicle of GetGamePool('CVehicle')) {
        AGM.perf.restore(vehicle);
    }
});

/* Job changes have to re-run the target/group checks. */
onNet('QBCore:Client:OnJobUpdate', () => {
    AGM.state.refreshJob();
});
onNet('qbx_core:client:onJobUpdate', () => {
    AGM.state.refreshJob();
});
onNet('QBCore:Client:OnPlayerLoaded', () => {
    AGM.state.refreshJob();
});

/**
 * Keeps degraded handling applied to vehicles the player is near but not in -
 * a mechanic road-testing somebody else's car should feel the same fault the
 * owner was complaining about.
 */
setTick(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const ped = PlayerPedId();
    const coords = GetEntityCoords(ped, true);

    for (const vehicle of GetGamePool('CVehicle')) {
        if (!DoesEntityExist(vehicle)) continue;
        if (AGM.util.dist(coords, GetEntityCoords(vehicle, true)) > 30.0) continue;

        const netId = NetworkGetNetworkIdFromEntity(vehicle);
        const state = AGM.state.get(netId);
        if (state) AGM.perf.apply(vehicle, state);
    }
});

/* A dead-critical vehicle should not silently restart itself. */
setTick(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const ped = PlayerPedId();
    const vehicle = GetVehiclePedIsIn(ped, false);
    if (!vehicle || GetPedInVehicleSeat(vehicle, -1) !== ped) return;

    const state = AGM.state.get(NetworkGetNetworkIdFromEntity(vehicle));
    if (!state || !state.driveability) return;
    if (state.driveability.drivable) return;

    const modes = state.driveability.modes || [];
    if (modes.includes('nostart') && GetIsVehicleEngineRunning(vehicle)) {
        SetVehicleEngineOn(vehicle, false, true, true);
    }
});

/* --------------------------------------------------------------- debug helper */

RegisterCommand('agmechanic_debug', async () => {
    if (!AGM.Config.debug) {
        AGM.ui.notify('Set Config.debug to true first.', 'error');
        return;
    }

    const vehicle = AGM.state.nearestVehicle(8.0);
    if (!vehicle) return AGM.ui.notify('No vehicle nearby.', 'error');

    const info = AGM.state.describe(vehicle);
    if (!info) return AGM.ui.notify('Unsupported vehicle class.', 'error');

    const state = await AGM.state.fetch(info);
    AGM.log.info('vehicle', info.plate, info.blueprint, JSON.stringify(state && state.health));
    AGM.log.info('performance', JSON.stringify(state && state.performance));
    AGM.log.info('driveability', JSON.stringify(state && state.driveability));
    AGM.ui.notify('Dumped to the console (F8).', 'inform');
}, false);
