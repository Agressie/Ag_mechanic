/*
 * ag_mechanic - wear model
 * ============================================================================
 * A vehicle does not just "take damage". Every kind of abuse maps onto a
 * different set of components, which is the whole reason a diagnostic report is
 * worth reading: sitting on the limiter cooks the engine and its gaskets, but
 * leaves the brakes untouched; a hard landing wrecks suspension and steering
 * and leaves the engine fine.
 *
 * Each source lists component weights. Actual wear applied is:
 *     amount * weight * component.decay
 * ============================================================================
 */

AGM.Damage = {
    /* How often the client samples a vehicle it is driving (ms). */
    tick: 400,
    /* How often accumulated wear is flushed to the server (ms). */
    flush: 5000,

    /* Detection tuning ---------------------------------------------------- */
    detect: {
        /* Sitting on the rev limiter. */
        redlineRpm: 0.965,
        redlineWearPerSecond: 0.55,
        /* Bouncing the limiter in neutral or with the clutch in is worse. */
        redlineNoLoadMultiplier: 1.8,

        /* A big instant RPM jump - a missed downshift / money shift. */
        overRevRpmDelta: 0.30,
        overRevWear: 2.4,

        /* Wheelspin: driven wheel speed vs actual ground speed. */
        wheelspinRatio: 1.22,
        wheelspinWearPerSecond: 0.95,
        /* Handbrake burnouts are wheelspin with the volume turned up. */
        burnoutWearPerSecond: 2.1,

        /* Sustained hard braking (m/s^2 of deceleration). */
        hardBrakeDecel: 8.5,
        hardBrakeWearPerSecond: 0.75,
        /* Brakes glow if you keep doing it - this scales with how long. */
        brakeFadeRamp: 1.6,

        /* Collisions, measured from the native body-health drop. */
        impactMinBodyDelta: 6,
        impactWearScale: 0.85,
        /* Anything above this counts as a heavy shunt and spreads further. */
        impactHeavyDelta: 120,
        rolloverWearPerSecond: 2.2,

        /* Landing after a jump, based on downward velocity on touchdown. */
        landingMinFallSpeed: 7.5,
        landingWearScale: 1.25,

        /* Driving fast over dirt, grass, gravel. */
        offroadSpeed: 11.0,
        offroadWearPerSecond: 0.40,

        /* Heat soak: high revs with no airflow. */
        overheatRpm: 0.80,
        overheatMaxSpeed: 8.0,
        overheatSeconds: 22,
        overheatWearPerSecond: 0.85,

        /* Water ingress. */
        submergedLevel: 0.35,
        submergedWearPerSecond: 3.0,

        /* Bullet and explosion damage. */
        gunfireWearScale: 0.9,

        /* Slow honest use, per kilometre travelled. */
        mileageWearPerKm: 0.30,

        /* Rotorcraft: pulling more than the gearbox is rated for. */
        overtorqueRpm: 0.92,
        overtorqueClimbRate: 6.0,
        overtorqueWearPerSecond: 1.1,
        /* Rotor blade tip strike / very heavy set-down. */
        rotorStrikeWear: 30,
        heliSetdownFallSpeed: 5.0,

        /* Fixed-wing: past Vne, or loading the wings up in a turn. */
        overspeedMs: 92.0,
        overspeedWearPerSecond: 1.2,
        overGRate: 2.2,
        overGWearPerSecond: 0.9,
        gearSlamFallSpeed: 6.0,

        /* Boats: slamming off waves, and hitting the bottom. */
        waveSlamFallSpeed: 4.0,
        waveSlamWearScale: 1.0,
        propStrikeWear: 22,
    },

    /* Wear sources -------------------------------------------------------- */
    sources: {
        redline: {
            label: 'Held on the rev limiter',
            blueprints: ['car', 'bike', 'boat'],
            weights: { engine: 1.0, gaskets: 0.70, oil_system: 0.45, clutch: 0.30, exhaust: 0.25, spark_plugs: 0.35, radiator: 0.30, cooling: 0.30 },
        },
        over_rev: {
            label: 'Over-revved on a downshift',
            blueprints: ['car', 'bike', 'boat'],
            weights: { engine: 0.85, clutch: 1.0, gearbox: 0.75, driveshaft: 0.45, chain_drive: 0.60, gaskets: 0.35, propeller: 0.30 },
        },
        wheelspin: {
            label: 'Excessive wheelspin',
            blueprints: ['car', 'bike'],
            weights: { tire_rl: 1.0, tire_rr: 1.0, tire_rear: 1.2, tire_fl: 0.15, tire_fr: 0.15, tire_front: 0.2, clutch: 0.55, driveshaft: 0.40, chain_drive: 0.70, gearbox: 0.25 },
        },
        burnout: {
            label: 'Burnouts',
            blueprints: ['car', 'bike'],
            weights: { tire_rl: 1.4, tire_rr: 1.4, tire_rear: 1.8, clutch: 0.70, driveshaft: 0.50, chain_drive: 0.90, engine: 0.20, radiator: 0.35 },
        },
        hard_brake: {
            label: 'Repeated heavy braking',
            blueprints: ['car', 'bike', 'plane'],
            weights: { brake_pads: 1.0, brake_lines: 0.45, wheel_brakes: 1.0, tire_fl: 0.45, tire_fr: 0.45, tire_front: 0.55, tire_rl: 0.20, tire_rr: 0.20, tire_rear: 0.25, wheels: 0.20, suspension: 0.15 },
        },
        impact_front: {
            label: 'Front-end collision',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                body: 1.0, hull: 1.0, airframe: 0.85, radiator: 0.90, cooling: 0.90, lights: 0.80,
                engine: 0.35, gaskets: 0.25, air_filter: 0.25, exhaust: 0.20, oil_system: 0.20,
                suspension: 0.55, steering: 0.45, wheels: 0.45, tire_fl: 0.35, tire_fr: 0.35, tire_front: 0.45,
                windows: 0.35, propeller: 0.70, landing_gear: 0.50, skids: 0.50, main_rotor: 0.25,
            },
        },
        impact_rear: {
            label: 'Rear-end collision',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                body: 1.0, hull: 1.0, airframe: 0.85, exhaust: 0.90, fuel_system: 0.55,
                gearbox: 0.25, driveshaft: 0.35, chain_drive: 0.40, suspension: 0.40,
                tire_rl: 0.30, tire_rr: 0.30, tire_rear: 0.40, lights: 0.60, windows: 0.25,
                tail_rotor: 0.80, tail_drive: 0.70, rudder: 0.60, elevator: 0.55, propeller: 0.40,
            },
        },
        impact_side: {
            label: 'Side impact',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                body: 1.0, hull: 1.0, airframe: 0.80, windows: 0.75, lights: 0.35,
                suspension: 0.60, steering: 0.50, wheels: 0.55,
                tire_fl: 0.30, tire_fr: 0.30, tire_rl: 0.30, tire_rr: 0.30, tire_front: 0.35, tire_rear: 0.35,
                ailerons: 0.70, skids: 0.45, landing_gear: 0.45, ecu: 0.20,
            },
        },
        rollover: {
            label: 'Rolled over',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                body: 1.2, hull: 1.2, airframe: 1.0, windows: 1.0, lights: 0.60,
                suspension: 0.70, steering: 0.60, oil_system: 0.55, engine: 0.30,
                main_rotor: 1.4, tail_rotor: 1.0, ailerons: 0.80, propeller: 0.80, skids: 0.90, landing_gear: 0.90,
            },
        },
        hard_landing: {
            label: 'Heavy landing',
            blueprints: ['car', 'bike'],
            weights: {
                suspension: 1.2, wheels: 0.85, steering: 0.55, driveshaft: 0.45, chain_drive: 0.40,
                tire_fl: 0.50, tire_fr: 0.50, tire_rl: 0.45, tire_rr: 0.45, tire_front: 0.55, tire_rear: 0.50,
                body: 0.60, exhaust: 0.35, oil_system: 0.30, brake_lines: 0.20,
            },
        },
        offroad: {
            label: 'Hard use on rough surfaces',
            blueprints: ['car', 'bike'],
            weights: {
                suspension: 0.80, wheels: 0.55, air_filter: 0.90, steering: 0.35,
                tire_fl: 0.35, tire_fr: 0.35, tire_rl: 0.35, tire_rr: 0.35, tire_front: 0.40, tire_rear: 0.40,
                radiator: 0.30, exhaust: 0.30, brake_pads: 0.25, body: 0.20,
            },
        },
        overheat: {
            label: 'Running hot',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: { radiator: 1.2, cooling: 1.2, gaskets: 1.0, engine: 0.70, oil_system: 0.60, spark_plugs: 0.30, main_gearbox: 0.50 },
        },
        submerged: {
            label: 'Water ingress',
            blueprints: ['car', 'bike', 'heli', 'plane'],
            weights: { ecu: 1.2, ignition: 1.2, battery: 1.0, air_filter: 1.0, engine: 0.60, spark_plugs: 0.80, avionics: 1.0, oil_system: 0.35, lights: 0.40 },
        },
        gunfire: {
            label: 'Ballistic damage',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                body: 1.0, hull: 1.0, airframe: 1.0, windows: 0.85, lights: 0.50,
                radiator: 0.70, cooling: 0.70, fuel_system: 0.60, engine: 0.40, ecu: 0.40, battery: 0.35,
                tire_fl: 0.45, tire_fr: 0.45, tire_rl: 0.45, tire_rr: 0.45, tire_front: 0.50, tire_rear: 0.50,
                main_rotor: 0.50, tail_rotor: 0.60, hydraulics: 0.70, avionics: 0.50, ailerons: 0.50, rudder: 0.50,
            },
        },
        mileage: {
            label: 'Normal wear and tear',
            blueprints: ['car', 'bike', 'boat', 'heli', 'plane'],
            weights: {
                air_filter: 1.0, spark_plugs: 0.85, ignition: 0.85, oil_system: 0.90, brake_pads: 0.80, wheel_brakes: 0.80,
                tire_fl: 0.55, tire_fr: 0.55, tire_rl: 0.60, tire_rr: 0.60, tire_front: 0.60, tire_rear: 0.70,
                clutch: 0.40, chain_drive: 0.70, suspension: 0.35, brake_lines: 0.20, battery: 0.30,
                exhaust: 0.25, radiator: 0.25, cooling: 0.25, engine: 0.12, gearbox: 0.15, gaskets: 0.20,
                main_rotor: 0.30, tail_rotor: 0.30, main_gearbox: 0.25, hydraulics: 0.25, propeller: 0.30,
                controls: 0.25, ailerons: 0.25, elevator: 0.25, rudder: 0.25, flaps: 0.30, avionics: 0.20,
                landing_gear: 0.25, skids: 0.20, bilge_pump: 0.35, steering: 0.20, wheels: 0.25, body: 0.05, hull: 0.05, airframe: 0.05,
            },
        },

        /* Rotorcraft ------------------------------------------------------ */
        overtorque: {
            label: 'Exceeded torque limits',
            blueprints: ['heli'],
            weights: { main_gearbox: 1.2, engine: 0.90, tail_drive: 0.70, main_rotor: 0.55, oil_system: 0.60, hydraulics: 0.30 },
        },
        rotor_strike: {
            label: 'Rotor strike',
            blueprints: ['heli'],
            weights: { main_rotor: 1.5, main_gearbox: 0.80, hydraulics: 0.60, tail_rotor: 0.40, airframe: 0.50, controls: 0.45 },
        },
        heli_setdown: {
            label: 'Heavy set-down',
            blueprints: ['heli'],
            weights: { skids: 1.3, airframe: 0.70, main_gearbox: 0.45, tail_drive: 0.35, controls: 0.30, avionics: 0.20 },
        },

        /* Fixed-wing ------------------------------------------------------ */
        overspeed: {
            label: 'Flown past Vne',
            blueprints: ['plane'],
            weights: { airframe: 1.1, ailerons: 0.80, elevator: 0.80, rudder: 0.70, flaps: 0.60, windows: 0.30, hydraulics: 0.30 },
        },
        over_g: {
            label: 'Over-stressed in manoeuvring',
            blueprints: ['plane'],
            weights: { airframe: 1.2, ailerons: 0.70, elevator: 0.90, hydraulics: 0.40, engine: 0.25, oil_system: 0.30 },
        },
        gear_slam: {
            label: 'Hard arrival',
            blueprints: ['plane'],
            weights: { landing_gear: 1.4, wheel_brakes: 0.50, airframe: 0.70, propeller: 0.35, avionics: 0.20, hydraulics: 0.35 },
        },
        prop_strike: {
            label: 'Propeller strike',
            blueprints: ['plane', 'boat'],
            weights: { propeller: 1.6, engine: 0.70, gearbox: 0.60, oil_system: 0.30, airframe: 0.30, hull: 0.35 },
        },

        /* Watercraft ------------------------------------------------------ */
        wave_slam: {
            label: 'Slamming off the water',
            blueprints: ['boat'],
            weights: { hull: 1.2, engine: 0.35, gearbox: 0.40, propeller: 0.35, steering: 0.30, windows: 0.20, bilge_pump: 0.25 },
        },
    },
};

/** Does this wear source apply to this blueprint? */
AGM.Damage.applies = function (sourceId, blueprint) {
    const s = AGM.Damage.sources[sourceId];
    return !!s && s.blueprints.includes(blueprint);
};

/** Human label for a wear source, used in the "symptoms" part of a report. */
AGM.Damage.label = function (sourceId) {
    const s = AGM.Damage.sources[sourceId];
    return s ? s.label : sourceId;
};
