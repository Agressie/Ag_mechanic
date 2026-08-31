/*
 * ag_mechanic - diagnostic trouble codes
 * ============================================================================
 * What the scanner actually reads off the vehicle.
 *
 * A real OBD-II scanner cannot see a worn brake pad, a bent driveshaft or tired
 * dampers - there is no sensor watching them. So only components marked `ecu`
 * appear here, and everything else has to be found by physically inspecting the
 * vehicle. That split is the whole point: the scanner and the spanner tell you
 * different halves of the story.
 *
 * Code fields
 * -----------
 *  code      the DTC. Placeholders are filled in per vehicle: {cyl} {bank}
 *            {wheel} {n}
 *  desc      what the code means, same placeholders
 *  at        sets when the component drops below this health. Several codes on
 *            one component means the fault escalates as it gets worse.
 *  severity  'low' | 'medium' | 'high' - drives the MIL and the sort order
 *  loc       set false on a code that is not specific to one cylinder, bank or
 *            wheel, so it does not claim a sub-location it does not have
 *
 * Component fields
 * ----------------
 *  ecu       false means the scanner cannot see it at all
 *  module    which control module reports it
 *  location  how to phrase the "where": cylinder / bank / wheel / fixed
 *  where     plain-language location, for the mechanic actually looking for it
 *  codes     the codes it can set
 *
 * Namespaces differ by machine, because they do in life: road vehicles use
 * OBD-II (P/B/C/U), aircraft report BITE codes off the FADEC and flight
 * computers, and marine diesels talk J1939 SPN/FMI.
 * ============================================================================
 */

const ag_mechanic_dtc_code = (code, desc, o = {}) => Object.assign({ code, desc, at: 70, severity: 'medium' }, o);

const ag_mechanic_dtc_sys = (o) => Object.assign({ ecu: true, module: 'ECM', location: 'fixed', where: '', codes: [] }, o);

/* ------------------------------------------------------------------ modules */
/*
 * Declared in the order a scanner lists them: the system that moves the machine
 * first, body electrics last. The list is filtered per vehicle, so a boat shows
 * MARINE then BODY, and a helicopter ENGINE, ROTOR, HYDR, FLIGHT, BODY.
 */
const MODULES = [
    { id: 'ECM', label: 'Engine Control Module', short: 'ENGINE' },
    { id: 'MCU', label: 'Marine Control Unit', short: 'MARINE' },
    { id: 'TCM', label: 'Transmission Control Module', short: 'TRANS' },
    { id: 'RCU', label: 'Rotor & Drive Monitor', short: 'ROTOR' },
    { id: 'HYD', label: 'Hydraulic System Monitor', short: 'HYDR' },
    { id: 'FCU', label: 'Flight Control Unit', short: 'FLIGHT' },
    { id: 'ABS', label: 'ABS / Stability Control', short: 'ABS' },
    { id: 'EPS', label: 'Power Steering Module', short: 'STEER' },
    { id: 'BCM', label: 'Body Control Module', short: 'BODY' },
];

