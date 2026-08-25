/*
 * ag_mechanic - abuse monitor
 * ============================================================================
 * Only the driver runs this, and only for the vehicle they are driving: the
 * client is the only place RPM, wheel slip and impact direction are visible.
 * Wear is accumulated locally and flushed to the server in batches, where it is
 * re-checked and clamped before it counts for anything.
 *
 * Every native that is not guaranteed across builds is called through safe(),
 * so a missing one degrades a single detector instead of the whole loop.
 * ============================================================================
 */

AGM.monitor = {};

const D = AGM.Damage.detect;

/** Calls a native, returning `fallback` if it is missing or throws. */
function safe(fn, fallback) {
    try {
        const value = fn();
        return value === undefined || value === null ? fallback : value;
    } catch (_) {
        return fallback;
    }
}

/* Rolling per-vehicle sample, reset when the player changes vehicle. */
let session = null;
/** Accumulated wear, { sourceId: amount }. */
let pending = {};
let pendingDistance = 0;
let lastFlush = 0;

function resetSession(vehicle, info) {
    session = {
        vehicle,
        info,
        rpm: safe(() => GetVehicleCurrentRpm(vehicle), 0),
        speed: safe(() => GetEntitySpeed(vehicle), 0),
        bodyHealth: safe(() => GetVehicleBodyHealth(vehicle), 1000),
        engineHealth: safe(() => GetVehicleEngineHealth(vehicle), 1000),
        mainRotor: safe(() => GetHeliMainRotorHealth(vehicle), 1000),
        coords: GetEntityCoords(vehicle, true),
        inAir: false,
        fallSpeed: 0,
        overheatFor: 0,
        brakeFor: 0,
        tyreBurst: {},
        lastTick: GetGameTimer(),
    };
    pending = {};
    pendingDistance = 0;
}

function add(source, amount) {
    if (!(amount > 0)) return;
    if (!AGM.Damage.applies(source, session.info.blueprint)) return;
    pending[source] = (pending[source] || 0) + amount;
}

/* ------------------------------------------------------------------ detectors */

function detectPowertrain(vehicle, blueprint, dt, rpm, speed) {
    const running = safe(() => GetIsVehicleEngineRunning(vehicle), true);
    if (!running) return;

    /* Sitting on the limiter. Worse with no load behind it. */
    if (rpm > D.redlineRpm) {
        const noLoad = speed < 3.0;
        add('redline', D.redlineWearPerSecond * dt * (noLoad ? D.redlineNoLoadMultiplier : 1));
    }

    /* A sudden jump in revs is a missed shift, not an engine getting faster. */
    const spike = rpm - session.rpm;
    if (spike > D.overRevRpmDelta && rpm > 0.88) {
        add('over_rev', D.overRevWear);
    }

    /* Heat soak: revs with no airflow. */
    if (rpm > D.overheatRpm && speed < D.overheatMaxSpeed) {
        session.overheatFor += dt;
        if (session.overheatFor > D.overheatSeconds) {
            add('overheat', D.overheatWearPerSecond * dt);
        }
    } else {
        session.overheatFor = Math.max(0, session.overheatFor - dt * 2);
    }

    if (blueprint !== 'car' && blueprint !== 'bike') return;

    /* Wheelspin, from the driven wheels rather than from the throttle input. */
    if (safe(() => IsVehicleInBurnout(vehicle), false)) {
        add('burnout', D.burnoutWearPerSecond * dt);
    } else if (speed > 0.5) {
        const wheels = blueprint === 'bike' ? [1] : [2, 3];
        let worst = 0;
        for (const wheel of wheels) {
            const wheelSpeed = Math.abs(safe(() => GetVehicleWheelSpeed(vehicle, wheel), 0));
            if (wheelSpeed > 0) worst = Math.max(worst, wheelSpeed / Math.max(speed, 1.0));
        }
        if (worst > D.wheelspinRatio) {
            const excess = Math.min(3.0, worst - D.wheelspinRatio + 1);
            add('wheelspin', D.wheelspinWearPerSecond * dt * excess);
        }
    }
}

function detectBraking(vehicle, dt, speed) {
    const decel = (session.speed - speed) / Math.max(dt, 0.01);
    const braking = IsControlPressed(0, 72) || IsDisabledControlPressed(0, 72);

    if (braking && decel > D.hardBrakeDecel && speed > 4.0) {
        session.brakeFor += dt;
        const ramp = 1 + Math.min(D.brakeFadeRamp, session.brakeFor * 0.2);
        add('hard_brake', D.hardBrakeWearPerSecond * dt * ramp);
    } else {
        session.brakeFor = Math.max(0, session.brakeFor - dt);
    }
}

