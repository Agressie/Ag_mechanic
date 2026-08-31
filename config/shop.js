/*
 * ag_mechanic - parts catalogue, ordering and delivery
 * ============================================================================
 * Everything the shop can order. `item` must exist in your inventory resource
 * (see docs/items.md for a ready-made ox_inventory snippet).
 * ============================================================================
 */

const P = (item, label, category, price, o = {}) => Object.assign({
    item, label, category, price,
    /* Order sizes offered in the tablet. */
    packs: [1, 5, 10],
    /* Bulk discount: price * (1 - discount * (qty-1)/qty), capped. */
    bulkDiscount: 0.10,
    blurb: '',
}, o);

AGM.Shop = {
    /* Catalogue categories, in tablet display order. */
    categories: [
        { id: 'consumables', label: 'Consumables' },
        { id: 'engine', label: 'Engine & Induction' },
        { id: 'drivetrain', label: 'Drivetrain' },
        { id: 'brakes', label: 'Braking' },
        { id: 'chassis', label: 'Chassis & Running Gear' },
        { id: 'body', label: 'Body & Glass' },
        { id: 'electrical', label: 'Electrical' },
        { id: 'aircraft', label: 'Aircraft' },
        { id: 'marine', label: 'Marine' },
        { id: 'upgrades', label: 'Performance Upgrades' },
    ],

    catalogue: [
        /* ---- consumables ------------------------------------------------ */
        P('ducttape', 'Duct Tape', 'consumables', 25, { packs: [5, 10, 25], blurb: 'Holds a bumper on. Holds a radiator hose. Briefly.' }),
        P('zipties', 'Cable Ties', 'consumables', 18, { packs: [10, 25, 50], blurb: 'The correct tool for absolutely nothing, used for everything.' }),
        P('obd_scanner', 'OBD-II Scan Tool', 'consumables', 1200, { packs: [1, 2], blurb: 'Turns guesswork into codes. Cars and bikes only.' }),
        P('bite_tester', 'Avionics BITE Test Set', 'aircraft', 8600, { packs: [1], blurb: 'Reads built-in-test faults off an airframe. Will not talk to a car.' }),
        P('marine_diagnostic', 'Marine Diagnostic Tool', 'marine', 2400, { packs: [1], blurb: 'J1939 reader for marine diesels.' }),
        P('mechanic_toolbox', 'Mechanic Toolbox', 'consumables', 900, { packs: [1, 2], blurb: 'Spanners, sockets, and a torque wrench nobody calibrates.' }),
        P('mechanic_tablet', 'Shop Tablet', 'consumables', 2500, { packs: [1, 2], blurb: 'Roster, stash and the parts account, in one greasy screen.' }),
        P('card_reader', 'Mobile Card Reader', 'consumables', 650, { packs: [1, 2], blurb: 'Tap-to-pay, no wires. Bill a customer wherever the job is.' }),

        /* ---- engine ------------------------------------------------------ */
        P('air_filter', 'Air Filter', 'engine', 65, { blurb: 'Cheap, and neglected on every vehicle you will ever see.' }),
        P('spark_plugs', 'Spark Plugs & Coil Pack', 'engine', 180),
        P('oil_filter', 'Oil Filter & Service Kit', 'engine', 120),
        P('radiator', 'Radiator & Coolant', 'engine', 520),
        P('gasket_set', 'Head Gasket Set', 'engine', 640, { packs: [1, 3, 5] }),
        P('fuel_pump', 'Fuel Pump & Lines', 'engine', 480),
        P('exhaust', 'Exhaust & Manifold', 'engine', 420),
        P('engine_block', 'Engine Assembly', 'engine', 8500, { packs: [1, 2], blurb: 'A whole engine on a pallet. Order it and clear the floor.' }),

        /* ---- drivetrain -------------------------------------------------- */
        P('clutch_kit', 'Clutch & Flywheel Kit', 'drivetrain', 1150),
        P('gearbox', 'Gearbox Assembly', 'drivetrain', 5200, { packs: [1, 2] }),
        P('driveshaft', 'Driveshaft & Differential', 'drivetrain', 2400),
        P('drive_chain', 'Drive Chain & Sprocket Set', 'drivetrain', 320),

        /* ---- brakes ------------------------------------------------------ */
        P('brake_pads', 'Brake Pads & Discs', 'brakes', 240),
        P('brake_lines', 'Brake Lines & Master Cylinder', 'brakes', 380),

        /* ---- chassis ----------------------------------------------------- */
        P('suspension_kit', 'Suspension & Damper Kit', 'chassis', 980),
        P('steering_rack', 'Steering Rack & Column', 'chassis', 1450),
        P('wheel_rim', 'Wheel & Hub', 'chassis', 350, { packs: [1, 2, 4] }),
        P('tire', 'Tyre', 'chassis', 210, { packs: [1, 2, 4] }),

        /* ---- body -------------------------------------------------------- */
        P('body_panel', 'Body Panel & Filler', 'body', 460, { packs: [1, 4, 8] }),
        P('glass_set', 'Glass Set', 'body', 290),
        P('light_assembly', 'Light Assembly', 'body', 160, { packs: [1, 2, 4] }),

        /* ---- electrical -------------------------------------------------- */
        P('battery', 'Battery & Alternator', 'electrical', 340),
        P('wiring_harness', 'Wiring Harness & ECU', 'electrical', 890),

        /* ---- aircraft ---------------------------------------------------- */
        P('turbine_module', 'Turbine / Powerplant Module', 'aircraft', 26000, { packs: [1] }),
        P('rotor_gearbox', 'Main Rotor Gearbox', 'aircraft', 14500, { packs: [1] }),
        P('main_rotor_blade', 'Main Rotor Blade Set', 'aircraft', 11000, { packs: [1] }),
        P('tail_rotor_blade', 'Tail Rotor Blade Set', 'aircraft', 4800, { packs: [1, 2] }),
        P('tail_drive_shaft', 'Tail Drive Shaft', 'aircraft', 3600),
        P('hydraulic_pack', 'Hydraulic Pack', 'aircraft', 5200),
        P('control_linkage', 'Control Linkage Set', 'aircraft', 1400),
        P('control_surface', 'Control Surface', 'aircraft', 2600),
        P('propeller', 'Propeller Assembly', 'aircraft', 4200),
        P('landing_gear', 'Landing Gear & Actuator', 'aircraft', 5600),
        P('airframe_section', 'Airframe Section', 'aircraft', 7400),
        P('avionics_unit', 'Avionics Unit', 'aircraft', 3200),

        /* ---- marine ------------------------------------------------------ */
        P('bilge_pump', 'Bilge Pump', 'marine', 260),

        /* ---- performance upgrades --------------------------------------- */
        P('engine_intake', 'High-Flow Air Filter & Intake', 'upgrades', 850),
        P('engine_head', 'Ported Head & Uprated Gaskets', 'upgrades', 2600),
        P('engine_forged', 'Forged Internals & Camshafts', 'upgrades', 7200),
        P('engine_race', 'Billet Race Block', 'upgrades', 18500, { packs: [1] }),
        P('turbo_kit', 'Bolt-On Turbocharger Kit', 'upgrades', 6800),
        P('brakes_steel', 'Steel Brake Kit', 'upgrades', 780),
        P('brakes_titanium', 'Titanium Brake Kit', 'upgrades', 2400),
        P('brakes_carbon', 'Carbon Fibre Brake Kit', 'upgrades', 6900),
        P('trans_close', 'Close-Ratio Gearset', 'upgrades', 2100),
        P('trans_sequential', 'Short-Shift Sequential Gearbox', 'upgrades', 5600),
        P('trans_dogbox', 'Dogbox Race Transmission', 'upgrades', 13500, { packs: [1] }),
        P('susp_springs', 'Lowering Spring Set', 'upgrades', 620),
        P('susp_street', 'Street Coilovers', 'upgrades', 1900),
        P('susp_sport', 'Sport Coilovers', 'upgrades', 4400),
        P('susp_race', 'Competition Race Suspension', 'upgrades', 10500, { packs: [1] }),
        P('chassis_cage', 'Welded Roll Cage', 'upgrades', 2800),
        P('chassis_doors', 'Reinforced Doors & Pillars', 'upgrades', 4200),
        P('chassis_titanium', 'Titanium Chassis Bracing', 'upgrades', 9200),
        P('chassis_ballistic', 'Bullet-Resistant Body Work', 'upgrades', 19500, { packs: [1] }),
        P('chassis_shell', 'Ballistic Composite Shell', 'upgrades', 34000, { packs: [1] }),
        P('rotor_balanced', 'Balanced Composite Blades', 'upgrades', 6200, { packs: [1] }),
        P('rotor_highlift', 'High-Lift Composite Blades', 'upgrades', 13800, { packs: [1] }),
        P('rotor_carbon', 'Carbon Fibre Rotor System', 'upgrades', 28500, { packs: [1] }),
        P('prop_balanced', 'Balanced Composite Propeller', 'upgrades', 3400),
        P('prop_constant', 'Constant-Speed Propeller', 'upgrades', 8600, { packs: [1] }),
        P('prop_carbon', 'Carbon Fibre Race Propeller', 'upgrades', 17500, { packs: [1] }),
    ],

    /* Ordering ------------------------------------------------------------ */
    order: {
        /* How long an order takes to arrive. Real time, ticks while offline. */
        durationMs: 60 * 60 * 1000,
        /* Orders that may be in flight at once. */
        maxOpen: 3,
        /* Line items per order. */
        maxLines: 12,
        /* Total units per order. */
        maxUnits: 120,
        /* Kept in the order history / tablet list. */
        historyLimit: 25,
    },

    /* Delivery ------------------------------------------------------------ */
    delivery: {
        /* Picked at random per delivery. */
        vehicles: ['mule', 'boxville3', 'pounder'],
        driverModels: ['s_m_m_trucker_01', 's_m_y_construct_01', 'a_m_m_eastsa_02'],
        /* Prop dropped in front of the shop. */
        boxProp: 'prop_boxpile_07d',
        clipboardProp: 'p_amb_clipboard_01',
        /* How long the driver will wait for a signature before giving up (ms).
           If nobody signs in time the pallet goes back in the van and it drives
           back the way it came - see 'orders' on the tablet for the re-ship
           button that sends it out again. */
        signTimeout: 15 * 60 * 1000,
        /* Speed the van drives the last leg at (m/s). */
        approachSpeed: 12.0,
        /* Cleanup guard: kill the whole scenario after this long regardless,
           whether that means it never got signed for or the return leg hung. */
        hardTimeout: 20 * 60 * 1000,
        /* Horn taps once parked, to let the shop know it has arrived. */
        honk: { count: 2, onMs: 350, gapMs: 450 },
    },
};

