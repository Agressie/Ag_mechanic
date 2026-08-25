/*
 * ag_mechanic - component health blueprints
 * ============================================================================
 * Every supported vehicle carries one of these blueprints. Each component has
 * its own 0-100 health value that wears independently, so two cars with the
 * same body damage can need completely different work.
 *
 * Component fields
 * ----------------
 *  repair        'field'  - improvised only, never fully repairable
 *                'mobile' - a mechanic can swap it at the roadside
 *                'garage' - only replaceable on a lift (this is what forces tows)
 *  garageBelow   if health drops under this, a 'mobile' part becomes a garage
 *                job. This is why cars only *sometimes* need towing.
 *  part          inventory item consumed for a full (100%) replacement
 *  field         may be bodged with ducttape/zipties, capped at Config.repair
 *                .fieldRepairCap (40%)
 *  critical      when dead, the vehicle cannot be driven/flown at all
 *  deadAt        health at or below this counts as dead
 *  warnAt        health under this shows amber in the diagnostic report
 *  serviceAt     health under this means the part genuinely *needs* work. Above
 *                it a job is advisory only, which is what stops every scuffed
 *                bumper from turning into a tow truck call.
 *  decay         multiplier applied to all incoming wear for this component
 *  effects       weight of this component on each performance axis. Weights are
 *                normalised per axis at load, so you can add components without
 *                rebalancing every number by hand.
 *  wearOn        { component: multiplier } - while this part is unhealthy it
 *                accelerates wear on another part (a dry sump kills an engine)
 *  wheelIndex    GTA wheel index, for tyre components
 * ============================================================================
 */

const C = (id, label, group, o = {}) => Object.assign({
    id,
    label,
    group,
    repair: 'mobile',
    part: null,
    field: false,
    fieldItems: ['ducttape', 'zipties'],
    critical: false,
    deadAt: 5,
    warnAt: 35,
    serviceAt: 70,
    garageBelow: null,
    decay: 1.0,
    effects: {},
    wearOn: null,
    wheelIndex: null,
}, o);