/* ------------------------------------------------------- road vehicles (OBD-II) */
const CAR_DTC = {
    engine: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'cylinder',
        where: 'Engine bay - cylinder head and block',
        codes: [
            ag_mechanic_dtc_code('P0300', 'Random / multiple cylinder misfire detected', { at: 72, severity: 'medium', loc: false }),
            ag_mechanic_dtc_code('P030{cyl}', 'Cylinder {cyl} misfire detected', { at: 55, severity: 'high' }),
            ag_mechanic_dtc_code('P0016', 'Crankshaft / camshaft position correlation, bank {bank}', { at: 25, severity: 'high' }),
            ag_mechanic_dtc_code('P0326', 'Knock sensor 1 circuit range / performance, bank {bank}', { at: 40, severity: 'medium' }),
        ],
    }),
    gaskets: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'bank',
        where: 'Engine bay - between head and block, bank {bank}',
        codes: [
            ag_mechanic_dtc_code('P0217', 'Engine over-temperature condition', { at: 65, severity: 'high' }),
            ag_mechanic_dtc_code('P2183', 'Engine coolant temperature sensor 2 circuit range', { at: 45, severity: 'medium' }),
            ag_mechanic_dtc_code('P0301', 'Cylinder 1 misfire - suspected compression loss', { at: 22, severity: 'high', loc: false }),
        ],
    }),
    air_filter: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'bank',
        where: 'Airbox, top of engine bay',
        codes: [
            ag_mechanic_dtc_code('P0101', 'Mass air flow sensor circuit range / performance', { at: 72, severity: 'low' }),
            ag_mechanic_dtc_code('P0171', 'Fuel trim system too lean, bank {bank}', { at: 50, severity: 'medium' }),
            ag_mechanic_dtc_code('P0102', 'Mass air flow sensor circuit low input', { at: 25, severity: 'medium' }),
        ],
    }),
    spark_plugs: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'cylinder',
        where: 'Coil pack on cylinder {cyl}, under the ignition cover',
        codes: [
            ag_mechanic_dtc_code('P035{cyl}', 'Ignition coil {cyl} primary / secondary circuit', { at: 65, severity: 'medium' }),
            ag_mechanic_dtc_code('P030{cyl}', 'Cylinder {cyl} misfire detected', { at: 45, severity: 'high' }),
        ],
    }),
    oil_system: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'fixed',
        where: 'Sump and filter housing, underside of the engine',
        codes: [
            ag_mechanic_dtc_code('P0521', 'Engine oil pressure sensor range / performance', { at: 60, severity: 'medium' }),
            ag_mechanic_dtc_code('P0524', 'Engine oil pressure too low', { at: 30, severity: 'high' }),
            ag_mechanic_dtc_code('P06DD', 'Engine oil pressure control circuit - stuck off', { at: 12, severity: 'high' }),
        ],
    }),
    radiator: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'fixed',
        where: 'Front of the engine bay, behind the grille',
        codes: [
            ag_mechanic_dtc_code('P0128', 'Coolant thermostat below regulating temperature', { at: 68, severity: 'low' }),
            ag_mechanic_dtc_code('P0480', 'Cooling fan 1 control circuit', { at: 45, severity: 'medium' }),
            ag_mechanic_dtc_code('P0217', 'Engine over-temperature condition', { at: 25, severity: 'high' }),
        ],
    }),
    fuel_system: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'fixed',
        where: 'In-tank pump, and the lines along the underfloor',
        codes: [
            ag_mechanic_dtc_code('P0171', 'Fuel trim system too lean, bank {bank}', { at: 68, severity: 'medium' }),
            ag_mechanic_dtc_code('P0087', 'Fuel rail / system pressure too low', { at: 45, severity: 'high' }),
            ag_mechanic_dtc_code('P0230', 'Fuel pump primary circuit malfunction', { at: 18, severity: 'high' }),
        ],
    }),
    exhaust: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'bank',
        where: 'Manifold and downpipe, underside on bank {bank}',
        codes: [
            ag_mechanic_dtc_code('P0420', 'Catalyst system efficiency below threshold, bank {bank}', { at: 62, severity: 'low' }),
            ag_mechanic_dtc_code('P0135', 'O2 sensor heater circuit, bank {bank} sensor 1', { at: 40, severity: 'medium' }),
            ag_mechanic_dtc_code('P0455', 'Evaporative emission system leak detected - gross leak', { at: 20, severity: 'medium' }),
        ],
    }),
    ecu: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'fixed',
        where: 'ECU and loom behind the bulkhead, passenger side',
        codes: [
            ag_mechanic_dtc_code('P0606', 'ECM / PCM processor fault', { at: 60, severity: 'high' }),
            ag_mechanic_dtc_code('U0100', 'Lost communication with ECM / PCM', { at: 30, severity: 'high' }),
            ag_mechanic_dtc_code('P0605', 'Internal control module ROM error', { at: 12, severity: 'high' }),
        ],
    }),
    battery: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'fixed',
        where: 'Battery tray and alternator belt run',
        codes: [
            ag_mechanic_dtc_code('P0562', 'System voltage low', { at: 58, severity: 'medium' }),
            ag_mechanic_dtc_code('P0620', 'Generator control circuit malfunction', { at: 35, severity: 'high' }),
            ag_mechanic_dtc_code('U0155', 'Lost communication with instrument cluster', { at: 12, severity: 'medium' }),
        ],
    }),
    clutch: ag_mechanic_dtc_sys({
        module: 'TCM', location: 'fixed',
        where: 'Bellhousing, between engine and gearbox',
        codes: [
            ag_mechanic_dtc_code('P0810', 'Clutch position control error', { at: 55, severity: 'medium' }),
            ag_mechanic_dtc_code('P1870', 'Transmission component slipping', { at: 30, severity: 'high' }),
        ],
    }),
    gearbox: ag_mechanic_dtc_sys({
        module: 'TCM', location: 'fixed',
        where: 'Transmission tunnel, behind the engine',
        codes: [
            ag_mechanic_dtc_code('P0700', 'Transmission control system - MIL request', { at: 55, severity: 'medium' }),
            ag_mechanic_dtc_code('P0730', 'Incorrect gear ratio', { at: 40, severity: 'high' }),
            ag_mechanic_dtc_code('P0715', 'Input / turbine speed sensor circuit', { at: 18, severity: 'high' }),
        ],
    }),
    brake_lines: ag_mechanic_dtc_sys({
        module: 'ABS', location: 'fixed',
        where: 'Master cylinder on the bulkhead, and the hard lines to each corner',
        codes: [
            ag_mechanic_dtc_code('C0110', 'ABS pump motor circuit malfunction', { at: 62, severity: 'medium' }),
            ag_mechanic_dtc_code('C0265', 'ABS relay circuit / brake pressure low', { at: 35, severity: 'high' }),
        ],
    }),
    steering: ag_mechanic_dtc_sys({
        module: 'EPS', location: 'fixed',
        where: 'Steering rack behind the front subframe',
        codes: [
            ag_mechanic_dtc_code('C0051', 'Steering wheel position sensor circuit', { at: 62, severity: 'medium' }),
            ag_mechanic_dtc_code('C1511', 'Power steering assist reduced or disabled', { at: 35, severity: 'high' }),
        ],
    }),
    lights: ag_mechanic_dtc_sys({
        module: 'BCM', location: 'fixed',
        where: 'Lamp units front and rear',
        codes: [
            ag_mechanic_dtc_code('B1201', 'Exterior lamp circuit failure - lamp out detected', { at: 70, severity: 'low' }),
            ag_mechanic_dtc_code('B2AA0', 'Multiple lighting circuit failures', { at: 30, severity: 'medium' }),
        ],
    }),

    /* Wheel-speed sensors are how a modern car notices a tyre going down. */
    tire_fl: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Left front wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0035', 'Left front wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0031', 'Left front tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),
    tire_fr: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Right front wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0040', 'Right front wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0036', 'Right front tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),
    tire_rl: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Left rear wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0045', 'Left rear wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0041', 'Left rear tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),
    tire_rr: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Right rear wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0050', 'Right rear wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0046', 'Right rear tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),

    /* --- nothing is watching these, so the scanner never sees them --- */
    driveshaft: ag_mechanic_dtc_sys({ ecu: false, where: 'Underfloor, centre tunnel and rear diff' }),
    brake_pads: ag_mechanic_dtc_sys({ ecu: false, where: 'Behind each wheel, on the caliper' }),
    suspension: ag_mechanic_dtc_sys({ ecu: false, where: 'Each corner - springs, dampers and top mounts' }),
    wheels: ag_mechanic_dtc_sys({ ecu: false, where: 'Rims, hubs and bearings' }),
    body: ag_mechanic_dtc_sys({ ecu: false, where: 'Panels, frame rails and crash structure' }),
    windows: ag_mechanic_dtc_sys({ ecu: false, where: 'Screen and side glass' }),
};

