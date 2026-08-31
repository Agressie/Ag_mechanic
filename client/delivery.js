/*
 * ag_mechanic - parts delivery scenario (client)
 * ============================================================================
 * The host client drives the whole thing: spawn the van and driver as networked
 * entities so everyone sees them, drive the route, carry a pallet out, set it
 * down, produce a clipboard, wait to be signed, then leave - or, if nobody
 * signs in time, load the pallet back up and drive back the way it came.
 *
 * While the van is sitting there waiting it is swapped for a frozen static
 * object (same model, same spot) so nobody can climb in and drive off with the
 * shop's delivery. It is swapped back for a real, driveable vehicle the moment
 * the driver needs to leave - if that swap fails for any reason, the crate and
 * the driver are despawned rather than leaving a stuck scene behind.
 *
 * Every entity is tracked in `spawned` and torn down through cleanup(), which is
 * called on success, on abort, on error and on resource stop. A delivery van
 * left parked across the shop door forever is worse than no scenario at all.
 * ============================================================================
 */

AGM.deliveryScene = {};

let scene = null;

/* ------------------------------------------------------------------- helpers */

/*
 * The configured spawn Z is a guess, and a guess that lands below the road
 * buries the van: the ped inside still spawns, screams and blocks traffic
 * while the van itself is invisible under the tarmac. Ask the game where the
 * ground actually is - collision has to be streamed in first, which it is not
 * for an off-screen spawn until we request it - and fall back to the config
 * if it still will not answer.
 */
async function ag_mechanic_delivery_groundAt(coords) {
    const [x, y, z] = coords;
    RequestCollisionAtCoord(x, y, z);
    for (let i = 0; i < 30; i += 1) {
        const [hit, groundZ] = GetGroundZFor_3dCoord(x, y, z + 5.0, false);
        if (hit) return [x, y, groundZ + 1.0];
        await wait(50);
    }
    AGM.log.warn('no ground found under the delivery spawn', JSON.stringify(coords),
        '- using the configured height as-is');
    return [x, y, z];
}

