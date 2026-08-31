/*
 * ag_mechanic - named upgrade tiers
 * ============================================================================
 * GTA exposes performance upgrades as anonymous integers: "Brakes 2",
 * "EMS Upgrade Level 3". This table gives every step a name a mechanic would
 * actually say out loud, and adds a virtual tier ladder for aircraft and boats,
 * which GTA does not let you mod natively at all.
 *
 * Tier index 0 is always the stock part. For native categories, tier N maps to
 * GTA mod value N-1 (tier 0 -> -1, i.e. removed).
 *
 * Tier fields
 * -----------
 *  label     what the mechanic and the tablet call it
 *  blurb     one line of flavour for the install menu
 *  item      inventory item consumed to fit it (null for the stock part)
 *  install   'mobile' or 'garage' - where the fitting has to happen
 *  perf      multipliers layered on top of GTA's own mod effect. For virtual
 *            categories (aircraft/boats) this is the *only* effect.
 * ============================================================================
 */

const MOD = { engine: 11, brakes: 12, transmission: 13, suspension: 15, armour: 16, turbo: 18 };

const T = (label, o = {}) => Object.assign({
    label,
    blurb: '',
    item: null,
    install: 'garage',
    perf: {},
}, o);

/* Shared ladders reused across blueprints -------------------------------- */
const BRAKE_LADDER = [
    T('Factory Brakes', { blurb: 'Whatever the factory bolted on. Adequate, once.', install: 'mobile' }),
    T('Steel Brakes', {
        blurb: 'Drilled steel discs and organic pads. Honest and cheap.',
        item: 'brakes_steel', install: 'mobile', perf: { brakes: 1.08 },
    }),
    T('Titanium Brakes', {
        blurb: 'Titanium-backed pads on a floating disc. Fade barely exists.',
        item: 'brakes_titanium', install: 'mobile', perf: { brakes: 1.18 },
    }),
    T('Carbon Fibre Brakes', {
        blurb: 'Carbon-ceramic. Cold they are useless, hot they are violent.',
        item: 'brakes_carbon', install: 'garage', perf: { brakes: 1.30 },
    }),
];

const CAR_ENGINE_LADDER = [
    T('Factory Engine', { blurb: 'Stock airbox, stock everything.', install: 'mobile' }),
    T('High-Flow Air Filter & Intake', {
        blurb: 'A panel filter and a cold-air feed. Cheapest real power there is.',
        item: 'engine_intake', install: 'mobile', perf: { power: 1.05 },
    }),
    T('Ported Head & Uprated Gaskets', {
        blurb: 'Head off, ports cleaned up, multi-layer steel gaskets going back on.',
        item: 'engine_head', install: 'garage', perf: { power: 1.10, torque: 1.06 },
    }),
    T('Forged Internals & Camshafts', {
        blurb: 'Forged rods and pistons on aggressive cams. It will not idle nicely.',
        item: 'engine_forged', install: 'garage', perf: { power: 1.16, torque: 1.12 },
    }),
    T('Billet Race Block', {
        blurb: 'A billet block with dry-sump oiling. Not really a road car any more.',
        item: 'engine_race', install: 'garage', perf: { power: 1.24, torque: 1.18 },
    }),
];

const CAR_TRANS_LADDER = [
    T('Factory Gearbox', { blurb: 'Long ratios, soft synchros.', install: 'mobile' }),
    T('Close-Ratio Gearset', {
        blurb: 'Tighter ratios so the engine stays in its band.',
        item: 'trans_close', install: 'garage', perf: { torque: 1.06 },
    }),
    T('Short-Shift Sequential', {
        blurb: 'Sequential gate with a short throw. Shifts land like a gunshot.',
        item: 'trans_sequential', install: 'garage', perf: { torque: 1.12, power: 1.03 },
    }),
    T('Dogbox Race Transmission', {
        blurb: 'Straight-cut dog rings. Flat-shift it or destroy it.',
        item: 'trans_dogbox', install: 'garage', perf: { torque: 1.20, power: 1.06 },
    }),
];

