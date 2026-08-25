/*
 * Fixtures for working on the UI in a plain browser (`npm run dev`, then
 * ?screen=report / ?screen=tablet / ?screen=upgrades / ?screen=diagnose).
 * Never used in game: App.svelte only reaches for these when window.invokeNative
 * is absent.
 */

export const devTablet = () => ({
    user: { name: 'Jesse Colt', citizenid: 'ABC12345', grade: 4, gradeLabel: 'Owner' },
    shop: { id: 'lamesa', label: 'La Mesa Auto Works' },
    startApp: 'home',
    apps: [
        { id: 'home', label: 'Home', icon: 'grid', grade: 0 },
        { id: 'personnel', label: 'Personnel', icon: 'users', grade: 0 },
        { id: 'inventory', label: 'Stash', icon: 'box', grade: 0 },
        { id: 'shop', label: 'Parts Shop', icon: 'cart', grade: 0 },
    ],
    can: { hire: true, fire: true, promote: true, order: true, stashTake: true, stashPut: true },
});

export const devReport = () => ({
    isMechanic: true,
    canRepair: true,
    report: {
        plate: 'AG 44 XZ',
        blueprintLabel: 'Automobile',
        quality: 'good',
        scanned: Date.now(),
        inspected: true,
        coverage: { known: 22, total: 25 },
        overall: 71.4,
        overallBand: 'good',
        odometer: 48213,
        summary: 'Needs a lift and a workshop - it will have to be brought in.',
        symptoms: [
            { label: 'Held on the rev limiter', count: 3 },
            { label: 'Excessive wheelspin', count: 2 },
        ],
        triage: { mobile: ['radiator', 'brake_pads'], garage: ['clutch'], tow: true },
        revealed: ['engine', 'clutch', 'radiator', 'brake_pads', 'tire_rl'],
        groups: [
            {
                id: 'engine', label: 'Engine & Induction', items: [
                    { id: 'engine', label: 'Engine Block & Internals', critical: true, dead: false, required: false, method: 'garage', part: 'engine_block', partLabel: 'Engine Assembly', field: false, fieldItems: [], health: 63.5, band: 'worn', bandLabel: 'Worn', unknown: false, source: 'scan', where: 'Engine bay - cylinder head and block', scannable: true, codes: [{ code: 'P0300', desc: 'Random / multiple cylinder misfire detected', status: 'stored', severity: 'medium' }] },
                    { id: 'radiator', label: 'Radiator, Fan & Coolant', critical: false, dead: false, required: true, method: 'mobile', part: 'radiator', partLabel: 'Radiator & Coolant', field: true, fieldItems: ['ducttape'], health: 31.2, band: 'poor', bandLabel: 'Poor', unknown: false, source: 'scan', where: 'Front of the engine bay, behind the grille', scannable: true, codes: [{ code: 'P0217', desc: 'Engine over-temperature condition', status: 'stored', severity: 'high' }, { code: 'P0480', desc: 'Cooling fan 1 control circuit', status: 'stored', severity: 'medium' }] },
                ],
            },
            {
                id: 'drivetrain', label: 'Drivetrain', items: [
                    { id: 'clutch', label: 'Clutch & Flywheel', critical: true, dead: false, required: true, method: 'garage', part: 'clutch_kit', partLabel: 'Clutch & Flywheel Kit', field: false, fieldItems: [], health: 18.9, band: 'poor', bandLabel: 'Poor', unknown: false, source: 'scan', where: 'Bellhousing, between engine and gearbox', scannable: true, codes: [{ code: 'P1870', desc: 'Transmission component slipping', status: 'stored', severity: 'high' }] },
                    { id: 'driveshaft', label: 'Driveshaft & Differential', critical: true, dead: false, required: true, method: 'garage', part: 'driveshaft', partLabel: 'Driveshaft & Differential', field: false, fieldItems: [], health: 41.0, band: 'worn', bandLabel: 'Worn', unknown: false, source: 'inspection', where: 'Underfloor, centre tunnel and rear diff', scannable: false, codes: [] },
                ],
            },
            {
                id: 'brakes', label: 'Braking', items: [
                    { id: 'brake_pads', label: 'Brake Pads & Discs', critical: false, dead: false, required: true, method: 'mobile', part: 'brake_pads', partLabel: 'Brake Pads & Discs', field: false, fieldItems: [], health: 22.0, band: 'poor', bandLabel: 'Poor', unknown: false, source: 'inspection', where: 'Behind each wheel, on the caliper', scannable: false, codes: [] },
                ],
            },
            {
                id: 'tyres', label: 'Tyres', items: [
                    { id: 'tire_rl', label: 'Rear Left Tyre', critical: false, dead: true, required: true, method: 'mobile', part: 'tire', partLabel: 'Tyre', field: true, fieldItems: ['ducttape'], health: 0, band: 'dead', bandLabel: 'Failed', unknown: false, source: 'scan', where: 'Left rear wheel and hub sensor', scannable: true, codes: [{ code: 'C0041', desc: 'Left rear tyre pressure below threshold', status: 'stored', severity: 'high' }] },
                    { id: 'tire_rr', label: 'Rear Right Tyre', critical: false, dead: false, required: false, method: 'mobile', part: 'tire', partLabel: 'Tyre', field: true, fieldItems: ['ducttape'], health: null, band: 'good', bandLabel: 'Good', unknown: false, source: 'scan', where: 'Right rear wheel and hub sensor', scannable: true, codes: [] },
                    { id: 'suspension', label: 'Suspension, Springs & Dampers', critical: false, dead: false, required: false, method: 'mobile', part: 'suspension_kit', partLabel: 'Suspension & Damper Kit', field: false, fieldItems: [], health: null, band: null, bandLabel: null, unknown: true, source: null, where: 'Each corner - springs, dampers and top mounts', scannable: false, codes: [] },
                ],
            },
        ],
    },
});