/* Bikes: same electronics, different plumbing. */
const BIKE_DTC = Object.assign({}, CAR_DTC, {
    engine: ag_mechanic_dtc_sys({
        module: 'ECM', location: 'cylinder',
        where: 'Engine, under the tank',
        codes: [
            ag_mechanic_dtc_code('P0300', 'Random / multiple cylinder misfire detected', { at: 72, severity: 'medium', loc: false }),
            ag_mechanic_dtc_code('P030{cyl}', 'Cylinder {cyl} misfire detected', { at: 55, severity: 'high' }),
            ag_mechanic_dtc_code('P0335', 'Crankshaft position sensor circuit', { at: 25, severity: 'high', loc: false }),
        ],
    }),
    chain_drive: ag_mechanic_dtc_sys({
        module: 'TCM', location: 'fixed',
        where: 'Final drive - front and rear sprockets, left side',
        codes: [
            ag_mechanic_dtc_code('P0500', 'Vehicle speed sensor - signal erratic', { at: 60, severity: 'medium' }),
            ag_mechanic_dtc_code('P1870', 'Final drive slip detected', { at: 30, severity: 'high' }),
        ],
    }),
    tire_front: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Front wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0035', 'Front wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0031', 'Front tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),
    tire_rear: ag_mechanic_dtc_sys({ module: 'ABS', location: 'wheel', where: 'Rear wheel and hub sensor', codes: [
        ag_mechanic_dtc_code('C0045', 'Rear wheel speed sensor circuit', { at: 55, severity: 'medium' }),
        ag_mechanic_dtc_code('C0041', 'Rear tyre pressure below threshold', { at: 30, severity: 'high' }),
    ] }),
});
/* A bike has a chain and two wheels, not a driveshaft and four. */
delete BIKE_DTC.driveshaft;
delete BIKE_DTC.tire_fl;
delete BIKE_DTC.tire_fr;
delete BIKE_DTC.tire_rl;
delete BIKE_DTC.tire_rr;