const CAR_SUSP_LADDER = [
    T('Factory Suspension', { blurb: 'Comfortable. Vague.', install: 'mobile' }),
    T('Lowered Springs', {
        blurb: 'Shorter springs on the original dampers. Looks better than it drives.',
        item: 'susp_springs', install: 'mobile', perf: { suspension: 1.05 },
    }),
    T('Street Coilovers', {
        blurb: 'Height adjustable, single-way damping. A real improvement.',
        item: 'susp_street', install: 'mobile', perf: { suspension: 1.10, traction: 1.04 },
    }),
    T('Sport Coilovers', {
        blurb: 'Two-way adjustable with uprated bushings and top mounts.',
        item: 'susp_sport', install: 'garage', perf: { suspension: 1.16, traction: 1.08 },
    }),
    T('Competition Race Suspension', {
        blurb: 'Spherical joints, three-way dampers, corner-weighted on the pads.',
        item: 'susp_race', install: 'garage', perf: { suspension: 1.24, traction: 1.12, steering: 1.06 },
    }),
];

/* "Armour" is really a structural package, so it gets structural names. */
const CAR_CHASSIS_LADDER = [
    T('Factory Chassis', { blurb: 'Spot welds and good intentions.', install: 'mobile' }),
    T('Welded Roll Cage', {
        blurb: 'Multi-point cage tied into the floor. The shell stops flexing.',
        item: 'chassis_cage', install: 'garage', perf: { suspension: 1.04, steering: 1.03 },
    }),
    T('Reinforced Doors & Pillars', {
        blurb: 'Intrusion bars in the doors, boxed B-pillars.',
        item: 'chassis_doors', install: 'garage',
    }),
    T('Titanium Chassis Bracing', {
        blurb: 'Titanium subframe and strut bracing. Stiff and stupidly light.',
        item: 'chassis_titanium', install: 'garage', perf: { steering: 1.05, suspension: 1.05 },
    }),
    T('Bullet-Resistant Body Work', {
        blurb: 'Composite plate behind every panel and laminated glass.',
        item: 'chassis_ballistic', install: 'garage',
    }),
    T('Ballistic Composite Shell', {
        blurb: 'A full armoured tub. Heavy, and it very much does not care.',
        item: 'chassis_shell', install: 'garage', perf: { suspension: 0.96 },
    }),
];

const TURBO_LADDER = [
    T('Naturally Aspirated', { blurb: 'No boost. Just displacement and hope.', install: 'mobile' }),
    T('Bolt-On Turbocharger', {
        blurb: 'Single turbo, front-mount cooler, sensible boost. Mostly sensible.',
        item: 'turbo_kit', install: 'garage', perf: { power: 1.12, torque: 1.10 },
    }),
];

/* ---------------------------------------------------------------- car/bike */
const CAR_TIERS = {
    engine:       { label: 'Engine Package',    mod: MOD.engine,       tiers: CAR_ENGINE_LADDER },
    brakes:       { label: 'Brakes',            mod: MOD.brakes,       tiers: BRAKE_LADDER },
    transmission: { label: 'Gearbox',           mod: MOD.transmission, tiers: CAR_TRANS_LADDER },
    suspension:   { label: 'Suspension',        mod: MOD.suspension,   tiers: CAR_SUSP_LADDER },
    chassis:      { label: 'Chassis & Armour',  mod: MOD.armour,       tiers: CAR_CHASSIS_LADDER },
    turbo:        { label: 'Forced Induction',  mod: MOD.turbo, toggle: true, tiers: TURBO_LADDER },
};

