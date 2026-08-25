/*
 * ag_mechanic - world locations
 * ============================================================================
 * Coordinates below are set up for the Los Santos Customs on Greenwich Pl in
 * La Mesa. They are deliberately in one place so you can move the whole shop by
 * editing a single block - see docs/locations.md for how to re-survey them.
 *
 * Each shop has:
 *   bays        zones a vehicle must be inside for 'garage' repairs and installs
 *   lifts       ox_target points a mechanic interacts with to open the bay menu
 *   stash       the shared parts stash the tablet's inventory app is bound to
 *   delivery    the route and marks the parts van uses
 * ============================================================================
 */

AGM.Locations = {
    shops: [
        {
            id: 'lamesa',
            label: 'La Mesa Auto Works',
            job: 'mechanic',
            /* Blip for on-duty employees. Set to false for none. */
            blip: { sprite: 446, colour: 47, scale: 0.8, label: 'Auto Works' },

            /* Vehicle must sit inside one of these for workshop-only jobs. */
            bays: [
                { coords: [-337.0, -136.5, 39.0], size: [10.0, 12.0, 4.0], rotation: 70.0, label: 'Bay 1' },
                { coords: [-320.0, -134.0, 39.0], size: [10.0, 12.0, 4.0], rotation: 70.0, label: 'Bay 2' },
            ],

            /* Where a mechanic stands to work on whatever is in the bay. */
            lifts: [
                { coords: [-337.0, -136.5, 39.0], radius: 6.0, bay: 'Bay 1' },
                { coords: [-320.0, -134.0, 39.0], radius: 6.0, bay: 'Bay 2' },
            ],

            /* Parts stash, shared by the whole shop. */
            stash: {
                id: 'ag_mechanic_lamesa',
                label: 'Auto Works Parts Store',
                slots: 250,
                weight: 1000000,
                /* Physical access point, in addition to the tablet app. */
                point: { coords: [-329.0, -122.5, 39.0], radius: 1.4 },
            },

            /* Where employees clock on. Set to false to skip duty entirely. */
            duty: { coords: [-341.5, -132.0, 39.0], radius: 1.2 },

            /* --- parts delivery ------------------------------------------ */
            delivery: {
                /* Van spawns here, off-screen down the road. */
                spawn: { coords: [-283.0, -63.0, 39.0], heading: 250.0 },
                /* Optional waypoints driven in order before the final park. */
                route: [
                    [-300.0, -95.0, 39.0],
                    [-318.0, -113.0, 39.0],
                ],
                /* Where the van parks up outside the shop. */
                park: { coords: [-330.5, -113.0, 39.0], heading: 250.0 },
                /* Where the driver sets the pallet down. */
                drop: { coords: [-333.5, -119.0, 38.9], heading: 250.0 },
                /* Where the driver stands with the clipboard, waiting to be signed. */
                sign: { coords: [-331.8, -116.5, 39.0], heading: 70.0 },
                /* Van drives off towards here, then despawns. */
                exit: { coords: [-247.0, -30.0, 46.0] },
            },
        },
    ],

    /* Shared props/anims used by the delivery scenario. */
    anims: {
        carryBox: { dict: 'anim@heists@box_carry@', clip: 'idle' },
        putDown: { dict: 'anim@narcotics@trash', clip: 'drop_front' },
        clipboard: { dict: 'missfam4', clip: 'base' },
        sign: { dict: 'missheistdockssetup1clipboard@base', clip: 'base' },
        wrench: { dict: 'mini@repair', clip: 'fixing_a_ped' },
        underCar: { dict: 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@', clip: 'machinic_loop_mechandplayer' },
        inspect: { dict: 'anim@amb@clubhouse@tutorial@bkr_tut_ig3@', clip: 'machinic_loop_mechandplayer' },
        openHood: { dict: 'anim@mp_player_intmenu@key_fob@', clip: 'fob_click' },
    },
};

/** Shop definition by id. */
AGM.Locations.shop = function (id) {
    return AGM.Locations.shops.find((s) => s.id === id);
};

/** All shops that belong to a given job. */
AGM.Locations.shopsForJob = function (job) {
    return AGM.Locations.shops.filter((s) => s.job === job);
};

/** The shop a stash id belongs to. */
AGM.Locations.shopForStash = function (stashId) {
    return AGM.Locations.shops.find((s) => s.stash && s.stash.id === stashId);
};
