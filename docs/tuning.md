# Tuning the damage model

Two files decide how punishing the job is: `config/damage.js` (how fast things
wear) and `config/components.js` (what wearing out costs).

## Making it more or less harsh

The quickest lever is `AGM.Damage.detect`. Every `*WearPerSecond` value is
literally percentage points of health per second while that abuse is happening,
before the component's own weight and `decay` are applied.

```js
redlineWearPerSecond: 0.55,   // ~33 points of engine wear per minute on the limiter
wheelspinWearPerSecond: 0.95,
mileageWearPerKm: 0.30,       // the slow honest one - this is what fills the shop
```

Halve them all for a relaxed server; double them if you want mechanics genuinely
busy. `mileageWearPerKm` is the one that decides how much routine work exists, so
tune it separately from the abuse values.

Detection thresholds are in the same block. Raising `redlineRpm` to `0.98` means
only real limiter-bouncing counts; lowering `hardBrakeDecel` makes every firm
stop cost brake life.

## Deciding what needs a tow

Three fields on a component, in `config/components.js`:

```js
repair: 'garage',    // 'field' | 'mobile' | 'garage'
garageBelow: 25,     // a 'mobile' part becomes a workshop job under this
serviceAt: 55,       // below this the part genuinely needs work
```

- Want fewer tows? Lower `serviceAt` on the expensive workshop assemblies, or
  change a `garage` component to `mobile` with a low `garageBelow`.
- Want more? Raise `serviceAt`, or drop `garageBelow` thresholds.

`serviceAt` is the important one and the least obvious. A part above it is
*advisory* — a mechanic may replace it, but it does not force a recovery call.
That is what stops a scuffed bumper from becoming a truck job. The defaults are
low for engines and gearboxes and high for filters and pads, which is why light
damage stays a roadside fix and a real shunt does not.

## How much performance is lost

`effects` weights on each component, normalised per axis at load:

```js
C('brake_pads', 'Brake Pads & Discs', 'brakes', {
    effects: { brakes: 45 },
})
```

Weights are relative within an axis, so you can add a component without
rebalancing the others — the total is recomputed. The *floor* of each axis, in
`AGM.Components.axes`, sets how bad it can get:

```js
power: { label: 'Power', floor: 0.35 },   // 0% health => 35% power
```

Never set a floor to 0: a vehicle with literally no power is not interesting, it
is just stuck.

## Compounding neglect

`wearOn` is what makes cheap parts matter:

```js
C('oil_system', 'Oil Pump, Filter & Sump', 'engine', {
    wearOn: { engine: 2.6, gearbox: 1.2 },
})
```

The multiplier ramps in linearly once that part drops below 50% and reaches full
strength at 0%. So a dry sump does not instantly kill an engine — it quietly
makes every other kind of abuse two and a half times worse.

## What abuse hits what

`AGM.Damage.sources` maps a wear source to component weights:

```js
hard_brake: {
    label: 'Repeated heavy braking',
    blueprints: ['car', 'bike', 'plane'],
    weights: { brake_pads: 1.0, brake_lines: 0.45, tire_fl: 0.45, /* ... */ },
},
```

`blueprints` gates which vehicle types it applies to; the server rejects any
report of a source that does not apply, so adding one here is also what makes it
legal. `label` is what shows up in the report's symptom list, which is how a
mechanic tells a customer what they have been doing.

## Handling fields

`config/handling.js` maps performance axes onto real handling fields, with a
clamp on each:

```js
{ class: 'CHandlingData', field: 'fBrakeForce', axes: ['brakes'], min: 0.15, max: 1.50 }
```

Handling sub-classes are not equally well supported across FiveM builds. Any
field whose stock value reads back as zero or non-finite is skipped and logged
once, so if aircraft thrust does nothing on your build, check `CFlyingHandlingData`
there rather than in the code.

## Testing without waiting

```
agmechanic reset <plate>     -- back to factory condition
agmechanic stats             -- cache size and which bridges were detected
```

```lua
-- force wear from a test script
exports.ag_mechanic:applyVehicleWear(plate, nil, 'redline', 40)
exports.ag_mechanic:applyVehicleWear(plate, nil, 'impact_front', 70)
```

That second one is the fastest way to see the tow rule work: 40 points of
`redline` leaves a roadside job, 70 of `impact_front` does not.