/* --------------------------------------------------- rotorcraft (BITE codes) */
const HELI_DTC = {
    engine: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Engine deck, behind the main cowling', codes: [
        ag_mechanic_dtc_code('ENG-014', 'N1 speed signal intermittent', { at: 70, severity: 'medium' }),
        ag_mechanic_dtc_code('ENG-041', 'Turbine gas temperature exceedance recorded', { at: 50, severity: 'high' }),
        ag_mechanic_dtc_code('ENG-002', 'FADEC channel A degraded', { at: 22, severity: 'high' }),
    ] }),
    air_filter: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Particle separator on the intake plenum', codes: [
        ag_mechanic_dtc_code('ENG-108', 'Inlet particle separator restriction', { at: 70, severity: 'low' }),
        ag_mechanic_dtc_code('ENG-112', 'Compressor inlet pressure low', { at: 40, severity: 'medium' }),
    ] }),
    oil_system: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Engine and transmission oil coolers, upper deck', codes: [
        ag_mechanic_dtc_code('ENG-055', 'Engine oil pressure low', { at: 60, severity: 'high' }),
        ag_mechanic_dtc_code('ENG-061', 'Engine and transmission oil temperature high', { at: 35, severity: 'high' }),
    ] }),
    fuel_system: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Fuel cells under the cabin floor, boost pumps aft', codes: [
        ag_mechanic_dtc_code('FUE-021', 'Boost pump 1 output low', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('FUE-030', 'Fuel pressure below minimum', { at: 35, severity: 'high' }),
    ] }),
    ignition: ag_mechanic_dtc_sys({ module: 'ECM', where: 'FADEC and igniter box on the firewall', codes: [
        ag_mechanic_dtc_code('ENG-071', 'Igniter unit 2 no output', { at: 62, severity: 'medium' }),
        ag_mechanic_dtc_code('ENG-003', 'FADEC dual channel fault', { at: 25, severity: 'high' }),
    ] }),
    battery: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Battery bay in the nose, generator on the accessory case', codes: [
        ag_mechanic_dtc_code('ELE-011', 'DC bus voltage low', { at: 58, severity: 'medium' }),
        ag_mechanic_dtc_code('ELE-019', 'Generator offline', { at: 30, severity: 'high' }),
    ] }),
    avionics: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Avionics rack behind the instrument panel', codes: [
        ag_mechanic_dtc_code('AVI-004', 'Attitude reference disagreement', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('AVI-022', 'Air data computer no output', { at: 32, severity: 'high' }),
    ] }),
    main_gearbox: ag_mechanic_dtc_sys({ module: 'RCU', where: 'Main gearbox on the cabin roof', codes: [
        ag_mechanic_dtc_code('RTR-030', 'Main gearbox chip detector triggered', { at: 62, severity: 'high' }),
        ag_mechanic_dtc_code('RTR-034', 'Main gearbox oil pressure low', { at: 35, severity: 'high' }),
        ag_mechanic_dtc_code('RTR-039', 'Torque limit exceedance recorded', { at: 20, severity: 'high' }),
    ] }),
    main_rotor: ag_mechanic_dtc_sys({ module: 'RCU', location: 'blade', where: 'Main rotor head and blade {n}', codes: [
        ag_mechanic_dtc_code('RTR-112', 'Main rotor track out of limits, blade {n}', { at: 68, severity: 'medium' }),
        ag_mechanic_dtc_code('RTR-118', 'Main rotor imbalance - vibration above limit', { at: 40, severity: 'high' }),
    ] }),
    tail_rotor: ag_mechanic_dtc_sys({ module: 'RCU', location: 'blade', where: 'Tail rotor head, blade {n}', codes: [
        ag_mechanic_dtc_code('RTR-140', 'Tail rotor pitch feedback fault', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('RTR-148', 'Tail rotor imbalance - vibration above limit', { at: 35, severity: 'high' }),
    ] }),
    tail_drive: ag_mechanic_dtc_sys({ module: 'RCU', where: 'Tail drive shaft along the boom, hanger bearings', codes: [
        ag_mechanic_dtc_code('RTR-155', 'Tail drive shaft hanger bearing wear', { at: 62, severity: 'medium' }),
        ag_mechanic_dtc_code('RTR-160', 'Intermediate gearbox chip detector triggered', { at: 30, severity: 'high' }),
    ] }),
    hydraulics: ag_mechanic_dtc_sys({ module: 'HYD', where: 'Hydraulic pack and swashplate, above the cabin', codes: [
        ag_mechanic_dtc_code('HYD-002', 'System 1 pressure below minimum', { at: 65, severity: 'high' }),
        ag_mechanic_dtc_code('HYD-011', 'Servo actuator response out of tolerance', { at: 35, severity: 'high' }),
    ] }),
    controls: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Cyclic and collective linkages under the floor', codes: [
        ag_mechanic_dtc_code('FLT-020', 'Collective position sensor range', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('FLT-028', 'Control linkage free play above limit', { at: 32, severity: 'high' }),
    ] }),
    skids: ag_mechanic_dtc_sys({ ecu: false, where: 'Landing skids and cross tubes' }),
    airframe: ag_mechanic_dtc_sys({ ecu: false, where: 'Airframe, tail boom attachment points' }),
    windows: ag_mechanic_dtc_sys({ ecu: false, where: 'Canopy and cabin glazing' }),
    lights: ag_mechanic_dtc_sys({ module: 'BCM', where: 'Nav, anti-collision and landing lamps', codes: [
        ag_mechanic_dtc_code('ELE-041', 'Anti-collision light circuit open', { at: 70, severity: 'low' }),
    ] }),
};