/* -------------------------------------------------------------- automobile */
const CAR = [
    // --- engine bay ---------------------------------------------------------
    C('engine', 'Engine Block & Internals', 'engine', {
        repair: 'garage', part: 'engine_block', critical: true, decay: 0.7,
        effects: { power: 45, torque: 40 },
    }),
    C('gaskets', 'Head Gasket & Seals', 'engine', {
        repair: 'garage', part: 'gasket_set', decay: 1.1,
        effects: { power: 12, torque: 10 },
        wearOn: { engine: 1.8 },
    }),
    C('air_filter', 'Air Filter', 'engine', {
        repair: 'mobile', part: 'air_filter', field: true, fieldItems: ['ducttape'], decay: 1.6,
        effects: { power: 9 },
    }),
    C('spark_plugs', 'Spark Plugs & Coil Packs', 'engine', {
        repair: 'mobile', part: 'spark_plugs', decay: 1.3,
        effects: { power: 11, torque: 7 },
    }),
    C('oil_system', 'Oil Pump, Filter & Sump', 'engine', {
        repair: 'mobile', part: 'oil_filter', field: true, fieldItems: ['ducttape'], garageBelow: 15, decay: 1.2,
        effects: { power: 6 },
        wearOn: { engine: 2.6, gearbox: 1.2 },
    }),
    C('radiator', 'Radiator, Fan & Coolant', 'engine', {
        repair: 'mobile', part: 'radiator', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.4,
        effects: { power: 7 },
        wearOn: { engine: 2.2, gaskets: 2.0 },
    }),
    C('fuel_system', 'Fuel Pump & Lines', 'engine', {
        repair: 'mobile', part: 'fuel_pump', field: true, fieldItems: ['zipties'], critical: true, decay: 1.1,
        effects: { power: 14 },
    }),
    C('exhaust', 'Exhaust & Manifold', 'engine', {
        repair: 'mobile', part: 'exhaust', field: true, fieldItems: ['ducttape'], decay: 1.5,
        effects: { power: 7 },
    }),
    C('ecu', 'ECU & Wiring Harness', 'electrical', {
        repair: 'mobile', part: 'wiring_harness', field: true, fieldItems: ['zipties'], critical: true, decay: 0.9,
        effects: { power: 10, torque: 5 },
    }),
    C('battery', 'Battery & Alternator', 'electrical', {
        repair: 'mobile', part: 'battery', field: true, fieldItems: ['zipties'], critical: true, decay: 1.2,
        effects: {},
    }),

    // --- drivetrain ---------------------------------------------------------
    C('clutch', 'Clutch & Flywheel', 'drivetrain', {
        repair: 'garage', part: 'clutch_kit', critical: true, decay: 1.2,
        effects: { torque: 30, power: 10 },
    }),
    C('gearbox', 'Gearbox', 'drivetrain', {
        repair: 'garage', part: 'gearbox', critical: true, decay: 0.9,
        effects: { torque: 25, power: 12 },
    }),
    C('driveshaft', 'Driveshaft & Differential', 'drivetrain', {
        repair: 'garage', part: 'driveshaft', critical: true, decay: 0.9,
        effects: { torque: 20, traction: 8 },
    }),

    // --- running gear -------------------------------------------------------
    C('brake_pads', 'Brake Pads & Discs', 'brakes', {
        repair: 'mobile', part: 'brake_pads', decay: 1.5,
        effects: { brakes: 45 },
    }),
    C('brake_lines', 'Brake Lines & Master Cylinder', 'brakes', {
        repair: 'mobile', part: 'brake_lines', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: { brakes: 55 },
    }),
    C('suspension', 'Suspension, Springs & Dampers', 'chassis', {
        repair: 'mobile', part: 'suspension_kit', garageBelow: 25, decay: 1.2,
        effects: { suspension: 60, traction: 15, steering: 10 },
    }),
    C('steering', 'Steering Rack & Column', 'chassis', {
        repair: 'garage', part: 'steering_rack', critical: true, decay: 0.8,
        effects: { steering: 70 },
    }),
    C('wheels', 'Wheels & Hubs', 'chassis', {
        repair: 'mobile', part: 'wheel_rim', decay: 1.1,
        effects: { traction: 8, steering: 8, suspension: 10 },
    }),
    C('tire_fl', 'Front Left Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.0, wheelIndex: 0,
        effects: { traction: 11, steering: 6 },
    }),
    C('tire_fr', 'Front Right Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.0, wheelIndex: 1,
        effects: { traction: 11, steering: 6 },
    }),
    C('tire_rl', 'Rear Left Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.0, wheelIndex: 4,
        effects: { traction: 11 },
    }),
    C('tire_rr', 'Rear Right Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.0, wheelIndex: 5,
        effects: { traction: 11 },
    }),

    // --- body ---------------------------------------------------------------
    C('body', 'Body Panels & Frame', 'body', {
        repair: 'garage', part: 'body_panel', field: true, fieldItems: ['ducttape'], garageBelow: 100, decay: 1.0,
        effects: {},
    }),
    C('windows', 'Glass & Windscreen', 'body', {
        repair: 'mobile', part: 'glass_set', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: {},
    }),
    C('lights', 'Lighting & Indicators', 'body', {
        repair: 'mobile', part: 'light_assembly', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: {},
    }),
];