export const devUpgrades = () => ({
    plate: 'AG 44 XZ',
    blueprintLabel: 'Automobile',
    inBay: false,
    performance: { power: 1.08, torque: 1.02, brakes: 0.91, traction: 0.96, steering: 1, suspension: 1.1 },
    categories: [
        {
            id: 'brakes', label: 'Brakes', native: true, current: 1, tiers: [
                { index: 0, label: 'Factory Brakes', blurb: 'Whatever the factory bolted on. Adequate, once.', item: null, itemLabel: null, labour: 0, install: 'mobile', fitted: false, have: true, perf: {} },
                { index: 1, label: 'Steel Brakes', blurb: 'Drilled steel discs and organic pads. Honest and cheap.', item: 'brakes_steel', itemLabel: 'Steel Brake Kit', labour: 250, install: 'mobile', fitted: true, have: true, perf: { brakes: 1.08 } },
                { index: 2, label: 'Titanium Brakes', blurb: 'Titanium-backed pads on a floating disc. Fade barely exists.', item: 'brakes_titanium', itemLabel: 'Titanium Brake Kit', labour: 600, install: 'mobile', fitted: false, have: false, perf: { brakes: 1.18 } },
                { index: 3, label: 'Carbon Fibre Brakes', blurb: 'Carbon-ceramic. Cold they are useless, hot they are violent.', item: 'brakes_carbon', itemLabel: 'Carbon Fibre Brake Kit', labour: 1400, install: 'garage', fitted: false, have: true, perf: { brakes: 1.3 } },
            ],
        },
        {
            id: 'chassis', label: 'Chassis & Armour', native: true, current: 0, tiers: [
                { index: 0, label: 'Factory Chassis', blurb: 'Spot welds and good intentions.', item: null, labour: 0, install: 'mobile', fitted: true, have: true, perf: {} },
                { index: 1, label: 'Welded Roll Cage', blurb: 'Multi-point cage tied into the floor. The shell stops flexing.', item: 'chassis_cage', itemLabel: 'Welded Roll Cage', labour: 900, install: 'garage', fitted: false, have: false, perf: { suspension: 1.04, steering: 1.03 } },
            ],
        },
    ],
});