/* ---------------------------------------------------- fixed-wing (BITE codes) */
const PLANE_DTC = {
    engine: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Engine, forward of the firewall', codes: [
        ag_mechanic_dtc_code('ENG-014', 'N1 / RPM signal intermittent', { at: 70, severity: 'medium' }),
        ag_mechanic_dtc_code('ENG-045', 'Cylinder head / turbine temperature exceedance', { at: 48, severity: 'high', loc: false }),
        ag_mechanic_dtc_code('ENG-002', 'Engine control channel degraded', { at: 22, severity: 'high' }),
    ] }),
    air_filter: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Induction airbox behind the cowl inlet', codes: [
        ag_mechanic_dtc_code('ENG-108', 'Induction air restriction - alternate air in use', { at: 70, severity: 'low' }),
        ag_mechanic_dtc_code('ENG-112', 'Manifold pressure below expected', { at: 40, severity: 'medium' }),
    ] }),
    ignition: ag_mechanic_dtc_sys({ module: 'ECM', location: 'cylinder', where: 'Magneto and plug leads, cylinder {cyl}', codes: [
        ag_mechanic_dtc_code('IGN-03{cyl}', 'Ignition unit {cyl} weak or intermittent', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('IGN-002', 'Dual magneto drop out of limits', { at: 28, severity: 'high', loc: false }),
    ] }),
    oil_system: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Oil cooler and filter, lower cowling', codes: [
        ag_mechanic_dtc_code('ENG-055', 'Oil pressure low', { at: 60, severity: 'high' }),
        ag_mechanic_dtc_code('ENG-058', 'Oil temperature above limit', { at: 32, severity: 'high' }),
    ] }),
    fuel_system: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Wing tanks, boost pumps and selector', codes: [
        ag_mechanic_dtc_code('FUE-021', 'Boost pump output low', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('FUE-030', 'Fuel pressure below minimum', { at: 35, severity: 'high' }),
    ] }),
    propeller: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Propeller hub and governor, on the nose', codes: [
        ag_mechanic_dtc_code('PRP-010', 'Propeller governor response out of tolerance', { at: 62, severity: 'medium' }),
        ag_mechanic_dtc_code('PRP-018', 'Propeller imbalance - vibration above limit', { at: 32, severity: 'high' }),
    ] }),
    battery: ag_mechanic_dtc_sys({ module: 'ECM', where: 'Battery box aft of the baggage bay', codes: [
        ag_mechanic_dtc_code('ELE-011', 'Bus voltage low', { at: 58, severity: 'medium' }),
        ag_mechanic_dtc_code('ELE-019', 'Alternator offline', { at: 30, severity: 'high' }),
    ] }),
    avionics: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Avionics stack in the panel', codes: [
        ag_mechanic_dtc_code('AVI-004', 'Attitude reference disagreement', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('AVI-022', 'Air data computer no output', { at: 32, severity: 'high' }),
    ] }),
    hydraulics: ag_mechanic_dtc_sys({ module: 'HYD', where: 'Hydraulic pack, forward of the wing spar', codes: [
        ag_mechanic_dtc_code('HYD-002', 'System pressure below minimum', { at: 65, severity: 'high' }),
        ag_mechanic_dtc_code('HYD-011', 'Actuator response out of tolerance', { at: 35, severity: 'high' }),
    ] }),
    ailerons: ag_mechanic_dtc_sys({ module: 'FCU', location: 'wing', where: 'Aileron and linkage, {wing} wing', codes: [
        ag_mechanic_dtc_code('FLT-040', 'Roll surface position disagreement, {wing}', { at: 62, severity: 'medium' }),
        ag_mechanic_dtc_code('FLT-044', 'Aileron free play above limit', { at: 32, severity: 'high' }),
    ] }),
    elevator: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Elevator and trim, on the tailplane', codes: [
        ag_mechanic_dtc_code('FLT-050', 'Pitch surface position disagreement', { at: 62, severity: 'high' }),
        ag_mechanic_dtc_code('FLT-054', 'Elevator control jam detected', { at: 25, severity: 'high' }),
    ] }),
    rudder: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Rudder and cables, in the fin', codes: [
        ag_mechanic_dtc_code('FLT-060', 'Yaw surface position disagreement', { at: 62, severity: 'medium' }),
        ag_mechanic_dtc_code('FLT-064', 'Rudder cable tension below limit', { at: 32, severity: 'high' }),
    ] }),
    flaps: ag_mechanic_dtc_sys({ module: 'FCU', where: 'Flap tracks, inboard trailing edge', codes: [
        ag_mechanic_dtc_code('FLT-070', 'Flap asymmetry detected', { at: 62, severity: 'high' }),
    ] }),
    landing_gear: ag_mechanic_dtc_sys({ module: 'HYD', where: 'Gear legs and actuators', codes: [
        ag_mechanic_dtc_code('GER-010', 'Gear position disagreement', { at: 62, severity: 'high' }),
        ag_mechanic_dtc_code('GER-018', 'Gear actuator slow to travel', { at: 32, severity: 'medium' }),
    ] }),
    wheel_brakes: ag_mechanic_dtc_sys({ ecu: false, where: 'Brake units on each main wheel' }),
    airframe: ag_mechanic_dtc_sys({ ecu: false, where: 'Wings, spars and fuselage structure' }),
    windows: ag_mechanic_dtc_sys({ ecu: false, where: 'Canopy and windscreen' }),
    lights: ag_mechanic_dtc_sys({ module: 'BCM', where: 'Nav, strobe and landing lamps', codes: [
        ag_mechanic_dtc_code('ELE-041', 'Strobe / nav light circuit open', { at: 70, severity: 'low' }),
    ] }),
};