/* -------------------------------------------------------------- motorcycle */
const BIKE = [
    C('engine', 'Engine & Internals', 'engine', {
        repair: 'garage', part: 'engine_block', critical: true, decay: 0.8,
        effects: { power: 45, torque: 40 },
    }),
    C('gaskets', 'Head Gasket & Seals', 'engine', {
        repair: 'garage', part: 'gasket_set', decay: 1.1,
        effects: { power: 12, torque: 10 }, wearOn: { engine: 1.8 },
    }),
    C('air_filter', 'Air Filter', 'engine', {
        repair: 'mobile', part: 'air_filter', field: true, fieldItems: ['ducttape'], decay: 1.7,
        effects: { power: 10 },
    }),
    C('spark_plugs', 'Spark Plugs & Coils', 'engine', {
        repair: 'mobile', part: 'spark_plugs', decay: 1.4,
        effects: { power: 12, torque: 8 },
    }),
    C('oil_system', 'Oil Pump & Filter', 'engine', {
        repair: 'mobile', part: 'oil_filter', field: true, fieldItems: ['ducttape'], garageBelow: 15, decay: 1.3,
        effects: { power: 6 }, wearOn: { engine: 2.8 },
    }),
    C('radiator', 'Radiator & Coolant', 'engine', {
        repair: 'mobile', part: 'radiator', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.5,
        effects: { power: 8 }, wearOn: { engine: 2.4, gaskets: 2.0 },
    }),
    C('fuel_system', 'Fuel Pump & Lines', 'engine', {
        repair: 'mobile', part: 'fuel_pump', field: true, fieldItems: ['zipties'], critical: true, decay: 1.1,
        effects: { power: 14 },
    }),
    C('exhaust', 'Exhaust & Header', 'engine', {
        repair: 'mobile', part: 'exhaust', field: true, fieldItems: ['ducttape'], decay: 1.5,
        effects: { power: 8 },
    }),
    C('ecu', 'ECU & Loom', 'electrical', {
        repair: 'mobile', part: 'wiring_harness', field: true, fieldItems: ['zipties'], critical: true, decay: 1.0,
        effects: { power: 10 },
    }),
    C('battery', 'Battery & Regulator', 'electrical', {
        repair: 'mobile', part: 'battery', field: true, fieldItems: ['zipties'], critical: true, decay: 1.2,
    }),
    C('clutch', 'Clutch Basket & Plates', 'drivetrain', {
        repair: 'garage', part: 'clutch_kit', critical: true, decay: 1.3,
        effects: { torque: 30, power: 10 },
    }),
    C('gearbox', 'Gearbox & Selector', 'drivetrain', {
        repair: 'garage', part: 'gearbox', critical: true, decay: 1.0,
        effects: { torque: 25, power: 12 },
    }),
    /* A snapped chain is the bike equivalent of a driveshaft - but unlike a
       driveshaft it is genuinely a roadside job, so bikes get towed less. */
    C('chain_drive', 'Final Drive Chain & Sprockets', 'drivetrain', {
        repair: 'mobile', part: 'drive_chain', field: true, fieldItems: ['zipties'], critical: true, decay: 1.6,
        effects: { torque: 18, traction: 6 },
    }),
    C('brake_pads', 'Brake Pads & Discs', 'brakes', {
        repair: 'mobile', part: 'brake_pads', decay: 1.6,
        effects: { brakes: 45 },
    }),
    C('brake_lines', 'Brake Lines & Master Cylinder', 'brakes', {
        repair: 'mobile', part: 'brake_lines', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: { brakes: 55 },
    }),
    C('suspension', 'Forks & Rear Shock', 'chassis', {
        repair: 'mobile', part: 'suspension_kit', garageBelow: 25, decay: 1.3,
        effects: { suspension: 60, traction: 15, steering: 12 },
    }),
    C('steering', 'Triple Clamp & Head Bearings', 'chassis', {
        repair: 'garage', part: 'steering_rack', critical: true, decay: 0.9,
        effects: { steering: 70 },
    }),
    C('wheels', 'Wheels & Bearings', 'chassis', {
        repair: 'mobile', part: 'wheel_rim', decay: 1.1,
        effects: { traction: 10, steering: 10, suspension: 10 },
    }),
    C('tire_front', 'Front Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.1, wheelIndex: 0,
        effects: { traction: 20, steering: 12 },
    }),
    C('tire_rear', 'Rear Tyre', 'tyres', {
        repair: 'mobile', part: 'tire', field: true, fieldItems: ['ducttape'], decay: 1.3, wheelIndex: 4,
        effects: { traction: 24 },
    }),
    C('body', 'Frame & Subframe', 'body', {
        repair: 'garage', part: 'body_panel', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
    C('windows', 'Fairing & Screen', 'body', {
        repair: 'mobile', part: 'glass_set', field: true, fieldItems: ['ducttape'], decay: 1.1,
    }),
    C('lights', 'Lighting & Indicators', 'body', {
        repair: 'mobile', part: 'light_assembly', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
];

/* -------------------------------------------------------------- rotorcraft */
const HELI = [
    C('engine', 'Turbine / Powerplant', 'engine', {
        repair: 'garage', part: 'turbine_module', critical: true, decay: 0.7,
        effects: { power: 50, lift: 30 },
    }),
    C('air_filter', 'Intake Filter & Particle Separator', 'engine', {
        repair: 'mobile', part: 'air_filter', field: true, fieldItems: ['ducttape'], decay: 1.6,
        effects: { power: 10 },
    }),
    C('oil_system', 'Engine & Transmission Oil System', 'engine', {
        repair: 'mobile', part: 'oil_filter', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.3,
        effects: { power: 8 },
        wearOn: { engine: 2.6, main_gearbox: 2.4 },
    }),
    C('fuel_system', 'Fuel Pumps & Lines', 'engine', {
        repair: 'mobile', part: 'fuel_pump', field: true, fieldItems: ['zipties'], critical: true, decay: 1.1,
        effects: { power: 14 },
    }),
    C('ignition', 'FADEC & Igniters', 'electrical', {
        repair: 'mobile', part: 'wiring_harness', field: true, fieldItems: ['zipties'], critical: true, decay: 1.0,
        effects: { power: 12 },
    }),
    C('battery', 'Battery & Generator', 'electrical', {
        repair: 'mobile', part: 'battery', field: true, fieldItems: ['zipties'], critical: true, decay: 1.2,
    }),
    C('avionics', 'Avionics & Instruments', 'electrical', {
        repair: 'mobile', part: 'avionics_unit', field: true, fieldItems: ['zipties'], decay: 1.1,
        effects: { control: 15 },
    }),

    C('main_gearbox', 'Main Rotor Gearbox', 'drivetrain', {
        repair: 'garage', part: 'rotor_gearbox', critical: true, decay: 0.8,
        effects: { lift: 30, power: 15, control: 10 },
    }),
    C('main_rotor', 'Main Rotor Head & Blades', 'rotor', {
        repair: 'garage', part: 'main_rotor_blade', critical: true, decay: 0.9,
        effects: { lift: 55, control: 25 },
    }),
    C('tail_rotor', 'Tail Rotor & Blades', 'rotor', {
        repair: 'garage', part: 'tail_rotor_blade', critical: true, decay: 1.1,
        effects: { yaw: 70, control: 20 },
    }),
    C('tail_drive', 'Tail Drive Shaft & Boom', 'rotor', {
        repair: 'garage', part: 'tail_drive_shaft', critical: true, decay: 0.9,
        effects: { yaw: 30 },
    }),
    C('hydraulics', 'Swashplate & Hydraulics', 'controls', {
        repair: 'garage', part: 'hydraulic_pack', critical: true, decay: 1.0,
        effects: { control: 55 },
    }),
    C('controls', 'Cyclic, Collective & Linkages', 'controls', {
        repair: 'mobile', part: 'control_linkage', field: true, fieldItems: ['zipties'], garageBelow: 25, decay: 1.1,
        effects: { control: 30, yaw: 15 },
    }),
    C('skids', 'Landing Skids / Gear', 'body', {
        repair: 'mobile', part: 'landing_gear', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.2,
    }),
    C('airframe', 'Airframe & Tail Boom Structure', 'body', {
        repair: 'garage', part: 'airframe_section', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: { control: 10 },
    }),
    C('windows', 'Canopy & Glazing', 'body', {
        repair: 'mobile', part: 'glass_set', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
    C('lights', 'Nav, Anti-Collision & Landing Lights', 'body', {
        repair: 'mobile', part: 'light_assembly', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
];

/* --------------------------------------------------------- fixed-wing */
const PLANE = [
    C('engine', 'Powerplant', 'engine', {
        repair: 'garage', part: 'turbine_module', critical: true, decay: 0.7,
        effects: { power: 50, lift: 20 },
    }),
    C('air_filter', 'Intake & Filters', 'engine', {
        repair: 'mobile', part: 'air_filter', field: true, fieldItems: ['ducttape'], decay: 1.6,
        effects: { power: 10 },
    }),
    C('ignition', 'Ignition & Engine Control', 'engine', {
        repair: 'mobile', part: 'spark_plugs', critical: true, decay: 1.3,
        effects: { power: 12 },
    }),
    C('oil_system', 'Oil System', 'engine', {
        repair: 'mobile', part: 'oil_filter', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.3,
        effects: { power: 8 }, wearOn: { engine: 2.6 },
    }),
    C('fuel_system', 'Fuel Pumps, Tanks & Lines', 'engine', {
        repair: 'mobile', part: 'fuel_pump', field: true, fieldItems: ['zipties'], critical: true, decay: 1.1,
        effects: { power: 14 },
    }),
    C('propeller', 'Propeller / Fan Assembly', 'drivetrain', {
        repair: 'garage', part: 'propeller', critical: true, decay: 1.0,
        effects: { power: 30, lift: 15 },
    }),
    C('battery', 'Battery & Generator', 'electrical', {
        repair: 'mobile', part: 'battery', field: true, fieldItems: ['zipties'], critical: true, decay: 1.2,
    }),
    C('avionics', 'Avionics & Instruments', 'electrical', {
        repair: 'mobile', part: 'avionics_unit', field: true, fieldItems: ['zipties'], decay: 1.1,
        effects: { control: 15 },
    }),
    C('hydraulics', 'Hydraulic System', 'controls', {
        repair: 'garage', part: 'hydraulic_pack', critical: true, decay: 1.0,
        effects: { control: 35 },
    }),
    C('ailerons', 'Ailerons & Roll Control', 'controls', {
        repair: 'mobile', part: 'control_surface', field: true, fieldItems: ['ducttape'], garageBelow: 25, decay: 1.2,
        effects: { control: 30 },
    }),
    C('elevator', 'Elevator & Pitch Control', 'controls', {
        repair: 'mobile', part: 'control_surface', field: true, fieldItems: ['ducttape'], garageBelow: 25, critical: true, decay: 1.2,
        effects: { control: 30, lift: 10 },
    }),
    C('rudder', 'Rudder & Yaw Control', 'controls', {
        repair: 'mobile', part: 'control_surface', field: true, fieldItems: ['ducttape'], garageBelow: 25, decay: 1.2,
        effects: { yaw: 70 },
    }),
    C('flaps', 'Flaps & Slats', 'controls', {
        repair: 'mobile', part: 'control_surface', field: true, fieldItems: ['zipties'], decay: 1.3,
        effects: { lift: 20, control: 10 },
    }),
    C('landing_gear', 'Landing Gear & Actuators', 'body', {
        repair: 'garage', part: 'landing_gear', field: true, fieldItems: ['zipties'], garageBelow: 30, decay: 1.3,
    }),
    C('wheel_brakes', 'Wheel Brakes', 'brakes', {
        repair: 'mobile', part: 'brake_pads', decay: 1.4,
        effects: { brakes: 100 },
    }),
    C('airframe', 'Airframe, Wings & Spars', 'body', {
        repair: 'garage', part: 'airframe_section', field: true, fieldItems: ['ducttape'], decay: 0.9,
        effects: { control: 10, lift: 15 },
    }),
    C('windows', 'Canopy & Glazing', 'body', {
        repair: 'mobile', part: 'glass_set', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
    C('lights', 'Nav & Landing Lights', 'body', {
        repair: 'mobile', part: 'light_assembly', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
];

/* -------------------------------------------------------------- watercraft */
const BOAT = [
    C('engine', 'Marine Engine', 'engine', {
        repair: 'garage', part: 'engine_block', critical: true, decay: 0.8,
        effects: { power: 50, torque: 35 },
    }),
    C('air_filter', 'Intake & Flame Arrestor', 'engine', {
        repair: 'mobile', part: 'air_filter', field: true, fieldItems: ['ducttape'], decay: 1.5,
        effects: { power: 9 },
    }),
    C('ignition', 'Ignition & Plugs', 'engine', {
        repair: 'mobile', part: 'spark_plugs', decay: 1.4,
        effects: { power: 12 },
    }),
    C('oil_system', 'Oil System', 'engine', {
        repair: 'mobile', part: 'oil_filter', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.3,
        effects: { power: 7 }, wearOn: { engine: 2.6 },
    }),
    C('cooling', 'Raw Water Cooling & Impeller', 'engine', {
        repair: 'mobile', part: 'radiator', field: true, fieldItems: ['ducttape'], garageBelow: 20, decay: 1.5,
        effects: { power: 8 }, wearOn: { engine: 2.4 },
    }),
    C('fuel_system', 'Fuel Pump & Lines', 'engine', {
        repair: 'mobile', part: 'fuel_pump', field: true, fieldItems: ['zipties'], critical: true, decay: 1.1,
        effects: { power: 14 },
    }),
    C('battery', 'Battery & Alternator', 'electrical', {
        repair: 'mobile', part: 'battery', field: true, fieldItems: ['zipties'], critical: true, decay: 1.2,
    }),
    C('ecu', 'ECU & Wiring', 'electrical', {
        repair: 'mobile', part: 'wiring_harness', field: true, fieldItems: ['zipties'], critical: true, decay: 1.0,
        effects: { power: 10 },
    }),
    C('gearbox', 'Outdrive & Gearbox', 'drivetrain', {
        repair: 'garage', part: 'gearbox', critical: true, decay: 1.0,
        effects: { torque: 30, power: 12 },
    }),
    C('propeller', 'Propeller & Shaft', 'drivetrain', {
        repair: 'mobile', part: 'propeller', garageBelow: 25, critical: true, decay: 1.4,
        effects: { power: 25, torque: 20 },
    }),
    C('steering', 'Helm & Steering Cables', 'controls', {
        repair: 'mobile', part: 'steering_rack', field: true, fieldItems: ['zipties'], garageBelow: 25, critical: true, decay: 1.0,
        effects: { steering: 100 },
    }),
    C('hull', 'Hull & Stringers', 'body', {
        repair: 'garage', part: 'body_panel', field: true, fieldItems: ['ducttape'], decay: 1.0,
        effects: { traction: 20 },
    }),
    C('bilge_pump', 'Bilge Pump', 'body', {
        repair: 'mobile', part: 'bilge_pump', field: true, fieldItems: ['zipties'], decay: 1.3,
    }),
    C('windows', 'Screen & Glazing', 'body', {
        repair: 'mobile', part: 'glass_set', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
    C('lights', 'Navigation Lights', 'body', {
        repair: 'mobile', part: 'light_assembly', field: true, fieldItems: ['ducttape'], decay: 1.0,
    }),
];

/*
 * Service thresholds, by component id. Expensive workshop-only parts sit low so
 * a light knock never forces a tow; consumables sit high because a mechanic
 * would replace them long before they fail.
 */
const SERVICE_AT = {
    // workshop-only, expensive - only a real fault sends the vehicle in
    engine: 55, gaskets: 60, clutch: 55, gearbox: 55, driveshaft: 60,
    steering: 65, body: 45, hull: 45, airframe: 45,
    main_gearbox: 60, main_rotor: 65, tail_rotor: 65, tail_drive: 60,
    hydraulics: 65, propeller: 62, landing_gear: 60, turbine: 55,
    // roadside jobs
    suspension: 60, wheels: 60, chain_drive: 65, controls: 65,
    ailerons: 62, elevator: 62, rudder: 62, flaps: 60, skids: 55,
    radiator: 65, cooling: 65, fuel_system: 65, ecu: 65, ignition: 65,
    battery: 60, avionics: 62, exhaust: 60, oil_system: 60, spark_plugs: 65,
    bilge_pump: 65,
    // consumables - swapped early and often
    air_filter: 72, brake_pads: 70, brake_lines: 70, wheel_brakes: 70,
    tire: 62, tire_fl: 62, tire_fr: 62, tire_rl: 62, tire_rr: 62,
    tire_front: 62, tire_rear: 62,
    windows: 70, lights: 72,
};

AGM.Components = {
    blueprints: { car: CAR, bike: BIKE, heli: HELI, plane: PLANE, boat: BOAT },
    /* Report grouping order + display names. */
    groups: [
        { id: 'engine', label: 'Engine & Induction' },
        { id: 'drivetrain', label: 'Drivetrain' },
        { id: 'rotor', label: 'Rotor System' },
        { id: 'controls', label: 'Flight & Steering Controls' },
        { id: 'brakes', label: 'Braking' },
        { id: 'chassis', label: 'Chassis & Running Gear' },
        { id: 'tyres', label: 'Tyres' },
        { id: 'electrical', label: 'Electrical' },
        { id: 'body', label: 'Body & Structure' },
    ],
    /* Performance axes, with how far each may be dragged down at 0% health.
       1.0 would mean "no power at all", which is never any fun. */
    axes: {
        power:      { label: 'Power',            floor: 0.35 },
        torque:     { label: 'Torque',           floor: 0.40 },
        brakes:     { label: 'Braking',          floor: 0.25 },
        traction:   { label: 'Grip',             floor: 0.45 },
        steering:   { label: 'Steering',         floor: 0.45 },
        suspension: { label: 'Suspension',       floor: 0.40 },
        control:    { label: 'Control Response', floor: 0.40 },
        yaw:        { label: 'Yaw Authority',    floor: 0.35 },
        lift:       { label: 'Lift',             floor: 0.55 },
    },
    _index: {},
    _axisTotals: {},
};

/* Build lookup indexes and normalise the per-axis effect weights. */
for (const [blueprint, list] of Object.entries(AGM.Components.blueprints)) {
    const index = {};
    const totals = {};
    for (const comp of list) {
        if (SERVICE_AT[comp.id] !== undefined) comp.serviceAt = SERVICE_AT[comp.id];
        index[comp.id] = comp;
        for (const [axis, weight] of Object.entries(comp.effects)) {
            totals[axis] = (totals[axis] || 0) + weight;
        }
    }
    AGM.Components._index[blueprint] = index;
    AGM.Components._axisTotals[blueprint] = totals;
}

/** All components for a blueprint, or an empty list. */
AGM.Components.list = (blueprint) => AGM.Components.blueprints[blueprint] || [];

/** One component definition. */
AGM.Components.get = (blueprint, id) => (AGM.Components._index[blueprint] || {})[id];

/** Total effect weight on an axis, used to normalise degradation. */
AGM.Components.axisTotal = (blueprint, axis) => (AGM.Components._axisTotals[blueprint] || {})[axis] || 0;

/** Component ids for a blueprint. */
AGM.Components.ids = (blueprint) => AGM.Components.list(blueprint).map((c) => c.id);