function detectImpacts(vehicle, blueprint, dt, speed) {
    const body = safe(() => GetVehicleBodyHealth(vehicle), session.bodyHealth);
    const delta = session.bodyHealth - body;

    if (delta > D.impactMinBodyDelta) {
        const collided = safe(() => HasEntityCollidedWithAnything(vehicle), true);
        const amount = delta * D.impactWearScale;

        if (!collided) {
            /* Body damage with nothing touched is gunfire, near enough. */
            add('gunfire', delta * D.gunfireWearScale);
        } else {
            const zone = impactZone(vehicle);
            add(zone, amount);

            /* A heavy shunt spreads into a second area. */
            if (delta > D.impactHeavyDelta) {
                add(zone === 'impact_front' ? 'impact_side' : 'impact_front', amount * 0.35);
            }
            /* Aircraft and boats hitting things at speed take it in the prop. */
            if ((blueprint === 'plane' || blueprint === 'boat') && speed > 8.0) {
                add('prop_strike', Math.min(D.propStrikeWear, delta * 0.4));
            }
        }
    }

    if (safe(() => IsEntityUpsidedown(vehicle), false)) {
        add('rollover', D.rolloverWearPerSecond * dt);
    }

    /* Tyres that have just gone flat without our doing. */
    for (const comp of AGM.Components.list(blueprint)) {
        if (comp.wheelIndex === null || comp.wheelIndex === undefined) continue;
        const burst = safe(() => IsVehicleTyreBurst(vehicle, comp.wheelIndex, false), false);
        const known = (AGM.state.get(session.info.netId) || {}).health || {};
        const alreadyDead = AGM.Health.isDead(known[comp.id] !== undefined ? known[comp.id] : 100, comp);

        if (burst && !session.tyreBurst[comp.wheelIndex] && !alreadyDead) {
            add('gunfire', 12);
        }
        session.tyreBurst[comp.wheelIndex] = burst;
    }
}

/** Which end took the hit, from the direction the vehicle was travelling. */
function impactZone(vehicle) {
    const forward = safe(() => GetEntityForwardVector(vehicle), [0, 1, 0]);
    const velocity = safe(() => GetEntityVelocity(vehicle), [0, 0, 0]);

    const magnitude = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2);
    if (magnitude < 0.5) return 'impact_side';

    const dot = (forward[0] * velocity[0] + forward[1] * velocity[1]) / magnitude;
    if (dot > 0.55) return 'impact_front';
    if (dot < -0.55) return 'impact_rear';
    return 'impact_side';
}

function detectTerrain(vehicle, blueprint, dt, speed) {
    if (blueprint !== 'car' && blueprint !== 'bike') return;
    if (speed < D.offroadSpeed) return;

    const coords = GetEntityCoords(vehicle, true);
    const onRoad = safe(() => IsPointOnRoad(coords[0], coords[1], coords[2], vehicle), true);
    if (!onRoad) {
        add('offroad', D.offroadWearPerSecond * dt * Math.min(2.5, speed / D.offroadSpeed));
    }
}

function detectAirborne(vehicle, blueprint, dt) {
    const inAir = safe(() => IsEntityInAir(vehicle), false);
    const velocity = safe(() => GetEntityVelocity(vehicle), [0, 0, 0]);
    const descent = -velocity[2];

    if (inAir) {
        session.inAir = true;
        session.fallSpeed = Math.max(session.fallSpeed, descent);
        return;
    }

    if (!session.inAir) return;
    session.inAir = false;

    const fall = session.fallSpeed;
    session.fallSpeed = 0;

    if (blueprint === 'car' || blueprint === 'bike') {
        if (fall > D.landingMinFallSpeed) {
            add('hard_landing', (fall - D.landingMinFallSpeed) * D.landingWearScale);
        }
    } else if (blueprint === 'heli') {
        if (fall > D.heliSetdownFallSpeed) {
            add('heli_setdown', (fall - D.heliSetdownFallSpeed) * D.landingWearScale);
        }
    } else if (blueprint === 'plane') {
        if (fall > D.gearSlamFallSpeed) {
            add('gear_slam', (fall - D.gearSlamFallSpeed) * D.landingWearScale);
        }
    }
}

function detectWater(vehicle, blueprint, dt) {
    if (blueprint === 'boat') {
        /* Slamming off a wave: a sharp arrest of downward motion. */
        const velocity = safe(() => GetEntityVelocity(vehicle), [0, 0, 0]);
        const descent = -velocity[2];
        if (session.fallSpeed > D.waveSlamFallSpeed && descent < 1.0) {
            add('wave_slam', (session.fallSpeed - D.waveSlamFallSpeed) * D.waveSlamWearScale);
            session.fallSpeed = 0;
        } else {
            session.fallSpeed = Math.max(session.fallSpeed * 0.9, descent);
        }
        return;
    }

    const submerged = safe(() => GetEntitySubmergedLevel(vehicle), 0);
    if (submerged > D.submergedLevel) {
        add('submerged', D.submergedWearPerSecond * dt * submerged);
    }
}