/* ------------------------------------------------ marine diesel (J1939 SPN/FMI) */
const BOAT_DTC = {
    engine: ag_mechanic_dtc_sys({ module: 'MCU', location: 'cylinder', where: 'Engine bay', codes: [
        ag_mechanic_dtc_code('SPN 190 FMI 16', 'Engine speed above normal - operating range high', { at: 70, severity: 'medium', loc: false }),
        ag_mechanic_dtc_code('SPN 65{cyl} FMI 7', 'Cylinder {cyl} injector - mechanical system not responding', { at: 50, severity: 'high' }),
        ag_mechanic_dtc_code('SPN 110 FMI 0', 'Engine coolant temperature above normal - extremely severe', { at: 22, severity: 'high', loc: false }),
    ] }),
    air_filter: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Flame arrestor on the intake', codes: [
        ag_mechanic_dtc_code('SPN 107 FMI 0', 'Air filter differential pressure above normal', { at: 70, severity: 'low' }),
        ag_mechanic_dtc_code('SPN 102 FMI 1', 'Intake manifold pressure below normal', { at: 40, severity: 'medium' }),
    ] }),
    ignition: ag_mechanic_dtc_sys({ module: 'MCU', location: 'cylinder', where: 'Coil and plug on cylinder {cyl}', codes: [
        ag_mechanic_dtc_code('SPN 63{cyl} FMI 5', 'Cylinder {cyl} ignition circuit - current below normal', { at: 65, severity: 'medium' }),
    ] }),
    oil_system: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Sump, filter and cooler, low in the bilge', codes: [
        ag_mechanic_dtc_code('SPN 100 FMI 1', 'Engine oil pressure below normal - most severe', { at: 60, severity: 'high' }),
        ag_mechanic_dtc_code('SPN 175 FMI 0', 'Engine oil temperature above normal', { at: 32, severity: 'high' }),
    ] }),
    cooling: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Raw water pump and impeller, on the engine front', codes: [
        ag_mechanic_dtc_code('SPN 110 FMI 16', 'Engine coolant temperature above normal - moderately severe', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('SPN 109 FMI 1', 'Coolant pressure below normal', { at: 30, severity: 'high' }),
    ] }),
    fuel_system: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Lift pump, filter and lines to the tank', codes: [
        ag_mechanic_dtc_code('SPN 94 FMI 1', 'Fuel delivery pressure below normal', { at: 65, severity: 'medium' }),
        ag_mechanic_dtc_code('SPN 97 FMI 0', 'Water in fuel indicator', { at: 35, severity: 'high' }),
    ] }),
    battery: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Battery bank and alternator', codes: [
        ag_mechanic_dtc_code('SPN 168 FMI 1', 'Battery potential below normal', { at: 58, severity: 'medium' }),
        ag_mechanic_dtc_code('SPN 167 FMI 1', 'Charging system potential below normal', { at: 30, severity: 'high' }),
    ] }),
    ecu: ag_mechanic_dtc_sys({ module: 'MCU', where: 'ECU and harness on the engine bulkhead', codes: [
        ag_mechanic_dtc_code('SPN 639 FMI 2', 'J1939 network - data erratic', { at: 60, severity: 'medium' }),
        ag_mechanic_dtc_code('SPN 629 FMI 12', 'Controller internal failure', { at: 25, severity: 'high' }),
    ] }),
    gearbox: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Outdrive and gear case, on the transom', codes: [
        ag_mechanic_dtc_code('SPN 127 FMI 1', 'Transmission oil pressure below normal', { at: 60, severity: 'high' }),
        ag_mechanic_dtc_code('SPN 177 FMI 0', 'Transmission oil temperature above normal', { at: 32, severity: 'high' }),
    ] }),
    propeller: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Propeller and shaft, below the transom', codes: [
        ag_mechanic_dtc_code('SPN 190 FMI 15', 'Engine overspeed - suspected prop slip or damage', { at: 62, severity: 'medium' }),
    ] }),
    steering: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Helm and steering cylinder, at the transom', codes: [
        ag_mechanic_dtc_code('SPN 1856 FMI 2', 'Steering position signal erratic', { at: 62, severity: 'high' }),
    ] }),
    hull: ag_mechanic_dtc_sys({ ecu: false, where: 'Hull, stringers and transom' }),
    bilge_pump: ag_mechanic_dtc_sys({ module: 'MCU', where: 'Bilge, lowest point of the hull', codes: [
        ag_mechanic_dtc_code('SPN 96 FMI 3', 'Bilge pump circuit - voltage above normal', { at: 65, severity: 'medium' }),
    ] }),
    windows: ag_mechanic_dtc_sys({ ecu: false, where: 'Screen and side glazing' }),
    lights: ag_mechanic_dtc_sys({ module: 'BCM', where: 'Navigation lamps', codes: [
        ag_mechanic_dtc_code('SPN 2000 FMI 5', 'Navigation lamp circuit open', { at: 70, severity: 'low' }),
    ] }),
};

