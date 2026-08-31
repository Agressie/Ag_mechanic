/*
 * ag_mechanic - tablet (client)
 * ============================================================================
 * Opens the NUI tablet, with a phone-style animation so it looks like the player
 * is actually holding something. Access is decided by the server; this file only
 * asks and reacts.
 * ============================================================================
 */

AGM.tablet = {};

let animating = false;

const TABLET_ANIM = { dict: 'amb@world_human_seat_wall_tablet@female@base', clip: 'base' };
const TABLET_PROP = 'prop_cs_tablet';

async function loadAnim(dict) {
    RequestAnimDict(dict);
    const deadline = GetGameTimer() + 3000;
    while (!HasAnimDictLoaded(dict) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HasAnimDictLoaded(dict);
}

let propEntity = 0;

async function holdTablet() {
    if (animating) return;
    animating = true;

    const ped = PlayerPedId();
    if (await loadAnim(TABLET_ANIM.dict)) {
        TaskPlayAnim(ped, TABLET_ANIM.dict, TABLET_ANIM.clip, 3.0, -1, -1, 49, 0, false, false, false);
    }

    const hash = GetHashKey(TABLET_PROP);
    RequestModel(hash);
    const deadline = GetGameTimer() + 3000;
    while (!HasModelLoaded(hash) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (HasModelLoaded(hash)) {
        const coords = GetEntityCoords(ped, true);
        propEntity = CreateObject(hash, coords[0], coords[1], coords[2], true, true, false);
        AttachEntityToEntity(propEntity, ped, GetPedBoneIndex(ped, 60309), 0.03, 0.002, -0.02, 10.0, 170.0, 0.0, true, true, false, true, 1, true);
        SetModelAsNoLongerNeeded(hash);
    }
}

function stowTablet() {
    animating = false;
    if (propEntity && DoesEntityExist(propEntity)) {
        DeleteEntity(propEntity);
    }
    propEntity = 0;
    ClearPedTasks(PlayerPedId());
}

/** Opens the tablet on `app`. */
AGM.tablet.open = async function (app = 'home') {
    if (AGM.nui.open) return;

    const session = await AGM.rpc.call('tablet:open', {});
    if (!session || !session.ok) {
        const reason = session && session.reason;
        if (reason === 'noItem') {
            AGM.ui.notify(AGM.util.fmt(AGM.Config.locale.noItem, session.itemLabel || 'a tablet'), 'error');
        } else {
            AGM.ui.notify(AGM.Config.locale.tabletNoAccess, 'error');
        }
        return;
    }

    session.startApp = app;

    await holdTablet();
    AGM.nui.show('tablet', session);
};

AGM.tablet.close = function () {
    AGM.nui.close();
};

/* Stow the prop whenever the page closes, however it closed. */
on('ag_mechanic:internal:nuiAction', (action) => {
    if (action === 'tabletClosed') stowTablet();
});

const originalClose = AGM.nui.close;
AGM.nui.close = function (silent) {
    const wasTablet = AGM.nui.screen === 'tablet';
    originalClose.call(AGM.nui, silent);
    if (wasTablet) stowTablet();
};

/* ------------------------------------------------------------------ entry points */

RegisterCommand(AGM.Config.tablet.command, () => {
    AGM.tablet.open('home');
}, false);

if (AGM.Config.tablet.keybind) {
    RegisterKeyMapping(AGM.Config.tablet.command, 'Open the mechanic tablet', 'keyboard', AGM.Config.tablet.keybind);
}

/*
 * Item-use entry points.
 *
 * ox_inventory calls a client export (`client = { export = 'ag_mechanic.useX' }`);
 * qb-inventory triggers a client event. Both are wired up, so whichever
 * inventory is running, using the item does the obvious thing.
 */
exports('useTablet', () => AGM.tablet.open('home'));

/* One export for all three tools - the vehicle decides which is valid. */
exports('useScanner', () => {
    const vehicle = AGM.state.nearestVehicle(6.0);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    AGM.scanner.run(vehicle);
});

exports('useImprovised', () => {
    const vehicle = AGM.state.nearestVehicle(6.0);
    if (!vehicle) return AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
    emit('ag_mechanic:client:targetField', { entity: vehicle });
});

onNet('ag_mechanic:client:useTablet', () => AGM.tablet.open('home'));

on('onResourceStop', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    stowTablet();
});