const BIKE_TIERS = {
    engine: {
        label: 'Engine Package', mod: MOD.engine, tiers: [
            T('Factory Engine', { blurb: 'Stock airbox and stock mapping.', install: 'mobile' }),
            T('High-Flow Air Filter & Jet Kit', {
                blurb: 'Foam filter, rejetted, remapped. Wakes it right up.',
                item: 'engine_intake', install: 'mobile', perf: { power: 1.06 },
            }),
            T('Ported Head & Uprated Gaskets', {
                blurb: 'Ported head with a thicker base gasket and fresh seals.',
                item: 'engine_head', install: 'garage', perf: { power: 1.11, torque: 1.05 },
            }),
            T('Forged Pistons & Race Cams', {
                blurb: 'Forged slugs and a wild cam. Vibrates your fillings loose.',
                item: 'engine_forged', install: 'garage', perf: { power: 1.17, torque: 1.10 },
            }),
            T('Big-Bore Race Kit', {
                blurb: 'Overbored barrels, titanium valves, no warranty.',
                item: 'engine_race', install: 'garage', perf: { power: 1.26, torque: 1.16 },
            }),
        ],
    },
    brakes:       { label: 'Brakes', mod: MOD.brakes, tiers: BRAKE_LADDER },
    transmission: {
        label: 'Gearbox', mod: MOD.transmission, tiers: [
            T('Factory Gearbox', { blurb: 'Stock ratios and a lazy shift.', install: 'mobile' }),
            T('Close-Ratio Gearset', {
                blurb: 'Tighter ratios for the top of the rev range.',
                item: 'trans_close', install: 'garage', perf: { torque: 1.06 },
            }),
            T('Quickshifter & Race Gearset', {
                blurb: 'Clutchless upshifts and a strengthened gearset.',
                item: 'trans_sequential', install: 'garage', perf: { torque: 1.13, power: 1.03 },
            }),
            T('Dogbox Race Transmission', {
                blurb: 'Dog rings and a slipper clutch. Brutal and fast.',
                item: 'trans_dogbox', install: 'garage', perf: { torque: 1.20, power: 1.06 },
            }),
        ],
    },
    suspension: {
        label: 'Suspension', mod: MOD.suspension, tiers: [
            T('Factory Suspension', { blurb: 'Stock forks, stock shock.', install: 'mobile' }),
            T('Lowered Springs', {
                blurb: 'Shorter springs front and rear. Cheap and cheerful.',
                item: 'susp_springs', install: 'mobile', perf: { suspension: 1.05 },
            }),
            T('Adjustable Cartridge Forks', {
                blurb: 'Cartridge internals with compression and rebound clickers.',
                item: 'susp_street', install: 'mobile', perf: { suspension: 1.11, traction: 1.05 },
            }),
            T('Fully Adjustable Race Suspension', {
                blurb: 'Gas shock, revalved forks, set up for your weight.',
                item: 'susp_sport', install: 'garage', perf: { suspension: 1.18, traction: 1.09 },
            }),
            T('Competition Race Suspension', {
                blurb: 'Full works kit off a race bike. Uncompromising.',
                item: 'susp_race', install: 'garage', perf: { suspension: 1.25, traction: 1.13, steering: 1.06 },
            }),
        ],
    },
    chassis: {
        label: 'Frame & Armour', mod: MOD.armour, tiers: [
            T('Factory Frame', { blurb: 'Standard tube frame.', install: 'mobile' }),
            T('Welded Frame Gusseting', {
                blurb: 'Gussets at every stress riser. Stops the frame twisting.',
                item: 'chassis_cage', install: 'garage', perf: { steering: 1.03 },
            }),
            T('Reinforced Subframe', {
                blurb: 'Boxed subframe and a stiffened swingarm pivot.',
                item: 'chassis_doors', install: 'garage', perf: { suspension: 1.03 },
            }),
            T('Titanium Frame Bracing', {
                blurb: 'Titanium bracing. Stiffer everywhere and lighter overall.',
                item: 'chassis_titanium', install: 'garage', perf: { steering: 1.05, suspension: 1.05 },
            }),
            T('Ballistic Fairing Panels', {
                blurb: 'Aramid-backed panels over the tank and airbox.',
                item: 'chassis_ballistic', install: 'garage',
            }),
            T('Full Ballistic Shell', {
                blurb: 'Everything plated that can be plated. Very heavy.',
                item: 'chassis_shell', install: 'garage', perf: { suspension: 0.95 },
            }),
        ],
    },
    turbo: { label: 'Forced Induction', mod: MOD.turbo, toggle: true, tiers: TURBO_LADDER },
};

/* ------------------------------------------------------------- aircraft */
/* GTA will not fit performance mods to aircraft or boats, so these ladders are
   virtual: we store the tier ourselves and apply `perf` directly. */
