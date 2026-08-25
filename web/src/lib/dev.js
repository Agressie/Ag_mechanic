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
            return { ok: true, cleared: 6, scan: { ...scan, mil: false, counts: { stored: 0, pending: 7 },
                codes: scan.codes.map((c) => ({ ...c, status: 'pending' })),
                modules: scan.modules.map((m) => ({ ...m, pending: m.stored + m.pending, stored: 0 })) } };
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

export const devScanner = () => ({
    canErase: true,
    liveInterval: 900,
    scan: {
        plate: 'AG 44 XZ',
        vin: 'J1JGMAAU6HR7SLLKK',
        blueprint: 'car',
        blueprintLabel: 'Automobile',
        protocol: 'ISO 15765-4 CAN 11/500',
        odometer: 48213,
        mil: true,
        calibration: 'AGM-482913',
        counts: { stored: 6, pending: 1 },
        codes: [
            { code: 'P0301', desc: 'Cylinder 1 misfire detected', severity: 'high', status: 'stored', component: 'spark_plugs', componentLabel: 'Spark Plugs & Coil Packs', module: 'ECM', moduleLabel: 'Engine Control Module', location: 'Cylinder 1, bank 1', where: 'Coil pack on cylinder 1, under the ignition cover' },
            { code: 'P0524', desc: 'Engine oil pressure too low', severity: 'high', status: 'stored', component: 'oil_system', componentLabel: 'Oil Pump, Filter & Sump', module: 'ECM', moduleLabel: 'Engine Control Module', location: '', where: 'Sump and filter housing, underside of the engine' },
            { code: 'P1870', desc: 'Transmission component slipping', severity: 'high', status: 'stored', component: 'clutch', componentLabel: 'Clutch & Flywheel', module: 'TCM', moduleLabel: 'Transmission Control Module', location: '', where: 'Bellhousing, between engine and gearbox' },
            { code: 'C0045', desc: 'Left rear wheel speed sensor circuit', severity: 'medium', status: 'stored', component: 'tire_rl', componentLabel: 'Rear Left Tyre', module: 'ABS', moduleLabel: 'ABS / Stability Control', location: 'Left rear', where: 'Left rear wheel and hub sensor' },
            { code: 'P0171', desc: 'Fuel trim system too lean, bank 1', severity: 'medium', status: 'stored', component: 'air_filter', componentLabel: 'Air Filter', module: 'ECM', moduleLabel: 'Engine Control Module', location: 'Bank 1', where: 'Airbox, top of engine bay' },
            { code: 'P0420', desc: 'Catalyst system efficiency below threshold, bank 1', severity: 'low', status: 'stored', component: 'exhaust', componentLabel: 'Exhaust & Manifold', module: 'ECM', moduleLabel: 'Engine Control Module', location: 'Bank 1', where: 'Manifold and downpipe, underside on bank 1' },
            { code: 'P0128', desc: 'Coolant thermostat below regulating temperature', severity: 'low', status: 'pending', component: 'radiator', componentLabel: 'Radiator, Fan & Coolant', module: 'ECM', moduleLabel: 'Engine Control Module', location: '', where: 'Front of the engine bay, behind the grille' },
        ],
        modules: [
            { id: 'ECM', label: 'Engine Control Module', short: 'ENGINE', stored: 4, pending: 1 },
            { id: 'TCM', label: 'Transmission Control Module', short: 'TRANS', stored: 1, pending: 0 },
            { id: 'ABS', label: 'ABS / Stability Control', short: 'ABS', stored: 1, pending: 0 },
            { id: 'EPS', label: 'Power Steering Module', short: 'STEER', stored: 0, pending: 0 },
            { id: 'BCM', label: 'Body Control Module', short: 'BODY', stored: 0, pending: 0 },
        ],
        live: [
            { pid: '0C', label: 'Engine RPM', value: 842.1, unit: 'rpm', ok: true },
            { pid: '0D', label: 'Vehicle speed', value: 0, unit: 'km/h', ok: true },
            { pid: '05', label: 'Coolant temperature', value: 106.4, unit: '°C', ok: false },
            { pid: '04', label: 'Calculated load', value: 30.3, unit: '%', ok: true },
            { pid: '06', label: 'Short term fuel trim B1', value: 6.7, unit: '%', ok: true },
            { pid: '07', label: 'Long term fuel trim B1', value: 9.0, unit: '%', ok: true },
            { pid: '10', label: 'Mass air flow', value: 1.9, unit: 'g/s', ok: true },
            { pid: '0F', label: 'Intake air temp', value: 29.8, unit: '°C', ok: true },
            { pid: '42', label: 'Control module voltage', value: 12.6, unit: 'V', ok: true },
        ],
        monitors: [
            { id: 'MIS', label: 'Misfire', state: 'failed' },
            { id: 'FUE', label: 'Fuel system', state: 'failed' },
            { id: 'CCM', label: 'Comprehensive components', state: 'failed' },
            { id: 'CAT', label: 'Catalyst', state: 'failed' },
            { id: 'EVP', label: 'Evaporative system', state: 'ready' },
            { id: 'O2S', label: 'Oxygen sensor', state: 'failed' },
        ],
        clearedAt: 0,
    },
});