export const devDiagnose = () => ({ bolts: 4, lines: 2, blueprint: 'car', blueprintLabel: 'Automobile', skilled: true });

/*
 * Canned RPC responses for browser development, so the tablet's apps render
 * with plausible content instead of "unavailable". nui.js only reaches for
 * these when the page is not running inside NUI.
 */
export function devRpc(name) {
    switch (name) {
        case 'tablet:dashboard':
            return {
                ok: true,
                shop: { id: 'lamesa', label: 'La Mesa Auto Works' },
                openOrders: [
                    { id: 118, status: 'ready', readyAt: Date.now() - 400000, cost: 3240, etaMs: -400000 },
                    { id: 119, status: 'pending', readyAt: Date.now() + 2100000, cost: 980, etaMs: 2100000 },
                ],
                readyCount: 1,
                staff: { total: 6, online: 2 },
                stash: {
                    lines: 14, units: 143, slots: 250,
                    lowStock: [
                        { item: 'ducttape', label: 'Duct Tape', count: 2 },
                        { item: 'brake_pads', label: 'Brake Pads & Discs', count: 0 },
                    ],
                },
                delivery: null,
                balance: 148230,
            };

        case 'personnel:roster':
            return {
                ok: true,
                me: { citizenid: 'ABC12345', grade: 4 },
                can: { hire: true, fire: true, promote: true },
                grades: [
                    { level: 0, label: 'Trainee' }, { level: 1, label: 'Mechanic' },
                    { level: 2, label: 'Senior Mechanic' }, { level: 3, label: 'Shop Manager' },
                    { level: 4, label: 'Owner' },
                ],
                nearby: [{ src: 7, citizenid: 'QQQ99999', name: 'Marla Vane', currentJob: 'Unemployed', alreadyHere: false }],
                roster: [
                    { citizenid: 'ABC12345', name: 'Jesse Colt', grade: 4, gradeLabel: 'Owner', online: true, onDuty: true, hiredAt: 1710000000000, hiredBy: '', note: '' },
                    { citizenid: 'DEF67890', name: 'Rosa Iyer', grade: 3, gradeLabel: 'Shop Manager', online: true, onDuty: false, hiredAt: 1715000000000, hiredBy: 'Jesse Colt', note: '' },
                    { citizenid: 'GHI11111', name: 'Tomas Reyes', grade: 1, gradeLabel: 'Mechanic', online: false, onDuty: false, hiredAt: 1720000000000, hiredBy: 'Rosa Iyer', note: '' },
                ],
            };

        case 'shop:stash':
            return {
                ok: true, backend: 'ox', native: true,
                stash: { id: 'ag_mechanic_lamesa', label: 'Auto Works Parts Store', slots: 250 },
                can: { take: true, put: true },
                items: [
                    { item: 'air_filter', label: 'Air Filter', count: 12 },
                    { item: 'brake_pads', label: 'Brake Pads & Discs', count: 0 },
                    { item: 'ducttape', label: 'Duct Tape', count: 2 },
                    { item: 'radiator', label: 'Radiator & Coolant', count: 4 },
                    { item: 'tire', label: 'Tyre', count: 9 },
                ],
            };

        case 'shop:catalogue':
            return {
                ok: true, canOrder: true, balance: 148230, paymentMode: 'society',
                orderDurationMs: 3600000,
                shop: { id: 'lamesa', label: 'La Mesa Auto Works' },
                categories: [
                    { id: 'consumables', label: 'Consumables' },
                    { id: 'engine', label: 'Engine & Induction' },
                    { id: 'upgrades', label: 'Performance Upgrades' },
                ],
                items: [
                    { item: 'ducttape', label: 'Duct Tape', category: 'consumables', blurb: 'Holds a bumper on. Holds a radiator hose. Briefly.', packs: [5, 10, 25], unit: 25, inStock: 2 },
                    { item: 'zipties', label: 'Cable Ties', category: 'consumables', blurb: 'The correct tool for absolutely nothing, used for everything.', packs: [10, 25, 50], unit: 18, inStock: 40 },
                    { item: 'air_filter', label: 'Air Filter', category: 'engine', blurb: 'Cheap, and neglected on every vehicle you will ever see.', packs: [1, 5, 10], unit: 65, inStock: 12 },
                    { item: 'brakes_titanium', label: 'Titanium Brake Kit', category: 'upgrades', blurb: '', packs: [1, 5, 10], unit: 2400, inStock: 0 },
                ],
            };

        case 'scanner:live':
            /* Jitter the readings so the live page visibly ticks, without
               letting anything drift below zero. */
            return { ok: true, live: devScanner().scan.live.map((p) => ({
                ...p,
                value: Math.max(0, Math.round((p.value + (Math.random() - 0.5) * 2) * 10) / 10),
            })) };

        case 'scanner:freeze':
            return { ok: true, frame: [
                { label: 'Engine speed', value: 2862, unit: 'rpm' },
                { label: 'Vehicle speed', value: 68, unit: 'km/h' },
                { label: 'Calculated load', value: 94, unit: '%' },
                { label: 'Coolant temperature', value: 106.4, unit: '°C' },
                { label: 'Short term fuel trim', value: 6.7, unit: '%' },
                { label: 'Long term fuel trim', value: 9, unit: '%' },
                { label: 'Module voltage', value: 12.6, unit: 'V' },
            ] };

        case 'scanner:erase': {
            const scan = devScanner().scan;
            return {
                ok: true,
                cleared: scan.counts.stored,
                scan: {
                    ...scan,
                    mil: false,
                    counts: { stored: 0, pending: scan.codes.length },
                    codes: scan.codes.map((c) => ({ ...c, status: 'pending' })),
                    modules: scan.modules.map((m) => ({
                        ...m,
                        stored: 0,
                        pending: m.stored + m.pending,
                        parts: m.parts.map((part) => ({
                            ...part,
                            status: part.codes.length ? 'pending' : 'ok',
                            codes: part.codes.map((c) => ({ ...c, status: 'pending' })),
                        })),
                    })),
                    monitors: scan.monitors.map((m) => ({ ...m, state: 'incomplete' })),
                },
            };
        }

        case 'shop:orders':
            return {
                ok: true, canOrder: true, deliveryActive: false,
                orders: [
                    { id: 118, lines: [{ item: 'air_filter', label: 'Air Filter', qty: 10, unit: 60 }, { item: 'tire', label: 'Tyre', qty: 8, unit: 198 }], units: 18, cost: 3240, status: 'ready', orderedBy: 'Rosa Iyer', placedAt: Date.now() - 4000000, readyAt: Date.now() - 400000, etaMs: -400000 },
                    { id: 119, lines: [{ item: 'ducttape', label: 'Duct Tape', qty: 25, unit: 23 }], units: 25, cost: 980, status: 'pending', orderedBy: 'Jesse Colt', placedAt: Date.now() - 1400000, readyAt: Date.now() + 2100000, etaMs: 2100000 },
                    { id: 117, lines: [{ item: 'radiator', label: 'Radiator & Coolant', qty: 4, unit: 494 }], units: 4, cost: 1976, status: 'delivered', orderedBy: 'Jesse Colt', placedAt: Date.now() - 9000000, readyAt: Date.now() - 5400000, etaMs: -5400000 },
                ],
                open: [],
            };

        default:
            return null;
    }
}