const AIRFRAME_LADDER = [
    T('Factory Airframe', { blurb: 'As it left the plant.', install: 'mobile' }),
    T('Welded Cage Structure', {
        blurb: 'Internal cage tied into the main spars.',
        item: 'chassis_cage', install: 'garage', perf: { control: 1.03 },
    }),
    T('Reinforced Bulkheads', {
        blurb: 'Doubled bulkheads and new fasteners throughout.',
        item: 'chassis_doors', install: 'garage', perf: { control: 1.04 },
    }),
    T('Titanium Airframe Bracing', {
        blurb: 'Titanium bracing. Stiffer and lighter than the original.',
        item: 'chassis_titanium', install: 'garage', perf: { control: 1.07, lift: 1.03 },
    }),
    T('Bullet-Resistant Body Work', {
        blurb: 'Armoured floor pans, plated tanks, laminated glazing.',
        item: 'chassis_ballistic', install: 'garage', perf: { lift: 0.97 },
    }),
    T('Ballistic Composite Shell', {
        blurb: 'Full armour package. It will absorb a great deal.',
        item: 'chassis_shell', install: 'garage', perf: { lift: 0.94, control: 0.97 },
    }),
];

const HELI_TIERS = {
    engine: {
        label: 'Powerplant', virtual: true, tiers: [
            T('Factory Turbine', { blurb: 'Stock hot section, stock limits.', install: 'mobile' }),
            T('High-Flow Intake & Filter', {
                blurb: 'Better particle separator and a freer intake.',
                item: 'engine_intake', install: 'mobile', perf: { power: 1.05 },
            }),
            T('Uprated Compressor & Seals', {
                blurb: 'New compressor wheel and fresh labyrinth seals.',
                item: 'engine_head', install: 'garage', perf: { power: 1.10, lift: 1.04 },
            }),
            T('Hot-Section Race Kit', {
                blurb: 'Uprated hot section running well past book temperature.',
                item: 'engine_forged', install: 'garage', perf: { power: 1.16, lift: 1.07 },
            }),
            T('Uprated Turbine Module', {
                blurb: 'A whole bigger engine. Torque limits become your problem.',
                item: 'engine_race', install: 'garage', perf: { power: 1.24, lift: 1.10 },
            }),
        ],
    },
    rotor: {
        label: 'Rotor System', virtual: true, tiers: [
            T('Factory Rotor Blades', { blurb: 'Standard metal blades.', install: 'mobile' }),
            T('Balanced Composite Blades', {
                blurb: 'Composite blades, tracked and balanced. Much less vibration.',
                item: 'rotor_balanced', install: 'garage', perf: { lift: 1.06, control: 1.04 },
            }),
            T('High-Lift Composite Blades', {
                blurb: 'Wider chord, more lift, better hover margin.',
                item: 'rotor_highlift', install: 'garage', perf: { lift: 1.12, control: 1.07 },
            }),
            T('Carbon Fibre Rotor System', {
                blurb: 'Carbon blades on a rigid head. Instant and unforgiving.',
                item: 'rotor_carbon', install: 'garage', perf: { lift: 1.18, control: 1.14, yaw: 1.05 },
            }),
        ],
    },
    transmission: {
        label: 'Main Gearbox', virtual: true, tiers: [
            T('Factory Gearbox', { blurb: 'Stock reduction gearing.', install: 'mobile' }),
            T('Uprated Gear Set', {
                blurb: 'Hardened gears with a higher torque limit.',
                item: 'trans_close', install: 'garage', perf: { power: 1.05, lift: 1.03 },
            }),
            T('Race-Spec Reduction Gearbox', {
                blurb: 'Lightweight case, tighter reduction, watch the oil temp.',
                item: 'trans_sequential', install: 'garage', perf: { power: 1.11, lift: 1.06 },
            }),
        ],
    },
    suspension: {
        label: 'Landing Gear', virtual: true, tiers: [
            T('Factory Skids', { blurb: 'Standard skid tubes.', install: 'mobile' }),
            T('Reinforced Skids', {
                blurb: 'Thicker tubes and doubled cross members.',
                item: 'susp_springs', install: 'mobile', perf: { control: 1.02 },
            }),
            T('Sprung Composite Skids', {
                blurb: 'Composite skids that actually absorb a heavy set-down.',
                item: 'susp_street', install: 'garage', perf: { control: 1.04 },
            }),
        ],
    },
    chassis: { label: 'Airframe & Armour', virtual: true, tiers: AIRFRAME_LADDER },
};