async function ag_mechanic_delivery_loadModel(model) {
    const hash = typeof model === 'string' ? GetHashKey(model) : model;
    if (!IsModelInCdimage(hash) || !IsModelValid(hash)) return null;

    RequestModel(hash);
    const deadline = GetGameTimer() + 10000;
    while (!HasModelLoaded(hash) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HasModelLoaded(hash) ? hash : null;
}

async function ag_mechanic_delivery_loadAnim(dict) {
    RequestAnimDict(dict);
    const deadline = GetGameTimer() + 5000;
    while (!HasAnimDictLoaded(dict) && GetGameTimer() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HasAnimDictLoaded(dict);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for `check()` to return true, or gives up. */
async function waitFor(check, timeoutMs, step = 250) {
    const deadline = GetGameTimer() + timeoutMs;
    while (GetGameTimer() < deadline) {
        if (!scene || scene.aborted) return false;
        if (check()) return true;
        await wait(step);
    }
    return false;
}

function track(entity) {
    if (entity && DoesEntityExist(entity)) scene.spawned.push(entity);
    return entity;
}

function untrack(entity) {
    if (!scene) return;
    const idx = scene.spawned.indexOf(entity);
    if (idx !== -1) scene.spawned.splice(idx, 1);
}

function phase(name) {
    if (!scene || scene.aborted) return;
    scene.phase = name;
    emitNet('ag_mechanic:server:deliveryPhase', { phase: name });
}

/** A couple of horn taps to let the shop know the van has arrived. */
async function honkHorn(van, cfg) {
    if (!scene || scene.aborted || !van || !DoesEntityExist(van)) return;
    const count = Math.max(1, (cfg && cfg.count) || 2);
    const onMs = (cfg && cfg.onMs) || 350;
    const gapMs = (cfg && cfg.gapMs) || 450;
    for (let i = 0; i < count; i++) {
        if (!scene || scene.aborted || !DoesEntityExist(van)) return;
        StartVehicleHorn(van, onMs, 0, false);
        await wait(onMs + gapMs);
    }
}

/* ------------------------------------------------------------------- cleanup */

function cleanup(keepBox = false) {
    if (!scene) return;
    const box = scene.box;

    for (const entity of scene.spawned) {
        if (keepBox && entity === box) continue;
        if (!DoesEntityExist(entity)) continue;
        if (IsEntityAPed(entity)) {
            ClearPedTasksImmediately(entity);
            DeletePed(entity);
        } else if (IsEntityAVehicle(entity)) {
            DeleteVehicle(entity);
        } else {
            DeleteEntity(entity);
        }
    }

    if (scene.targetId) {
        try {
            exports.ox_target.removeLocalEntity(scene.driver, ['ag_mechanic_sign']);
        } catch (_) { /* the ped may already be gone */ }
    }
    if (scene.boxTargetId) {
        try {
            exports.ox_target.removeZone(scene.boxTargetId);
        } catch (_) { /* nothing to remove */ }
    }

    scene = null;
}

AGM.deliveryScene.abort = function () {
    if (!scene) return;
    scene.aborted = true;
    cleanup(false);
};

/* ---------------------------------------------------------- van lock/unlock */

/**
 * Swaps the parked van for a frozen static object of the same model, in the
 * same spot, so nobody can climb in and drive off with it while the driver is
 * stood around waiting for a signature. `restoreVanAsVehicle` swaps it back.
 */
async function lockVanAsObject() {
    if (!scene || scene.aborted) return;
    const van = scene.van;
    if (!van || !DoesEntityExist(van)) return;

    const coords = GetEntityCoords(van, true);
    const heading = GetEntityHeading(van);
    const model = GetEntityModel(van);

    const obj = CreateObject(model, coords[0], coords[1], coords[2], true, true, false);
    if (!obj || !DoesEntityExist(obj)) return;

    SetEntityHeading(obj, heading);
    PlaceObjectOnGroundProperly(obj);
    FreezeEntityPosition(obj, true);
    SetEntityCollision(obj, true, true);
    SetEntityInvincible(obj, true);

    untrack(van);
    scene.spawned.push(obj);
    DeleteVehicle(van);

    scene.vanObject = obj;
    scene.vanModel = model;
    scene.vanCoords = coords;
    scene.vanHeading = heading;
    scene.van = 0;
}

/** Swaps the parked prop back for a driveable van. False if it could not. */
async function restoreVanAsVehicle() {
    if (!scene || scene.aborted) return false;
    if (scene.van && DoesEntityExist(scene.van)) return true; /* was never locked */
    if (!scene.vanModel || !scene.vanCoords) return false;

    const loaded = await ag_mechanic_delivery_loadModel(scene.vanModel);
    if (!loaded) return false;

    const coords = scene.vanCoords;
    const van = CreateVehicle(loaded, coords[0], coords[1], coords[2], scene.vanHeading || 0.0, true, false);
    if (!van || !DoesEntityExist(van)) return false;

    SetVehicleOnGroundProperly(van);
    SetEntityAsMissionEntity(van, true, true);
    SetModelAsNoLongerNeeded(loaded);

    if (scene.vanObject && DoesEntityExist(scene.vanObject)) {
        untrack(scene.vanObject);
        DeleteEntity(scene.vanObject);
    }
    scene.vanObject = 0;

    scene.spawned.push(van);
    scene.van = van;
    return true;
}

/* --------------------------------------------------------------------- driver */

/** Puts the ox_target option on the driver so the paperwork can be signed. */
function addSignTarget(driver) {
    try {
        exports.ox_target.addLocalEntity(driver, [{
            name: 'ag_mechanic_sign',
            label: 'Sign for the delivery',
            icon: 'fa-solid fa-file-signature',
            distance: 2.5,
            event: 'ag_mechanic:client:signDelivery',
        }]);
        scene.targetId = true;
    } catch (err) {
        AGM.log.error('could not add the signing target:', err && err.message);
    }
}

function removeSignTarget(driver) {
    if (!scene || !scene.targetId) return;
    try {
        exports.ox_target.removeLocalEntity(driver, ['ag_mechanic_sign']);
    } catch (_) { /* already gone */ }
    scene.targetId = false;
}

/** Drops a pallet in front of the shop and leaves it there to be picked up. */
async function unload(driver, route, props, anims) {
    phase('unloading');

    const boxHash = await ag_mechanic_delivery_loadModel(props.boxProp);
    const carryLoaded = await ag_mechanic_delivery_loadAnim(anims.carryBox.dict);

    /* Walk round to the back of the van. */
    const van = scene.van;
    const rear = GetOffsetFromEntityInWorldCoords(van, 0.0, -3.2, 0.0);
    TaskGoStraightToCoord(driver, rear[0], rear[1], rear[2], 1.0, 6000, GetEntityHeading(van), 0.5);
    await waitFor(() => AGM.util.dist(GetEntityCoords(driver, true), rear) < 1.6, 8000);
    if (!scene || scene.aborted) return;

    SetVehicleDoorOpen(van, 2, false, false);
    SetVehicleDoorOpen(van, 3, false, false);
    await wait(800);

    /* Pick the pallet up. */
    let box = 0;
    if (boxHash) {
        const coords = GetEntityCoords(driver, true);
        box = track(CreateObject(boxHash, coords[0], coords[1], coords[2], true, true, false));
        SetEntityCollision(box, false, false);
        AttachEntityToEntity(box, driver, GetPedBoneIndex(driver, 60309), 0.05, 0.12, 0.25, 0.0, 0.0, 0.0, false, false, false, false, 2, true);
    }
    if (carryLoaded) {
        TaskPlayAnim(driver, anims.carryBox.dict, anims.carryBox.clip, 8.0, -8.0, -1, 49, 0, false, false, false);
    }

    /* Carry it to the drop point. */
    const drop = route.drop.coords;
    TaskGoStraightToCoord(driver, drop[0], drop[1], drop[2], 1.0, 20000, route.drop.heading, 0.5);
    await waitFor(() => AGM.util.dist(GetEntityCoords(driver, true), drop) < 1.8, 22000);
    if (!scene || scene.aborted) return;

    ClearPedTasks(driver);
    await wait(400);

    /* Set it down. */
    if (box && DoesEntityExist(box)) {
        DetachEntity(box, true, true);
        SetEntityCoordsNoOffset(box, drop[0], drop[1], drop[2] - 0.95, false, false, false);
        SetEntityHeading(box, route.drop.heading || 0.0);
        SetEntityCollision(box, true, true);
        PlaceObjectOnGroundProperly(box);
        FreezeEntityPosition(box, true);
        scene.box = box;
    }

    if (await ag_mechanic_delivery_loadAnim(anims.putDown.dict)) {
        TaskPlayAnim(driver, anims.putDown.dict, anims.putDown.clip, 8.0, -8.0, 1200, 0, 0, false, false, false);
        await wait(1400);
    }

    SetVehicleDoorShut(van, 2, false);
    SetVehicleDoorShut(van, 3, false);
}

/** Driver stands with the clipboard, waiting for a signature. */
async function awaitSignature(driver, route, props, anims) {
    phase('waiting');

    const sign = route.sign;
    TaskGoStraightToCoord(driver, sign.coords[0], sign.coords[1], sign.coords[2], 1.0, 10000, sign.heading, 0.4);
    await waitFor(() => AGM.util.dist(GetEntityCoords(driver, true), sign.coords) < 1.6, 12000);
    if (!scene || scene.aborted) return;

    ClearPedTasks(driver);
    SetEntityHeading(driver, sign.heading || GetEntityHeading(driver));
    FreezeEntityPosition(driver, true);

    const clipHash = await ag_mechanic_delivery_loadModel(props.clipboardProp);
    if (clipHash) {
        const coords = GetEntityCoords(driver, true);
        const clipboard = track(CreateObject(clipHash, coords[0], coords[1], coords[2], true, true, false));
        AttachEntityToEntity(clipboard, driver, GetPedBoneIndex(driver, 36029), 0.16, 0.08, 0.02, -130.0, -50.0, 0.0, true, true, false, true, 1, true);
        scene.clipboard = clipboard;
    }

    if (await ag_mechanic_delivery_loadAnim(anims.clipboard.dict)) {
        TaskPlayAnim(driver, anims.clipboard.dict, anims.clipboard.clip, 4.0, -4.0, -1, 49, 0, false, false, false);
    }

    addSignTarget(driver);
    AGM.ui.notify('The driver needs a signature before they can leave.', 'inform', 'Delivery');

    /* Held here until the server says it is signed, or times it out. */
    await waitFor(() => scene && (scene.signed || scene.wrapUp), AGM.Shop.delivery.signTimeout + 30000, 400);
}

/** Clears the clipboard/sign target once the wait is over, whichever way. */
function clearWaitingProps(driver) {
    if (!scene) return;
    if (scene.clipboard && DoesEntityExist(scene.clipboard)) {
        DeleteEntity(scene.clipboard);
        untrack(scene.clipboard);
    }
    scene.clipboard = 0;
    removeSignTarget(driver);
}

/** Signed for: driver gets back in and leaves; the pallet stays where it was put. */
async function departure(driver, route) {
    phase('leaving');
    if (!scene || scene.aborted) return;

    clearWaitingProps(driver);
    FreezeEntityPosition(driver, false);
    ClearPedTasks(driver);

    const restored = await restoreVanAsVehicle();
    if (!restored) {
        AGM.log.warn('could not bring the delivery van back to drive off - despawning what is left');
        phase('done');
        cleanup(false);
        return;
    }

    const van = scene.van;
    if (DoesEntityExist(van)) {
        TaskEnterVehicle(driver, van, 12000, -1, 1.0, 1, 0);
        await waitFor(() => GetVehiclePedIsIn(driver, false) === van, 14000);

        if (scene && !scene.aborted && DoesEntityExist(van)) {
            SetVehicleEngineOn(van, true, true, false);
            const exitCoords = route.exit.coords;
            TaskVehicleDriveToCoordLongrange(driver, van, exitCoords[0], exitCoords[1], exitCoords[2], 18.0, 786603, 12.0);
            await waitFor(() => AGM.util.dist(GetEntityCoords(van, true), exitCoords) < 25.0, 45000);
        }
    }

    phase('done');
    cleanup(true);
}

/** Not signed in time: the driver loads the pallet back up and heads home. */
async function returnToDepot(driver, route, anims) {
    phase('returning');
    if (!scene || scene.aborted) return;

    clearWaitingProps(driver);
    FreezeEntityPosition(driver, false);
    ClearPedTasks(driver);

    const restored = await restoreVanAsVehicle();
    if (!restored) {
        AGM.log.warn('could not bring the delivery van back to load up - despawning what is left');
        phase('done');
        cleanup(false);
        return;
    }

    const van = scene.van;

    /* Walk back to the pallet and pick it up, if it ever got dropped. */
    if (scene.box && DoesEntityExist(scene.box)) {
        const boxCoords = GetEntityCoords(scene.box, true);
        TaskGoStraightToCoord(driver, boxCoords[0], boxCoords[1], boxCoords[2], 1.0, 8000, GetEntityHeading(driver), 0.5);
        await waitFor(() => AGM.util.dist(GetEntityCoords(driver, true), boxCoords) < 1.8, 10000);
        if (!scene || scene.aborted) return;

        if (await ag_mechanic_delivery_loadAnim(anims.putDown.dict)) {
            TaskPlayAnim(driver, anims.putDown.dict, anims.putDown.clip, 8.0, -8.0, 1200, 0, 0, false, false, false);
            await wait(1200);
        }

        FreezeEntityPosition(scene.box, false);
        SetEntityCollision(scene.box, false, false);
        AttachEntityToEntity(scene.box, driver, GetPedBoneIndex(driver, 60309), 0.05, 0.12, 0.25, 0.0, 0.0, 0.0, false, false, false, false, 2, true);

        if (await ag_mechanic_delivery_loadAnim(anims.carryBox.dict)) {
            TaskPlayAnim(driver, anims.carryBox.dict, anims.carryBox.clip, 8.0, -8.0, -1, 49, 0, false, false, false);
        }
    }

    /* Carry it back to the van and load it. */
    if (DoesEntityExist(van)) {
        const rear = GetOffsetFromEntityInWorldCoords(van, 0.0, -3.2, 0.0);
        TaskGoStraightToCoord(driver, rear[0], rear[1], rear[2], 1.0, 8000, GetEntityHeading(van), 0.5);
        await waitFor(() => AGM.util.dist(GetEntityCoords(driver, true), rear) < 1.8, 10000);
        if (!scene || scene.aborted) return;

        SetVehicleDoorOpen(van, 2, false, false);
        SetVehicleDoorOpen(van, 3, false, false);
        await wait(500);
    }

    ClearPedTasks(driver);
    if (scene.box && DoesEntityExist(scene.box)) {
        DeleteEntity(scene.box);
        untrack(scene.box);
    }
    scene.box = 0;

    if (DoesEntityExist(van)) {
        SetVehicleDoorShut(van, 2, false);
        SetVehicleDoorShut(van, 3, false);
    }

    /* Drive back to where it came from and despawn - taking the parts with it. */
    if (DoesEntityExist(van)) {
        TaskEnterVehicle(driver, van, 12000, -1, 1.0, 1, 0);
        await waitFor(() => GetVehiclePedIsIn(driver, false) === van, 14000);

        if (scene && !scene.aborted && DoesEntityExist(van)) {
            SetVehicleEngineOn(van, true, true, false);
            const home = route.spawn.coords;
            TaskVehicleDriveToCoordLongrange(driver, van, home[0], home[1], home[2], 18.0, 786603, 12.0);
            await waitFor(() => AGM.util.dist(GetEntityCoords(van, true), home) < 25.0, 45000);
        }
    }

    phase('done');
    cleanup(false);
}

/* ---------------------------------------------------------------------- entry */

onNet('ag_mechanic:client:deliveryStart', async (payload) => {
    if (scene) {
        AGM.log.warn('a delivery scenario is already running on this client');
        return;
    }

    scene = {
        orderId: payload.orderId,
        lines: payload.lines || [],
        spawned: [],
        van: 0,
        vanObject: 0,
        vanModel: 0,
        vanCoords: null,
        vanHeading: 0,
        driver: 0,
        box: 0,
        clipboard: 0,
        phase: 'driving',
        signed: false,
        wrapUp: false,
        aborted: false,
        targetId: false,
    };

    const route = payload.route;
    const anims = payload.anims;

    try {
        const vanHash = await ag_mechanic_delivery_loadModel(AGM.util.pick(payload.vehicles));
        const pedHash = await ag_mechanic_delivery_loadModel(AGM.util.pick(payload.driverModels));
        if (!vanHash || !pedHash) {
            AGM.log.error('delivery models would not load - aborting');
            cleanup(false);
            return;
        }

        const spawn = route.spawn;
        const [spawnX, spawnY, spawnZ] = await ag_mechanic_delivery_groundAt(spawn.coords);
        const van = track(CreateVehicle(vanHash, spawnX, spawnY, spawnZ, spawn.heading, true, false));
        if (!van || !DoesEntityExist(van)) {
            AGM.log.error('delivery van could not be created at', JSON.stringify(spawn.coords));
            cleanup(false);
            return;
        }
        scene.van = van;
        SetVehicleOnGroundProperly(van);
        SetEntityAsMissionEntity(van, true, true);
        SetVehicleEngineOn(van, true, true, false);

        /* The vehicle needs a frame to register before a ped can be put in it.
           Skip this and CreatePedInsideVehicle hands back 0, which is worse than
           it sounds: every task below silently no-ops, so the van sits at the
           spawn point with its engine running while each waitFor times out and
           the phases march on regardless. */
        await wait(100);

        const driver = track(CreatePedInsideVehicle(van, 4, pedHash, -1, true, false));
        if (!driver || !DoesEntityExist(driver)) {
            AGM.log.error('delivery driver could not be created - nobody to drive the van');
            cleanup(false);
            return;
        }
        scene.driver = driver;
        SetEntityAsMissionEntity(driver, true, true);
        SetBlockingOfNonTemporaryEvents(driver, true);
        SetPedCanBeDraggedOut(driver, false);
        SetDriverAbility(driver, 1.0);
        SetDriverAggressiveness(driver, 0.0);

        SetModelAsNoLongerNeeded(vanHash);
        SetModelAsNoLongerNeeded(pedHash);

        /* Drive the route, waypoint by waypoint, then park. */
        phase('driving');
        for (const point of route.route || []) {
            if (!scene || scene.aborted) return;
            /* A van that has stopped existing reports its position as [0,0,0],
               and every waypoint after that burns its full timeout for nothing.
               Something else deleted it - an entity cleanup script, or OneSync
               entity lockdown refusing a client-created vehicle - so give up
               and say why rather than driving a ghost around for two minutes. */
            if (!DoesEntityExist(van)) {
                AGM.log.error('the delivery van was deleted by something outside this resource -',
                    'check sv_entityLockdown and any vehicle cleanup script on your server');
                cleanup(false);
                return;
            }
            TaskVehicleDriveToCoordLongrange(driver, van, point[0], point[1], point[2], payload.approachSpeed + 6, 786603, 10.0);
            const reached = await waitFor(() => AGM.util.dist(GetEntityCoords(van, true), point) < 14.0, 40000);
            if (!reached) {
                AGM.log.warn('delivery van never reached waypoint', JSON.stringify(point),
                    '- check it is on a road node. Van is at', JSON.stringify(GetEntityCoords(van, true)));
            }
        }

        if (!scene || scene.aborted) return;
        phase('parking');
        const park = route.park;
        TaskVehicleDriveToCoord(driver, van, park.coords[0], park.coords[1], park.coords[2], payload.approachSpeed, 0, GetEntityModel(van), 786603, 3.0, true);
        const parked = await waitFor(() => AGM.util.dist(GetEntityCoords(van, true), park.coords) < 6.0, 45000);

        if (!scene || scene.aborted) return;
        if (!parked) {
            AGM.log.warn('delivery van could not reach the parking mark - unloading where it stopped.',
                'Van is at', JSON.stringify(GetEntityCoords(van, true)));
        }

        TaskVehicleTempAction(driver, van, 27, 2000);
        await wait(1200);
        await honkHorn(van, payload.honk);
        SetVehicleEngineOn(van, false, true, true);

        TaskLeaveVehicle(driver, van, 0);
        await waitFor(() => !IsPedInVehicle(driver, van, false), 8000);
        if (!scene || scene.aborted) return;

        AGM.ui.notify(AGM.Config.locale.deliveryArrived, 'inform', 'Delivery');

        await unload(driver, route, payload, anims);
        if (!scene || scene.aborted) return;

        /* Lock the van up while the driver stands around waiting to be signed
           for, so nobody can climb in and take it. */
        await lockVanAsObject();
        if (!scene || scene.aborted) return;

        await awaitSignature(driver, route, payload, anims);
        if (!scene || scene.aborted) return;

        if (scene.wrapUp && !scene.signed) {
            await returnToDepot(driver, route, anims);
        } else {
            await departure(driver, route);
        }
    } catch (err) {
        AGM.log.error('delivery scenario failed:', err && err.stack ? err.stack : err);
        cleanup(false);
    }
});

/** ox_target option on the driver: opens the tablet-style signing screen. */
onNet('ag_mechanic:client:signDelivery', async () => {
    if (!scene || scene.signed || scene.wrapUp) return;

    const result = await AGM.nui.awaitResult('delivery', {
        orderId: scene.orderId,
        lines: scene.lines || [],
    });
    AGM.nui.close();
    if (!result || !result.signed) return;
    if (!scene || scene.signed || scene.wrapUp) return;

    const response = await AGM.rpc.call('delivery:sign', {});
    if (!response || !response.ok) {
        AGM.ui.notify(
            response && response.reason === 'alreadySigned'
                ? 'Somebody already signed for this one.'
                : AGM.ui.reasonText(response && response.reason),
            'error',
        );
        return;
    }

    const summary = response.lines.map((l) => `${l.qty}x ${l.label}`).join(', ');
    AGM.ui.notify(`${AGM.Config.locale.deliverySigned} ${summary}`, 'success', 'Delivery');
});

/* The host is told directly; everyone else only ever gets an abort. */
onNet('ag_mechanic:client:deliverySigned', () => {
    if (scene) scene.signed = true;
});

onNet('ag_mechanic:client:deliveryReturn', () => {
    if (scene) scene.wrapUp = true;
});

onNet('ag_mechanic:client:deliveryAbort', () => {
    AGM.deliveryScene.abort();
});

on('onResourceStop', (resource) => {
    if (resource !== AGM.RESOURCE) return;
    cleanup(false);
});
