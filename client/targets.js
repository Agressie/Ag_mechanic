/*
 * ag_mechanic - world interactions
 * ============================================================================
 * All ox_target registration. Options carry event *names* rather than callbacks,
 * because a JavaScript function cannot be handed to ox_target's Lua runtime.
 *
 * Job restrictions are declared with `groups` so the option is hidden from
 * people who do not work here, and re-checked in the handler, because a hidden
 * option is a courtesy and not a security boundary.
 * ============================================================================
 */

AGM.targets = {};

function oxTarget(fn, ...args) {
    try {
        if (!exports.ox_target || typeof exports.ox_target[fn] !== 'function') {
            AGM.log.error(`ox_target.${fn} is unavailable - is ox_target started?`);
            return null;
        }
        return exports.ox_target[fn](...args);
    } catch (err) {
        AGM.log.error(`ox_target.${fn} failed:`, err && err.message);
        return null;
    }
}

const JOB_GROUP = { [AGM.Config.job.name]: 0 };

/*
 * Zones go through the Lua bridge rather than being created here: ox_lib's zone
 * maths operates on real vector3 values and the JavaScript runtime has no
 * vector type to give it. Option tables carry no coordinates, so global-vehicle
 * options are registered from JS directly.
 */
function addSphereZone(data) {
    emit('ag_mechanic:lua:addSphereZone', JSON.stringify(data));
}

const blips = [];

/* --------------------------------------------------------------- vehicle menu */

AGM.targets.registerVehicles = function () {
    oxTarget('addGlobalVehicle', [
        {
            name: 'ag_mechanic_diagnose',
            label: 'Inspect the vehicle by hand',
            icon: 'fa-solid fa-stethoscope',
            distance: 2.5,
            bones: ['bonnet', 'engine'],
            event: 'ag_mechanic:client:targetDiagnose',
        },
        {
            name: 'ag_mechanic_scan',
            label: 'Plug in a diagnostic scanner',
            icon: 'fa-solid fa-plug-circle-bolt',
            distance: 2.5,
            items: AGM.Dtc.deviceItems(),
            anyItem: true,
            event: 'ag_mechanic:client:targetScan',
        },
        {
            name: 'ag_mechanic_report',
            label: 'Read the diagnostic report',
            icon: 'fa-solid fa-clipboard-list',
            distance: 2.5,
            event: 'ag_mechanic:client:targetReport',
        },
        {
            name: 'ag_mechanic_field',
            label: 'Patch something up',
            icon: 'fa-solid fa-tape',
            distance: 2.5,
            items: AGM.Config.repair.improvisedItems,
            anyItem: true,
            event: 'ag_mechanic:client:targetField',
        },
        {
            name: 'ag_mechanic_triage',
            label: 'Can this be fixed here?',
            icon: 'fa-solid fa-truck-ramp-box',
            distance: 3.0,
            event: 'ag_mechanic:client:targetTriage',
        },
        {
            name: 'ag_mechanic_service',
            label: 'Work through the job list',
            icon: 'fa-solid fa-screwdriver-wrench',
            distance: 3.0,
            groups: JOB_GROUP,
            items: AGM.Config.repair.toolItem ? [AGM.Config.repair.toolItem] : undefined,
            event: 'ag_mechanic:client:targetService',
        },
        {
            name: 'ag_mechanic_upgrades',
            label: 'Fit performance parts',
            icon: 'fa-solid fa-gauge-high',
            distance: 3.0,
            groups: JOB_GROUP,
            items: AGM.Config.repair.toolItem ? [AGM.Config.repair.toolItem] : undefined,
            event: 'ag_mechanic:client:targetUpgrades',
        },
    ]);
};

/* ------------------------------------------------------------------ shop zones */

AGM.targets.registerShops = function () {
    const shop = AGM.Locations.shop;

    for (const lift of shop.lifts || []) {
        addSphereZone({
            coords: lift.coords,
            radius: lift.radius || 5.0,
            debug: AGM.Config.debug,
            options: [{
                name: `ag_mechanic_lift_${lift.bay}`,
                label: `Work on whatever is on ${lift.bay}`,
                icon: 'fa-solid fa-car-on',
                distance: lift.radius || 5.0,
                groups: JOB_GROUP,
                event: 'ag_mechanic:client:targetLift',
            }],
        });
    }

    if (shop.stash && shop.stash.point) {
        addSphereZone({
            coords: shop.stash.point.coords,
            radius: shop.stash.point.radius || 1.4,
            debug: AGM.Config.debug,
            options: [{
                name: 'ag_mechanic_stash',
                label: shop.stash.label,
                icon: 'fa-solid fa-boxes-stacked',
                distance: 2.0,
                groups: JOB_GROUP,
                event: 'ag_mechanic:client:targetStash',
            }, {
                name: 'ag_mechanic_tablet',
                label: 'Shop tablet',
                icon: 'fa-solid fa-tablet-screen-button',
                distance: 2.0,
                groups: JOB_GROUP,
                event: 'ag_mechanic:client:targetTablet',
            }],
        });
    }

    if (shop.duty) {
        addSphereZone({
            coords: shop.duty.coords,
            radius: shop.duty.radius || 1.2,
            debug: AGM.Config.debug,
            options: [{
                name: 'ag_mechanic_duty',
                label: 'Clock on / off',
                icon: 'fa-solid fa-clipboard-user',
                distance: 2.0,
                groups: JOB_GROUP,
                event: 'ag_mechanic:client:targetDuty',
            }],
        });
    }

    if (shop.blip) addBlip(shop);
};