/* Index for quick lookups. */
AGM.Shop._index = {};
for (const entry of AGM.Shop.catalogue) AGM.Shop._index[entry.item] = entry;

/** Catalogue entry for an item name. */
AGM.Shop.entry = (item) => AGM.Shop._index[item];

/** Display label for an item, falling back to the raw name. */
AGM.Shop.label = (item) => (AGM.Shop._index[item] ? AGM.Shop._index[item].label : item);

/** Unit price for `qty` of an item, including bulk discount and the global multiplier. */
AGM.Shop.price = function (item, qty) {
    const entry = AGM.Shop._index[item];
    if (!entry) return null;
    const q = Math.max(1, Math.floor(qty || 1));
    const discount = Math.min(0.35, (entry.bulkDiscount || 0) * ((q - 1) / q));
    const mult = (AGM.Config && AGM.Config.economy ? AGM.Config.economy.priceMultiplier : 1) || 1;
    return Math.round(entry.price * mult * (1 - discount));
};

/** Total cost of a cart: [{ item, qty }]. Returns null if anything is invalid. */
AGM.Shop.cartTotal = function (lines) {
    if (!Array.isArray(lines) || !lines.length) return null;
    let total = 0;
    for (const line of lines) {
        const unit = AGM.Shop.price(line.item, line.qty);
        if (unit === null) return null;
        total += unit * Math.max(1, Math.floor(line.qty || 1));
    }
    return total;
};