const PLANE_TIERS = {
    engine: {
        label: 'Powerplant', virtual: true, tiers: [
            T('Factory Engine', { blurb: 'Book power, book limits.', install: 'mobile' }),
            T('High-Flow Intake & Filter', {
                blurb: 'Freer intake tract and a proper filter.',
                item: 'engine_intake', install: 'mobile', perf: { power: 1.05 },
            }),
            T('Ported Head & Uprated Gaskets', {
                blurb: 'Ported, gasketed and flow-matched.',
                item: 'engine_head', install: 'garage', perf: { power: 1.10 },
            }),
            T('Forged Internals', {
                blurb: 'Forged bottom end. Happy at continuous full power.',
                item: 'engine_forged', install: 'garage', perf: { power: 1.16, lift: 1.03 },
            }),
            T('Race Turbine Module', {
                blurb: 'A significantly larger engine than the airframe expected.',
                item: 'engine_race', install: 'garage', perf: { power: 1.25, lift: 1.06 },
            }),
        ],
    },
    transmission: {
        label: 'Propeller & Drive', virtual: true, tiers: [
            T('Factory Propeller', { blurb: 'Standard fixed-pitch prop.', install: 'mobile' }),
            T('Balanced Composite Prop', {
                blurb: 'Composite blades, dynamically balanced.',
                item: 'prop_balanced', install: 'mobile', perf: { power: 1.05 },
            }),
            T('Constant-Speed Composite Prop', {
                blurb: 'Governed pitch. Right blade angle at every speed.',
                item: 'prop_constant', install: 'garage', perf: { power: 1.11, lift: 1.04 },
            }),
            T('Carbon Fibre Race Prop', {
                blurb: 'Scimitar carbon blades. Loud, efficient, expensive.',
                item: 'prop_carbon', install: 'garage', perf: { power: 1.17, lift: 1.07 },
            }),
        ],
    },
    brakes: {
        label: 'Wheel Brakes', virtual: true, tiers: [
            T('Factory Brakes', { blurb: 'Standard single-puck brakes.', install: 'mobile' }),
            T('Steel Brakes', {
                blurb: 'Steel discs and organic linings.',
                item: 'brakes_steel', install: 'mobile', perf: { brakes: 1.10 },
            }),
            T('Titanium Brakes', {
                blurb: 'Titanium-backed pads. Far less fade on a short strip.',
                item: 'brakes_titanium', install: 'mobile', perf: { brakes: 1.22 },
            }),
            T('Carbon Fibre Brakes', {
                blurb: 'Carbon discs. Stops it in almost no distance at all.',
                item: 'brakes_carbon', install: 'garage', perf: { brakes: 1.35 },
            }),
        ],
    },
    suspension: {
        label: 'Landing Gear', virtual: true, tiers: [
            T('Factory Gear', { blurb: 'Standard oleo struts.', install: 'mobile' }),
            T('Reinforced Gear', {
                blurb: 'Heavier legs and new actuators. Survives bad landings.',
                item: 'susp_springs', install: 'mobile', perf: { control: 1.02 },
            }),
            T('Sprung Composite Gear', {
                blurb: 'Composite legs that soak up a firm arrival.',
                item: 'susp_street', install: 'garage', perf: { control: 1.04 },
            }),
        ],
    },
    chassis: { label: 'Airframe & Armour', virtual: true, tiers: AIRFRAME_LADDER },
};