/** Map blip at the shop's front door. */
function addBlip(shop) {
    const anchor = (shop.stash && shop.stash.point && shop.stash.point.coords)
        || (shop.bays && shop.bays[0] && shop.bays[0].coords);
    if (!anchor) return;

    const blip = AddBlipForCoord(anchor[0], anchor[1], anchor[2]);
    SetBlipSprite(blip, shop.blip.sprite);
    SetBlipColour(blip, shop.blip.colour);
    SetBlipScale(blip, shop.blip.scale);
    SetBlipAsShortRange(blip, true);
    BeginTextCommandSetBlipName('STRING');
    AddTextComponentSubstringPlayerName(shop.blip.label || shop.label);
    EndTextCommandSetBlipName(blip);
    blips.push(blip);
}

AGM.targets.remove = function () {
    emit('ag_mechanic:lua:removeZones');
    for (const blip of blips) RemoveBlip(blip);
    blips.length = 0;
    oxTarget('removeGlobalVehicle', [
        'ag_mechanic_diagnose', 'ag_mechanic_scan', 'ag_mechanic_report',
        'ag_mechanic_field', 'ag_mechanic_triage', 'ag_mechanic_service',
        'ag_mechanic_upgrades',
    ]);
};

/* ------------------------------------------------------------------- handlers */

function entityFrom(data) {
    const entity = data && data.entity ? data.entity : 0;
    if (entity && DoesEntityExist(entity)) return entity;
    return AGM.state.nearestVehicle(6.0);
}

/** Vehicle sitting in one of the shop's bays, nearest to the player. */
function vehicleInBay() {
    const shop = AGM.Locations.shop;

    const ped = PlayerPedId();
    const origin = GetEntityCoords(ped, true);
    let best = 0;
    let bestDistance = Infinity;

    for (const bay of shop.bays || []) {
        const found = GetClosestVehicle(bay.coords[0], bay.coords[1], bay.coords[2], Math.max(bay.size[0], bay.size[1]) / 2 + 2, 0, 71);
        if (!found || !DoesEntityExist(found)) continue;
        const distance = AGM.util.dist(origin, GetEntityCoords(found, true));
        if (distance < bestDistance) {
            best = found;
            bestDistance = distance;
        }
    }
    return best;
}

onNet('ag_mechanic:client:targetDiagnose', (data) => {
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.diagnose.run(vehicle);
});

onNet('ag_mechanic:client:targetReport', (data) => {
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.diagnose.showLast(vehicle);
});

onNet('ag_mechanic:client:targetField', async (data) => {
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');

    const info = AGM.state.describe(vehicle);
    if (!info) return;

    const response = await AGM.rpc.call('diagnose:last', AGM.state.args(info));
    if (!response || !response.ok) {
        AGM.ui.notify(AGM.Config.locale.diagnoseFirst, 'error');
        return;
    }
    AGM.state.setReport(response.vehicleKey, response.report);
    AGM.nui.show('report', {
        report: response.report,
        canRepair: true,
        isMechanic: AGM.state.isMechanic(),
        focus: 'field',
    }, { vehicle: info });
});

onNet('ag_mechanic:client:targetTriage', (data) => {
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.repair.triage(vehicle);
});

onNet('ag_mechanic:client:targetService', async (data) => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    await AGM.repair.fullService(AGM.state.describe(vehicle));
});

onNet('ag_mechanic:client:targetUpgrades', (data) => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');
    const vehicle = entityFrom(data);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.upgrades.open(vehicle);
});

onNet('ag_mechanic:client:targetLift', async () => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');

    const vehicle = vehicleInBay();
    if (!vehicle) return AGM.ui.notify('There is nothing on that lift.', 'error');

    /* On a lift, go straight to the report if there is one, otherwise diagnose. */
    const report = await AGM.diagnose.showLast(vehicle);
    if (!report) await AGM.diagnose.run(vehicle);
});

onNet('ag_mechanic:client:targetStash', async () => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');
    const result = await AGM.rpc.call('shop:stashOpen', {});
    if (!result || !result.ok) {
        /* No native stash: fall back to the tablet's own view. */
        AGM.tablet.open('inventory');
    }
});

onNet('ag_mechanic:client:targetTablet', () => {
    AGM.tablet.open('home');
});

onNet('ag_mechanic:client:targetDuty', () => {
    if (!AGM.state.isMechanic()) return AGM.ui.notify(AGM.Config.locale.noJob, 'error');
    /* qbx_core keeps the QBCore event name for duty toggling. */
    emitNet('QBCore:ToggleDuty');
});