/*
 * Diagnostic devices
 * ----------------------------------------------------------------------------
 * A car scan tool speaks OBD-II over CAN. It cannot talk to an aircraft, which
 * reports built-in-test faults over ARINC, or to a marine diesel on J1939. So
 * they are separate tools, and bringing the wrong one to a job gets you nothing.
 *
 * Each device carries its own vocabulary, because the trades do not use the same
 * words: a car has stored codes on modules, an aircraft has active faults on
 * LRUs, a boat has active DTCs on ECUs. The firmware reads off `lexicon`, so the
 * three devices genuinely feel like different instruments.
 *
 * To merge or split devices, edit `blueprints` here - nothing else needs to
 * change.
 */
const DEVICES = [
    {
        id: 'obd',
        item: 'obd_scanner',
        label: 'OBD-II Scan Tool',
        model: 'AGM-9000',
        bus: 'OBD-II / CAN',
        protocol: 'ISO 15765-4 CAN 11/500',
        blueprints: ['car', 'bike'],
        port: 'the diagnostic port',
        lexicon: {
            codes: 'STORED CODES',
            pending: 'PENDING CODES',
            systems: 'SYSTEM SCAN',
            system: 'MODULE',
            code: 'CODE',
            lamp: 'MIL',
            live: 'LIVE DATA',
            frame: 'FREEZE FRAME',
            monitors: 'I/M MONITORS',
        },
    },
    {
        id: 'bite',
        item: 'bite_tester',
        label: 'Avionics BITE Test Set',
        model: 'AV-4',
        bus: 'ARINC 429',
        protocol: 'ARINC 429 / BITE',
        blueprints: ['heli', 'plane'],
        port: 'the maintenance data port',
        lexicon: {
            codes: 'ACTIVE FAULTS',
            pending: 'INTERMITTENT',
            systems: 'LRU SCAN',
            system: 'LRU',
            code: 'FAULT',
            lamp: 'CAUTION',
            live: 'PARAMETERS',
            frame: 'SNAPSHOT',
            monitors: 'BITE STATUS',
        },
    },
    {
        id: 'marine',
        item: 'marine_diagnostic',
        label: 'Marine Diagnostic Tool',
        model: 'MD-2',
        bus: 'SAE J1939',
        protocol: 'SAE J1939 250k',
        blueprints: ['boat'],
        port: 'the engine loom connector',
        lexicon: {
            codes: 'ACTIVE DTCs',
            pending: 'INACTIVE DTCs',
            systems: 'ECU SCAN',
            system: 'ECU',
            code: 'DTC',
            lamp: 'WARN',
            live: 'LIVE DATA',
            frame: 'SNAPSHOT',
            monitors: 'SELF TEST',
        },
    },
];