/*
 * Scanner fixtures for all three tools. Pick one in the browser with
 * ?screen=scanner&device=obd | bite | marine
 */
const DEVICE_FIXTURES = {
    obd: {
        device: { id: 'obd', label: 'OBD-II Scan Tool', model: 'AGM-9000', bus: 'OBD-II / CAN',
            lexicon: { codes: 'STORED CODES', pending: 'PENDING CODES', systems: 'SYSTEM SCAN', system: 'MODULE', code: 'CODE', erase: 'ERASE CODES', lamp: 'MIL', live: 'LIVE DATA', frame: 'FREEZE FRAME', monitors: 'I/M MONITORS' } },
        plate: 'AG 44 XZ', vin: 'J1JGMAAU6HR7SLLKK', blueprintLabel: 'Automobile',
        protocol: 'ISO 15765-4 CAN 11/500', calibration: 'AGM-482913', odometer: 48213,
        parts: [
            ['ECM', 'Engine Control Module', 'ENGINE', 'spark_plugs', 'Spark Plugs & Coil Packs', 'Cylinder 1, bank 1', 'Coil pack on cylinder 1, under the ignition cover',
                [['P0301', 'Cylinder 1 misfire detected', 'high', 'stored'], ['P0351', 'Ignition coil 1 primary / secondary circuit', 'medium', 'stored']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'oil_system', 'Oil Pump, Filter & Sump', '', 'Sump and filter housing, underside of the engine',
                [['P0524', 'Engine oil pressure too low', 'high', 'stored']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'air_filter', 'Air Filter', 'Bank 1', 'Airbox, top of engine bay',
                [['P0171', 'Fuel trim system too lean, bank 1', 'medium', 'stored']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'radiator', 'Radiator, Fan & Coolant', '', 'Front of the engine bay, behind the grille',
                [['P0128', 'Coolant thermostat below regulating temperature', 'low', 'pending']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'battery', 'Battery & Alternator', '', 'Battery tray and alternator belt run', []],
            ['TCM', 'Transmission Control Module', 'TRANS', 'clutch', 'Clutch & Flywheel', '', 'Bellhousing, between engine and gearbox',
                [['P1870', 'Transmission component slipping', 'high', 'stored']]],
            ['TCM', 'Transmission Control Module', 'TRANS', 'gearbox', 'Gearbox', '', 'Transmission tunnel, behind the engine', []],
            ['ABS', 'ABS / Stability Control', 'ABS', 'tire_rl', 'Rear Left Tyre', 'Left rear', 'Left rear wheel and hub sensor',
                [['C0045', 'Left rear wheel speed sensor circuit', 'medium', 'stored']]],
            ['ABS', 'ABS / Stability Control', 'ABS', 'brake_lines', 'Brake Lines & Master Cylinder', '', 'Master cylinder on the bulkhead', []],
            ['EPS', 'Power Steering Module', 'STEER', 'steering', 'Steering Rack & Column', '', 'Steering rack behind the front subframe', []],
            ['BCM', 'Body Control Module', 'BODY', 'lights', 'Lighting & Indicators', '', 'Lamp units front and rear', []],
        ],
        live: [
            ['0C', 'Engine RPM', 842.1, 'rpm', true], ['0D', 'Vehicle speed', 0, 'km/h', true],
            ['05', 'Coolant temperature', 106.4, '\u00b0C', false], ['04', 'Calculated load', 30.3, '%', true],
            ['06', 'Short term fuel trim B1', 6.7, '%', true], ['07', 'Long term fuel trim B1', 9.0, '%', true],
            ['10', 'Mass air flow', 1.9, 'g/s', true], ['0F', 'Intake air temp', 29.8, '\u00b0C', true],
            ['42', 'Control module voltage', 12.6, 'V', true],
        ],
    },

    bite: {
        device: { id: 'bite', label: 'Avionics BITE Test Set', model: 'AV-4', bus: 'ARINC 429',
            lexicon: { codes: 'ACTIVE FAULTS', pending: 'INTERMITTENT', systems: 'LRU SCAN', system: 'LRU', code: 'FAULT', erase: 'CLEAR FAULT LOG', lamp: 'CAUTION', live: 'PARAMETERS', frame: 'SNAPSHOT', monitors: 'BITE STATUS' } },
        plate: 'HELI 001', vin: '92RPVS6A5YDTN1BCF', blueprintLabel: 'Rotorcraft',
        protocol: 'ARINC 429 / BITE', calibration: 'AGM-731204', odometer: 1284,
        parts: [
            ['ECM', 'Engine Control Module', 'ENGINE', 'engine', 'Turbine / Powerplant', '', 'Engine deck, behind the main cowling',
                [['ENG-041', 'Turbine gas temperature exceedance recorded', 'high', 'stored'], ['ENG-014', 'N1 speed signal intermittent', 'medium', 'pending']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'oil_system', 'Engine & Transmission Oil System', '', 'Engine and transmission oil coolers, upper deck',
                [['ENG-055', 'Engine oil pressure low', 'high', 'stored']]],
            ['ECM', 'Engine Control Module', 'ENGINE', 'fuel_system', 'Fuel Pumps & Lines', '', 'Fuel cells under the cabin floor', []],
            ['RCU', 'Rotor & Drive Monitor', 'ROTOR', 'main_gearbox', 'Main Rotor Gearbox', '', 'Main gearbox on the cabin roof',
                [['RTR-030', 'Main gearbox chip detector triggered', 'high', 'stored']]],
            ['RCU', 'Rotor & Drive Monitor', 'ROTOR', 'main_rotor', 'Main Rotor Head & Blades', 'Blade 3', 'Main rotor head and blade 3',
                [['RTR-112', 'Main rotor track out of limits, blade 3', 'medium', 'stored']]],
            ['RCU', 'Rotor & Drive Monitor', 'ROTOR', 'tail_rotor', 'Tail Rotor & Blades', 'Blade 2', 'Tail rotor head, blade 2', []],
            ['HYD', 'Hydraulic System Monitor', 'HYDR', 'hydraulics', 'Swashplate & Hydraulics', '', 'Hydraulic pack and swashplate, above the cabin', []],
            ['FCU', 'Flight Control Unit', 'FLIGHT', 'avionics', 'Avionics & Instruments', '', 'Avionics rack behind the instrument panel', []],
            ['FCU', 'Flight Control Unit', 'FLIGHT', 'controls', 'Cyclic, Collective & Linkages', '', 'Cyclic and collective linkages under the floor', []],
        ],
        live: [
            ['0C', 'Engine RPM', 836.1, 'rpm', true], ['05', 'Turbine gas temp', 672.5, '\u00b0C', true],
            ['T1', 'Main rotor RPM', 98.2, '% Nr', true], ['T2', 'Torque', 61.4, '%', true],
            ['T3', 'Transmission oil press', 34.0, 'psi', false], ['42', 'Control module voltage', 27.4, 'V', true],
        ],
    },

    marine: {
        device: { id: 'marine', label: 'Marine Diagnostic Tool', model: 'MD-2', bus: 'SAE J1939',
            lexicon: { codes: 'ACTIVE DTCs', pending: 'INACTIVE DTCs', systems: 'ECU SCAN', system: 'ECU', code: 'DTC', erase: 'RESET DTCs', lamp: 'WARN', live: 'LIVE DATA', frame: 'SNAPSHOT', monitors: 'SELF TEST' } },
        plate: 'BOAT 001', vin: '9BKY41UYV9GEKD8X4', blueprintLabel: 'Watercraft',
        protocol: 'SAE J1939 250k', calibration: 'AGM-114528', odometer: 3140,
        parts: [
            ['MCU', 'Marine Control Unit', 'MARINE', 'oil_system', 'Oil System', '', 'Sump, filter and cooler, low in the bilge',
                [['SPN 100 FMI 1', 'Engine oil pressure below normal - most severe', 'high', 'stored']]],
            ['MCU', 'Marine Control Unit', 'MARINE', 'cooling', 'Raw Water Cooling & Impeller', '', 'Raw water pump and impeller, on the engine front',
                [['SPN 110 FMI 16', 'Engine coolant temperature above normal', 'medium', 'stored'], ['SPN 109 FMI 1', 'Coolant pressure below normal', 'high', 'stored']]],
            ['MCU', 'Marine Control Unit', 'MARINE', 'air_filter', 'Intake & Flame Arrestor', '', 'Flame arrestor on the intake',
                [['SPN 107 FMI 0', 'Air filter differential pressure above normal', 'low', 'stored']]],
            ['MCU', 'Marine Control Unit', 'MARINE', 'gearbox', 'Outdrive & Gearbox', '', 'Outdrive and gear case, on the transom', []],
            ['MCU', 'Marine Control Unit', 'MARINE', 'propeller', 'Propeller & Shaft', '', 'Propeller and shaft, below the transom', []],
            ['MCU', 'Marine Control Unit', 'MARINE', 'bilge_pump', 'Bilge Pump', '', 'Bilge, lowest point of the hull', []],
            ['BCM', 'Body Control Module', 'BODY', 'lights', 'Navigation Lights', '', 'Navigation lamps', []],
        ],
        live: [
            ['0C', 'Engine RPM', 822.7, 'rpm', true], ['05', 'Coolant temperature', 121.8, '\u00b0C', false],
            ['04', 'Calculated load', 27.3, '%', true], ['06', 'Short term fuel trim B1', 9.1, '%', false],
            ['0A', 'Fuel rail pressure', 2.1, 'bar', true], ['42', 'Control module voltage', 12.1, 'V', true],
        ],
    },
};

const MODULE_ORDER = ['ECM', 'MCU', 'TCM', 'RCU', 'HYD', 'FCU', 'ABS', 'EPS', 'BCM'];

/** Expands a fixture's flat part list into the shape the device expects. */
function buildFixture(key) {
    const f = DEVICE_FIXTURES[key] || DEVICE_FIXTURES.obd;

    const codes = [];
    const byModule = new Map();

    for (const [moduleId, moduleLabel, short, id, label, location, where, rawCodes] of f.parts) {
        const partCodes = rawCodes.map(([code, desc, severity, statusValue]) => ({ code, desc, severity, status: statusValue }));
        for (const c of partCodes) {
            codes.push({ ...c, component: id, componentLabel: label, module: moduleId, moduleLabel, location, where });
        }
        if (!byModule.has(moduleId)) byModule.set(moduleId, { id: moduleId, label: moduleLabel, short, parts: [] });
        byModule.get(moduleId).parts.push({
            id, label, where, location, codes: partCodes,
            status: partCodes.some((c) => c.status === 'stored') ? 'fault' : partCodes.length ? 'pending' : 'ok',
        });
    }

    const modules = MODULE_ORDER.filter((m) => byModule.has(m)).map((m) => {
        const mod = byModule.get(m);
        const flat = mod.parts.flatMap((p) => p.codes);
        return { ...mod, stored: flat.filter((c) => c.status === 'stored').length, pending: flat.filter((c) => c.status === 'pending').length };
    });

    const rank = { high: 0, medium: 1, low: 2 };
    codes.sort((a, b) => (a.status === b.status ? 0 : a.status === 'stored' ? -1 : 1) || (rank[a.severity] - rank[b.severity]));

    const stored = codes.filter((c) => c.status === 'stored').length;

    return {
        device: f.device,
        plate: f.plate, vin: f.vin, blueprint: key, blueprintLabel: f.blueprintLabel,
        protocol: f.protocol, calibration: f.calibration, odometer: f.odometer,
        mil: stored > 0,
        counts: { stored, pending: codes.length - stored },
        codes, modules,
        live: f.live.map(([pid, label, value, unit, ok]) => ({ pid, label, value, unit, ok })),
        monitors: [
            { id: 'MIS', label: 'Misfire', state: 'failed' },
            { id: 'FUE', label: 'Fuel system', state: 'failed' },
            { id: 'CCM', label: 'Comprehensive components', state: 'failed' },
            { id: 'CAT', label: 'Catalyst', state: 'failed' },
            { id: 'EVP', label: 'Evaporative system', state: 'ready' },
            { id: 'O2S', label: 'Oxygen sensor', state: 'failed' },
        ],
        clearedAt: 0,
    };
}

const currentDevice = () => new URLSearchParams(window.location.search).get('device') || 'obd';

export const devScanner = () => ({
    canErase: true,
    liveInterval: 900,
    scan: buildFixture(currentDevice()),
});
