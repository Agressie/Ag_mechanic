/*
 * ag_mechanic - performance -> handling mapping
 * ============================================================================
 * How a performance axis is actually felt in game. Each entry scales a handling
 * field by the axis multiplier (or by the product of several axes).
 *
 * This is a table rather than code on purpose: handling sub-classes are not
 * equally well supported across FiveM builds, so if a field does nothing on your
 * server you can retarget or delete it here without touching any logic. Any
 * field whose stock value reads back as zero or non-finite is skipped
 * automatically.
 *
 *   class   handling class the field lives in
 *   field   handling field name
 *   axes    performance axes multiplied together to scale it
 *   min/max clamp on the resulting multiplier
 *   invert  true when a *lower* stock value means a worse vehicle
 * ============================================================================
 */

AGM.Handling = {
    car: [
        { class: 'CHandlingData', field: 'fInitialDriveForce', axes: ['power'], min: 0.30, max: 1.60 },
        { class: 'CHandlingData', field: 'fDriveInertia', axes: ['torque'], min: 0.50, max: 1.40 },
        { class: 'CHandlingData', field: 'fBrakeForce', axes: ['brakes'], min: 0.15, max: 1.50 },
        { class: 'CHandlingData', field: 'fTractionCurveMax', axes: ['traction'], min: 0.45, max: 1.30 },
        { class: 'CHandlingData', field: 'fTractionCurveMin', axes: ['traction'], min: 0.45, max: 1.30 },
        { class: 'CHandlingData', field: 'fSteeringLock', axes: ['steering'], min: 0.35, max: 1.20 },
        { class: 'CHandlingData', field: 'fSuspensionReboundDamp', axes: ['suspension'], min: 0.35, max: 1.30 },
        { class: 'CHandlingData', field: 'fSuspensionCompDamp', axes: ['suspension'], min: 0.35, max: 1.30 },
    ],

    bike: [
        { class: 'CHandlingData', field: 'fInitialDriveForce', axes: ['power'], min: 0.30, max: 1.60 },
        { class: 'CHandlingData', field: 'fDriveInertia', axes: ['torque'], min: 0.50, max: 1.40 },
        { class: 'CHandlingData', field: 'fBrakeForce', axes: ['brakes'], min: 0.15, max: 1.50 },
        { class: 'CHandlingData', field: 'fTractionCurveMax', axes: ['traction'], min: 0.45, max: 1.30 },
        { class: 'CHandlingData', field: 'fTractionCurveMin', axes: ['traction'], min: 0.45, max: 1.30 },
        { class: 'CHandlingData', field: 'fSteeringLock', axes: ['steering'], min: 0.35, max: 1.20 },
        { class: 'CHandlingData', field: 'fSuspensionReboundDamp', axes: ['suspension'], min: 0.35, max: 1.30 },
    ],

    boat: [
        { class: 'CHandlingData', field: 'fInitialDriveForce', axes: ['power', 'torque'], min: 0.30, max: 1.60 },
        { class: 'CHandlingData', field: 'fSteeringLock', axes: ['steering'], min: 0.35, max: 1.20 },
        { class: 'CBoatHandlingData', field: 'fAquaplaneForce', axes: ['traction'], min: 0.50, max: 1.30 },
        { class: 'CBoatHandlingData', field: 'fMoveResistance', axes: ['power'], min: 0.80, max: 1.40, invert: true },
    ],

    heli: [
        { class: 'CFlyingHandlingData', field: 'fThrust', axes: ['power', 'lift'], min: 0.45, max: 1.50 },
        { class: 'CFlyingHandlingData', field: 'fYawMult', axes: ['yaw'], min: 0.30, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fRollMult', axes: ['control'], min: 0.40, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fPitchMult', axes: ['control'], min: 0.40, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fYawStabilise', axes: ['control'], min: 0.40, max: 1.20 },
    ],

    plane: [
        { class: 'CFlyingHandlingData', field: 'fThrust', axes: ['power'], min: 0.40, max: 1.50 },
        { class: 'CFlyingHandlingData', field: 'fFormLiftMult', axes: ['lift'], min: 0.55, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fAttackLiftMult', axes: ['lift'], min: 0.55, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fRollMult', axes: ['control'], min: 0.40, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fPitchMult', axes: ['control'], min: 0.40, max: 1.30 },
        { class: 'CFlyingHandlingData', field: 'fYawMult', axes: ['yaw'], min: 0.35, max: 1.30 },
        { class: 'CHandlingData', field: 'fBrakeForce', axes: ['brakes'], min: 0.20, max: 1.50 },
    ],
};

/**
 * What a dead critical component does. `nodrive` deliberately leaves the engine
 * running: a snapped driveshaft is not a flat battery, and the difference is
 * obvious from the driver's seat.
 */
AGM.Handling.crippled = {
    nostart: { engineOff: true, undriveable: true, driveForce: 0.0 },
    nodrive: { driveForce: 0.0 },
    nosteer: { steeringLock: 0.08 },
    nofly: { rotorDead: true },
    nocontrol: { controlMult: 0.15 },
};