AGM.Dtc = {
    modules: MODULES,
    devices: DEVICES,
    sets: { car: CAR_DTC, bike: BIKE_DTC, heli: HELI_DTC, plane: PLANE_DTC, boat: BOAT_DTC },
};

/** The tool that can talk to this machine, or undefined. */
AGM.Dtc.deviceFor = (blueprint) => DEVICES.find((d) => d.blueprints.includes(blueprint));

/** The tool a given inventory item is, or undefined. */
AGM.Dtc.deviceByItem = (item) => DEVICES.find((d) => d.item === item);

/** Every diagnostic device item, for inventory filters. */
AGM.Dtc.deviceItems = () => DEVICES.map((d) => d.item);

/** DTC definition for a component, or undefined. */
AGM.Dtc.get = (blueprint, componentId) => (AGM.Dtc.sets[blueprint] || {})[componentId];

/** Can the scanner see this component at all? */
AGM.Dtc.visible = function (blueprint, componentId) {
    const entry = AGM.Dtc.get(blueprint, componentId);
    return !!entry && entry.ecu !== false && entry.codes.length > 0;
};

/** Every component the scanner can read on this machine. */
AGM.Dtc.visibleComponents = function (blueprint) {
    return AGM.Components.ids(blueprint).filter((id) => AGM.Dtc.visible(blueprint, id));
};

/** Plain-language location for a component, placeholders unresolved. */
AGM.Dtc.where = function (blueprint, componentId) {
    const entry = AGM.Dtc.get(blueprint, componentId);
    return entry ? entry.where : '';
};

AGM.Dtc.module = function (blueprint, componentId) {
    const entry = AGM.Dtc.get(blueprint, componentId);
    return entry && entry.module ? entry.module : 'ECM';
};

AGM.Dtc.moduleLabel = function (id) {
    const found = MODULES.find((m) => m.id === id);
    return found ? found.label : id;
};

AGM.Dtc.protocol = function (blueprint) {
    const device = AGM.Dtc.deviceFor(blueprint);
    return device ? device.protocol : 'ISO 15765-4 CAN';
};