function detectAircraft(vehicle, blueprint, dt, rpm, speed) {
    if (blueprint === 'heli') {
        const velocity = safe(() => GetEntityVelocity(vehicle), [0, 0, 0]);
        if (rpm > D.overtorqueRpm && velocity[2] > D.overtorqueClimbRate) {
            add('overtorque', D.overtorqueWearPerSecond * dt);
        }

        const rotor = safe(() => GetHeliMainRotorHealth(vehicle), session.mainRotor);
        if (session.mainRotor - rotor > 30) {
            add('rotor_strike', Math.min(D.rotorStrikeWear, (session.mainRotor - rotor) * 0.05));
        }
        session.mainRotor = rotor;
        return;
    }

    if (blueprint === 'plane') {
        if (speed > D.overspeedMs) {
            add('overspeed', D.overspeedWearPerSecond * dt * (speed / D.overspeedMs));
        }
        const rotation = safe(() => GetEntityRotationVelocity(vehicle), [0, 0, 0]);
        const rate = Math.sqrt(rotation[0] ** 2 + rotation[1] ** 2 + rotation[2] ** 2);
        if (rate > D.overGRate && speed > 40) {
            add('over_g', D.overGWearPerSecond * dt * (rate / D.overGRate));
        }
    }
}

/* ---------------------------------------------------------------------- loop */

function flush() {
    if (!session) return;
    const hasWear = Object.keys(pending).length > 0;
    if (!hasWear && pendingDistance < 25) return;

    emitNet('ag_mechanic:server:wear', {
        netId: session.info.netId,
        plate: session.info.plate,
        model: session.info.model,
        classId: session.info.classId,
        vin: session.info.vin,
        wear: pending,
        distance: AGM.util.round(pendingDistance, 1),
    });

    AGM.log.debug('flushed wear', pending, `${Math.round(pendingDistance)}m`);
    pending = {};
    pendingDistance = 0;
}

AGM.monitor.start = function () {
    setTick(async () => {
        await new Promise((resolve) => setTimeout(resolve, AGM.Damage.tick));

        const ped = PlayerPedId();
        const vehicle = GetVehiclePedIsIn(ped, false);

        /* Only the driver reports. Passengers would double-count everything. */
        if (!vehicle || GetPedInVehicleSeat(vehicle, -1) !== ped) {
            if (session) {
                flush();
                AGM.ui.hideTextUI();
                session = null;
            }
            return;
        }

        const info = AGM.state.describe(vehicle);
        if (!info) {
            session = null;
            return;
        }

        if (!session || session.vehicle !== vehicle) {
            resetSession(vehicle, info);
            AGM.state.ensure(info).then((state) => {
                if (state) AGM.perf.apply(vehicle, state);
            });
            return;
        }

        const now = GetGameTimer();
        const dt = Math.min(2.0, (now - session.lastTick) / 1000);
        session.lastTick = now;
        if (dt <= 0) return;

        const rpm = safe(() => GetVehicleCurrentRpm(vehicle), 0);
        const speed = safe(() => GetEntitySpeed(vehicle), 0);
        const blueprint = info.blueprint;

        detectPowertrain(vehicle, blueprint, dt, rpm, speed);
        detectBraking(vehicle, dt, speed);
        detectImpacts(vehicle, blueprint, dt, speed);
        detectTerrain(vehicle, blueprint, dt, speed);
        detectAirborne(vehicle, blueprint, dt);
        detectWater(vehicle, blueprint, dt);
        detectAircraft(vehicle, blueprint, dt, rpm, speed);

        /* Distance travelled, for slow honest wear. */
        const coords = GetEntityCoords(vehicle, true);
        const moved = AGM.util.dist(coords, session.coords);
        if (moved > 0.05 && moved < 200) pendingDistance += moved;
        session.coords = coords;

        session.rpm = rpm;
        session.speed = speed;
        session.bodyHealth = safe(() => GetVehicleBodyHealth(vehicle), session.bodyHealth);
        session.engineHealth = safe(() => GetVehicleEngineHealth(vehicle), session.engineHealth);

        if (now - lastFlush > AGM.Damage.flush) {
            lastFlush = now;
            flush();
        }
    });

    /* Keep the driven vehicle's handling in step with its condition. */
    setTick(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!session) return;
        const state = AGM.state.get(session.info.netId);
        if (state) AGM.perf.apply(session.vehicle, state);
    });

    /* Housekeeping. */
    setTick(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        AGM.perf.sweep();
    });
};

/** Flushes immediately, e.g. before a repair so the numbers are current. */
AGM.monitor.flushNow = flush;
