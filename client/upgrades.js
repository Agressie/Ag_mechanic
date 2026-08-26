/*
 * ag_mechanic - fitting named upgrade tiers (client)
 * ============================================================================
 * The menu is a NUI screen; this file opens it with the server's view of what is
 * fittable and runs the install once the mechanic picks something.
 * ============================================================================
 */

AGM.upgrades = {};

let busy = false;

AGM.upgrades.open = async function (vehicle) {
    const info = AGM.state.describe(vehicle);
    if (!info) {
        AGM.ui.notify('Nothing here takes performance parts.', 'error');
        return;
    }
    if (!AGM.state.isMechanic()) {
        AGM.ui.notify(AGM.Config.locale.noJob, 'error');
        return;
    }

    const list = await AGM.rpc.call('upgrades:list', AGM.state.args(info));
    if (!list || !list.ok) {
        AGM.ui.notify(AGM.diagnose.reasonText(list && list.reason), 'error');
        return;
    }

    AGM.nui.show('upgrades', list, { vehicle: info });
};

AGM.upgrades.install = async function (info, category, tier, meta = {}) {
    if (busy || !info) return false;

    const vehicle = info.entity && DoesEntityExist(info.entity) ? info.entity : 0;
    if (!vehicle) {
        AGM.ui.notify(AGM.Config.locale.noVehicle, 'error');
        return false;
    }
    if (GetEntitySpeed(vehicle) > 1.0) {
        AGM.ui.notify(AGM.Config.locale.vehicleMoving, 'error');
        return false;
    }
    if (AGM.Config.repair.requireEngineOff && GetIsVehicleEngineRunning(vehicle)) {
        AGM.ui.notify(AGM.Config.locale.engineRunning, 'error');
        return false;
    }

    busy = true;
    try {
        const heavy = meta.install === 'garage';
        const completed = await AGM.ui.progress({
            duration: heavy ? 25000 : 12000,
            label: meta.label ? `Fitting ${meta.label}` : 'Fitting parts',
            canCancel: true,
            anim: { dict: 'mini@repair', clip: 'fixing_a_ped', flag: 49 },
            disable: { car: true, move: true, combat: true },
        });
        if (!completed) return false;

        const result = await AGM.rpc.call('upgrades:install', AGM.state.args(info, { category, tier }));
        if (!result || !result.ok) {
            const reason = result && result.reason;
            if (reason === 'noItem') {
                AGM.ui.notify(AGM.util.fmt(AGM.Config.locale.noItem, result.itemLabel || result.item), 'error');
            } else {
                AGM.ui.notify(AGM.diagnose.reasonText(reason), 'error');
            }
            return false;
        }

        const state = await AGM.state.fetch(info);
        if (state) AGM.perf.apply(vehicle, state);

        AGM.ui.notify(
            result.removed
                ? `${result.categoryLabel} back to standard.`
                : `${result.label} fitted.`,
            'success',
        );
        return true;
    } finally {
        busy = false;
        ClearPedTasks(PlayerPedId());
    }
};

on('ag_mechanic:internal:nuiAction', async (action, args) => {
    if (action !== 'installTier') return;

    const info = AGM.nui.context.vehicle;
    if (!info) return;
    AGM.nui.close(true);

    await AGM.upgrades.install(info, String(args.category || ''), Number(args.tier), {
        label: args.label,
        install: args.install,
    });

    const vehicle = info.entity && DoesEntityExist(info.entity) ? info.entity : 0;
    if (vehicle) await AGM.upgrades.open(vehicle);
});
