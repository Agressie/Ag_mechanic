/* ag_mechanic - general configuration */
AGM.Config = {
    debug: false,

    /* ---------------------------------------------------------------- job */
    job: {
        name: 'mechanic',
        /* Grades that may open the tablet at all. */
        tabletGrades: [0, 1, 2, 3, 4],
        /* Grade -> label + permissions. Keep in sync with your qbx_core jobs.lua. */
        grades: {
            0: { label: 'Trainee',        hire: false, fire: false, promote: false, order: false, stashTake: true,  stashPut: true },
            1: { label: 'Mechanic',       hire: false, fire: false, promote: false, order: false, stashTake: true,  stashPut: true },
            2: { label: 'Senior Mechanic',hire: true,  fire: false, promote: false, order: false, stashTake: true,  stashPut: true },
            3: { label: 'Shop Manager',   hire: true,  fire: true,  promote: true,  order: true,  stashTake: true,  stashPut: true },
            4: { label: 'Owner',          hire: true,  fire: true,  promote: true,  order: true,  stashTake: true,  stashPut: true },
        },
        /* Highest grade a promoter may promote someone *to* is their own grade - 1. */
        promoteBelowSelf: true,
    },

    /* ------------------------------------------------------------- tablet */
    tablet: {
        item: 'mechanic_tablet',   // set to false to skip the item requirement
        command: 'tablet',
        keybind: 'F7',             // set to false to disable the keymapping
        /* Apps are registered here; the UI only renders apps it is told about,
           so adding an app later is: add an entry + a Svelte component. */
        apps: [
            { id: 'home',      label: 'Home',      icon: 'grid',    grade: 0 },
            { id: 'personnel', label: 'Personnel', icon: 'users',   grade: 0 },
            { id: 'inventory', label: 'Stash',     icon: 'box',     grade: 0 },
            { id: 'shop',      label: 'Parts Shop',icon: 'cart',    grade: 0 },
        ],
    },

    /* ------------------------------------------------------------ repairs */
    repair: {
        /* Hard ceiling for improvised (ducttape / zipties) field repairs. */
        fieldRepairCap: 40,
        /* How much a single improvised repair adds, before the cap. */
        fieldRepairGain: { min: 12, max: 22 },
        /* Chance the tape/tie just doesn't hold (item is still consumed). */
        fieldRepairFailChance: 0.12,
        fieldRepairDuration: 9000,

        /* A mechanic swapping a real part restores it fully. */
        partRepairTarget: 100,
        mobileRepairDuration: 14000,
        garageRepairDuration: 22000,

        /* Repairing anything at all requires a toolbox in your inventory. */
        toolItem: 'mechanic_toolbox',
        /* Improvised repairs need one of these. */
        improvisedItems: ['ducttape', 'zipties'],
        /* Vehicle must be stationary and engine off for internal work. */
        requireEngineOff: true,
    },

    /* ---------------------------------------------------------- diagnose */
    diagnose: {
        /* Anyone can pop the hood and guess; a scanner makes the report exact. */
        scannerItem: 'obd_scanner',
        duration: 0,               // driven by the minigame, not a timer
        /* How long a report stays "fresh" before the numbers are stale (ms). */
        reportTtl: 15 * 60 * 1000,
        /* A report is invalidated early if any component moved more than this. */
        reportDriftInvalidate: 8,
        /* Bolts to undo and lines to unplug in the minigame. */
        bolts: { min: 3, max: 5 },
        lines: { min: 1, max: 2 },
        /* Score (0-1) thresholds -> report quality. */
        quality: {
            perfect: 0.85,   // exact percentages, every component
            good: 0.6,       // exact on damaged parts, banded on healthy ones
            partial: 0.35,   // banded everything, some parts unreadable
            // below partial -> only critical faults, rest unknown
        },
        /* Being on the mechanic job is worth this much added score. */
        jobScoreBonus: 0.08,
        scannerScoreBonus: 0.12,
    },

    /* ------------------------------------------------------------ garages */
    garage: {
        /* A vehicle counts as "in the garage" if it is inside one of the bay
           zones defined in config/locations.js. */
        requireVehicleInBay: true,
    },

    /* ------------------------------------------------------------ economy */
    economy: {
        /* Where order costs are drawn from: 'society' | 'cash' | 'bank' | 'free' */
        orderPaymentAccount: 'society',
        society: 'mechanic',
        /* Multiplier on catalog prices, for servers that run different economies. */
        priceMultiplier: 1.0,
    },

    /* -------------------------------------------------------- persistence */
    persistence: {
        /* Save dirty vehicles to the database on this interval (ms). */
        saveInterval: 60 * 1000,
        /* Drop cached health for vehicles nobody has touched in this long (ms). */
        cacheTtl: 30 * 60 * 1000,
        /* Forget rows for vehicles not seen in this many days (0 = never). */
        pruneAfterDays: 45,
    },

    /* -------------------------------------------------------- anti-abuse */
    security: {
        /* Max wear a single client report may contain, per component. */
        maxWearPerReport: 35,
        /* Minimum ms between wear reports from one client. */
        wearReportInterval: 900,
        /* Max distance (m) a player may be from a vehicle to act on it. */
        maxInteractDistance: 6.0,
    },

    /* ---------------------------------------------------------- messages */
    locale: {
        noJob: 'You do not work here.',
        noPermission: 'Your grade does not allow that.',
        noTool: 'You need a toolbox for this.',
        noItem: 'You are missing %s.',
        notInBay: 'This vehicle has to be on a lift in the garage.',
        engineRunning: 'Shut the engine off first.',
        vehicleMoving: 'The vehicle has to be stationary.',
        noVehicle: 'No vehicle nearby.',
        diagnoseFirst: 'You have no diagnostic report for this vehicle.',
        reportStale: 'That report is out of date. Run the diagnostic again.',
        fieldCapReached: 'A tape job will not hold any better than this.',
        fieldNotPossible: 'You cannot bodge that part. It needs replacing.',
        needsGarage: 'That part can only be replaced in a workshop.',
        repairDone: '%s repaired.',
        repairFailed: 'The bodge did not hold.',
        tabletNoAccess: 'The tablet refuses your credentials.',
        orderPlaced: 'Order placed. Expect delivery in about an hour.',
        orderFunds: 'The shop account cannot cover that.',
        deliveryArrived: 'A parts delivery has arrived out front.',
        deliverySigned: 'Delivery signed for. Parts moved to the stash.',
        deliveryBusy: 'A delivery is already on its way.',
    },
};