const BOAT_TIERS = {
    engine: {
        label: 'Marine Engine', virtual: true, tiers: [
            T('Factory Engine', { blurb: 'Stock marine spec.', install: 'mobile' }),
            T('High-Flow Intake', {
                blurb: 'Freer flame arrestor and intake plenum.',
                item: 'engine_intake', install: 'mobile', perf: { power: 1.05 },
            }),
            T('Ported Head & Gaskets', {
                blurb: 'Ported heads and marine-spec gaskets.',
                item: 'engine_head', install: 'garage', perf: { power: 1.10, torque: 1.05 },
            }),
            T('Forged Internals', {
                blurb: 'Forged rotating assembly. Made for wide-open throttle.',
                item: 'engine_forged', install: 'garage', perf: { power: 1.16, torque: 1.11 },
            }),
            T('Race Block', {
                blurb: 'Full race engine with a closed cooling loop.',
                item: 'engine_race', install: 'garage', perf: { power: 1.25, torque: 1.18 },
            }),
        ],
    },
    transmission: {
        label: 'Outdrive', virtual: true, tiers: [
            T('Factory Outdrive', { blurb: 'Standard leg and ratio.', install: 'mobile' }),
            T('Close-Ratio Outdrive', {
                blurb: 'Shorter ratio for quicker planing.',
                item: 'trans_close', install: 'garage', perf: { torque: 1.07 },
            }),
            T('Race Outdrive', {
                blurb: 'Trimmable race leg on a heavy-duty gear set.',
                item: 'trans_sequential', install: 'garage', perf: { torque: 1.14, power: 1.04 },
            }),
        ],
    },
    propeller: {
        label: 'Propeller', virtual: true, tiers: [
            T('Factory Propeller', { blurb: 'Aluminium three-blade.', install: 'mobile' }),
            T('Balanced Stainless Prop', {
                blurb: 'Stainless, balanced, holds its edge.',
                item: 'prop_balanced', install: 'mobile', perf: { power: 1.05, torque: 1.03 },
            }),
            T('Cupped Race Prop', {
                blurb: 'Cupped trailing edge. Grips the water at high trim.',
                item: 'prop_constant', install: 'mobile', perf: { power: 1.10, torque: 1.07 },
            }),
            T('Carbon Fibre Race Prop', {
                blurb: 'Carbon blades. Almost no inertia, no forgiveness either.',
                item: 'prop_carbon', install: 'garage', perf: { power: 1.16, torque: 1.11 },
            }),
        ],
    },
    chassis: {
        label: 'Hull & Armour', virtual: true, tiers: [
            T('Factory Hull', { blurb: 'Standard layup.', install: 'mobile' }),
            T('Reinforced Stringers', {
                blurb: 'Doubled stringers and a new transom knee.',
                item: 'chassis_cage', install: 'garage', perf: { traction: 1.04 },
            }),
            T('Titanium Hull Bracing', {
                blurb: 'Titanium bracing. Stops the hull flexing in a chop.',
                item: 'chassis_titanium', install: 'garage', perf: { traction: 1.08, steering: 1.04 },
            }),
            T('Bullet-Resistant Hull Plating', {
                blurb: 'Armour plate below the waterline and laminated glazing.',
                item: 'chassis_ballistic', install: 'garage', perf: { power: 0.96 },
            }),
        ],
    },
};

AGM.Tiers = {
    MOD,
    byBlueprint: { car: CAR_TIERS, bike: BIKE_TIERS, heli: HELI_TIERS, plane: PLANE_TIERS, boat: BOAT_TIERS },
};

/** All upgrade categories for a blueprint. */
AGM.Tiers.categories = (blueprint) => AGM.Tiers.byBlueprint[blueprint] || {};

/** One category definition, e.g. ('car', 'brakes'). */
AGM.Tiers.category = (blueprint, cat) => (AGM.Tiers.byBlueprint[blueprint] || {})[cat];

/** One tier definition. */
AGM.Tiers.tier = function (blueprint, cat, index) {
    const c = AGM.Tiers.category(blueprint, cat);
    if (!c) return undefined;
    return c.tiers[index];
};

/** Highest valid tier index for a category. */
AGM.Tiers.maxIndex = function (blueprint, cat) {
    const c = AGM.Tiers.category(blueprint, cat);
    return c ? c.tiers.length - 1 : 0;
};

/** Tier index -> GTA mod value. Tier 0 is "no mod fitted" (-1). */
AGM.Tiers.toModValue = (index) => (index <= 0 ? -1 : index - 1);

/** GTA mod value -> tier index. */
AGM.Tiers.fromModValue = (value) => (value === null || value === undefined || value < 0 ? 0 : value + 1);
