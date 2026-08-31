/*
 * ag_mechanic - client entry point
 * ============================================================================
 * Boot, teardown and the couple of loops that do not belong to a subsystem.
 * ============================================================================
 */

let ag_mechanic_main_started = false;

/*
 * Every file in the manifest is evaluated into one shared scope, so a config
 * file that never loaded - missing from disk, dropped from fxmanifest.lua, or
 * killed by an earlier error - leaves a hole that only surfaces as "cannot read
 * properties of undefined" somewhere unrelated. Name the missing file instead.
 */
const ag_mechanic_main_configFiles = {
    Config: 'config/config.js',
    Classes: 'config/classes.js',
    Components: 'config/components.js',
    Tiers: 'config/tiers.js',
    Dtc: 'config/dtc.js',
    Damage: 'config/damage.js',
    Handling: 'config/handling.js',
    Shop: 'config/shop.js',
    Locations: 'config/locations.js',
    util: 'shared/util.js',
    Health: 'shared/health.js',
};

function ag_mechanic_main_requireConfig() {
    const missing = Object.keys(ag_mechanic_main_configFiles)
        .filter((key) => !AGM[key])
        .map((key) => `AGM.${key} (${ag_mechanic_main_configFiles[key]})`);
    if (!missing.length) return;
    throw new Error(
        `shared config did not load: ${missing.join(', ')} - check that the file is on disk, `
        + 'is listed in fxmanifest.lua shared_scripts, and did not throw earlier in this console',
    );
}

async function boot() {
    if (ag_mechanic_main_started) return;
    ag_mechanic_main_started = true;

    ag_mechanic_main_requireConfig();

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
