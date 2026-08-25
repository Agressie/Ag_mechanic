# ag_mechanic

A mechanic job for FiveM (Qbox / `qbx_core`) built around one idea: a vehicle is
not a single health bar. It is twenty-odd parts that wear out in different ways,
and a mechanic's job is working out **which** ones.

Written in JavaScript, with a Svelte tablet UI and a custom diagnostics minigame.

---

## What it actually does

### Parts have names, not numbers

GTA gives you "Brakes 2" and "EMS Upgrade Level 3". This gives you what a
mechanic would say out loud:

| Category | Ladder |
| --- | --- |
| Brakes | Factory Brakes → Steel → Titanium → Carbon Fibre |
| Engine | Factory → High-Flow Air Filter & Intake → Ported Head & Uprated Gaskets → Forged Internals & Camshafts → Billet Race Block |
| Gearbox | Factory → Close-Ratio Gearset → Short-Shift Sequential → Dogbox Race Transmission |
| Suspension | Factory → Lowered Springs → Street Coilovers → Sport Coilovers → Competition Race Suspension |
| Chassis (GTA's "armour") | Factory → Welded Roll Cage → Reinforced Doors & Pillars → Titanium Chassis Bracing → Bullet-Resistant Body Work → Ballistic Composite Shell |
| Forced induction | Naturally Aspirated → Bolt-On Turbocharger |

Bikes get their own wording (Big-Bore Race Kit, Titanium Frame Bracing).
Aircraft and boats get **virtual** ladders — GTA will not fit performance mods to
them, so the tier is stored by this resource and its effect applied directly:
Balanced Composite Blades, High-Lift Composite Blades, Carbon Fibre Rotor System,
Constant-Speed Propeller, Cupped Race Prop, and so on.

### Every major part has its own health

Twenty-five components on a car, twenty-three on a bike, and purpose-built sets
for helicopters, fixed-wing aircraft and boats. Engine, gaskets, air filter,
spark plugs, oil system, radiator, fuel system, exhaust, ECU, battery, clutch,
gearbox, driveshaft, brake pads, brake lines, suspension, steering, wheels, four
individual tyres, body, glass, lights. Rotorcraft swap in main rotor, tail rotor,
main gearbox, tail drive, swashplate hydraulics, skids and avionics. Aircraft add
ailerons, elevator, rudder, flaps, propeller and landing gear.

### Abuse damages the right things

Wear is not spread evenly. Each kind of abuse maps to its own set of parts:

| What the driver did | What it costs them |
| --- | --- |
| Sat on the rev limiter | engine, gaskets, oil system, plugs, clutch |
| Money-shifted it | clutch, gearbox, driveshaft, engine |
| Wheelspin and burnouts | driven tyres, clutch, driveshaft, chain |
| Repeated heavy braking | pads, lines, front tyres — with fade ramping the longer it goes on |
| Front-end shunt | body, radiator, lights, suspension, steering |
| Rear-end shunt | body, exhaust, fuel system, tail rotor if it has one |
| Landed a jump badly | suspension, wheels, steering, driveshaft |
| Off-road at speed | suspension, air filter, tyres |
| Revs with no airflow | radiator, gaskets, engine |
| Water | ECU, battery, air filter, plugs, avionics |
| Gunfire | body, glass, radiator, fuel system, tyres |
| Simply driving it | filters, plugs, oil, pads, tyres, clutch |
| Rotorcraft over-torque | main gearbox, engine, tail drive |
| Flying past Vne, or over-G | airframe, control surfaces, hydraulics |
| Boats slamming off waves | hull, gearbox, prop, steering |

Neglect compounds: a dry oil system eats the engine **2.6× faster**, and a shot
radiator cooks the gaskets. Look after the cheap parts or pay for the expensive
ones.

Everything degrades performance through the vehicle's own handling fields —
drive force, brake force, traction curves, steering lock, damping, and thrust /
yaw / roll for aircraft — so a tired car feels tired rather than artificially
speed-capped. Critical parts that die outright stop the vehicle: a dead battery
or fuel pump means it will not start; a dead gearbox means it runs and goes
nowhere; a dead main rotor means it does not fly.

### You cannot fix what you have not found

Two tools, and they see different halves of the vehicle.

**The scanners** are handheld devices with an LCD and six buttons — you work the
firmware, not a menu. Anyone can carry one; it is not restricted to the job. They
read what the control modules know: real fault codes with severities, the system
that reported each one, the exact sub-location (*which* cylinder, *which*
corner), and plain-language directions to the part. Also live sensor data, freeze
frames, readiness monitors, and a system tree you walk with the arrows —
system → part → fault → detail, with healthy systems still browsable.

There are three, and they are not interchangeable, because a car scan tool cannot
talk to an aircraft:

| Item | Device | Reads | Bus |
| --- | --- | --- | --- |
| `obd_scanner` | AGM-9000 | cars, bikes | OBD-II / CAN |
| `bite_tester` | AV-4 | helicopters, aircraft | ARINC 429 |
| `marine_diagnostic` | MD-2 | boats | SAE J1939 |

Each speaks its own trade language too — stored codes on modules, active faults
on LRUs, active DTCs on ECUs — so the three genuinely feel like different
instruments. Bring the wrong box and it tells you which one you wanted. Codes are
deterministic: the same car always reports the same cylinder, so scanning twice
tells you the same story. Full details in [`docs/scanner.md`](docs/scanner.md).

```
P0301                              2/6  STORED
Cylinder 1 misfire detected
------------------------------------------------
SYSTEM   Engine Control Module
PART     Spark Plugs & Coil Packs
AT       Cylinder 1, bank 1
WHERE    Coil pack on cylinder 1, under the
         ignition cover
```

Erasing codes turns the light off and repairs nothing: faults drop to pending,
the monitors read *incomplete*, and everything re-confirms after 2 km of
driving. It is logged, because it is exactly the trick somebody pulls before
selling a car.

**Inspecting by hand** is the minigame, and it finds everything no sensor is
watching:

1. **Back the bolts off.** Hold `SPACE` to load the breaker bar and release
   inside the torque band. Overshoot and you round the head off; stop short and
   it has not moved. Bands narrow and the needle climbs faster as you work along.
2. **Unplug the sensor lines.** Hold `SHIFT` to press the release tab, then drag
   the connector out at a steady rate. Snatch it and the tab snaps.

How cleanly that goes decides how much you learn: exact figures on everything,
exact on faults only, rough estimates, or just the obvious faults. It is also
the only way to read the vehicle's *history* — "Held on the rev limiter ×3" — so
a mechanic can tell the customer what they have been doing.

Neither tool is a substitute for the other. No code will ever set for a worn
brake pad, a bent driveshaft or tired dampers, because nothing is watching them:

| The scanner finds | Only an inspection finds |
| --- | --- |
| engine, gaskets, filter, plugs, oil, cooling, fuel | driveshaft |
| exhaust, ECU, battery, clutch, gearbox | brake pads and discs |
| brake lines, steering, wheel-speed sensors, lights | suspension and dampers |
| rotors, gearboxes, hydraulics, controls, avionics | wheels, body, glass |

Knowledge is tracked **per component**, so the two tools accumulate into one
report that says which found what. Findings go stale after fifteen minutes, or
sooner for a part whose condition has drifted — per part, so one thing changing
does not throw away everything you know about the rest of the car. Repairing
something refreshes that part rather than voiding the lot.

### Three ways to fix it — and only sometimes a tow

| | Who | Parts | Result |
| --- | --- | --- | --- |
| **Improvised** | anyone | duct tape or cable ties | capped at **40%**, and it can fail |
| **Roadside** | mechanic | the real part | 100% |
| **Workshop** | mechanic, vehicle on a lift | the real part | 100% |

The component decides. An air filter, radiator, tyre or brake line is a roadside
job. An engine, clutch, gearbox, driveshaft or steering rack needs a lift. And
some parts *move between the two*: suspension is a roadside job until it drops
below 25%, at which point it is a workshop job.

A part also only counts as *needing* work once it falls under its own service
threshold — low for expensive workshop assemblies, high for consumables. That is
what stops every scuffed bumper from turning into a recovery call. A light knock
is a roadside job; a proper shunt is a truck.

**Can this be fixed here?** is its own interaction, so a driver can find out
before deciding whether to phone for recovery. Towing itself is deliberately not
part of this resource.

### The tablet

`F7`, `/tablet`, the item, or the tablet target at the shop. Access is decided by
job and grade, server side.

- **Home** — shop balance, staff on shift, stash totals, orders in flight,
  consumables running low, and a live banner when a delivery is outside.
- **Personnel** — the roster, hire from nearby players or by citizen id, promote
  and demote, and let people go. Nobody can touch somebody at or above their own
  grade, and the framework's answer is always final.
- **Stash** — the shop's parts store. With ox_inventory or qb-inventory running
  this is a live manifest with a button to open the real UI; without one, it *is*
  the interface.
- **Parts Shop** — the catalogue, a cart, and the order list.

Apps are declared in config and resolved through a registry, so adding a fifth
later is a config entry plus one Svelte component.

### Ordering parts, and the delivery

Order from the tablet. It costs the shop account, takes **an hour of real time**
(ticking whether or not anyone is online), then lands at the depot as `ready`.

Nothing arrives on its own. Somebody has to **check the order in** from the shop
app — and that is what sends the van:

1. A van spawns down the road and drives the route to the shop.
2. The driver parks, gets out, opens the back and carries a pallet to the
   forecourt.
3. They set it down, produce a clipboard, and wait.
4. An employee walks up and signs for it via ox_target.
5. The parts go into the stash, the driver gets back in and drives off.

The pallet stays where it was put. If nobody signs within five minutes the parts
go into the stash anyway — the shop is not going to lose a delivery over
paperwork — and the driver leaves. If the hosting client disconnects mid-run the
order is settled rather than left stuck, and a hard timeout tears the whole thing
down so a van can never end up parked across your door forever.

---

## Requirements

| | |
| --- | --- |
| Framework | [`qbx_core`](https://github.com/Qbox-project/qbx_core) (Qbox) |
| Required | [`ox_lib`](https://github.com/overextended/ox_lib), [`ox_target`](https://github.com/overextended/ox_target), [`oxmysql`](https://github.com/overextended/oxmysql) |
| Inventory | `ox_inventory` (recommended), `qb-inventory`, ESX, or a built-in database fallback |
| Banking | Renewed-Banking, fd_banking, qbx_management, qb-management, or it bills the person ordering |

The inventory and banking layers are bridges: they detect what is running at boot
and adapt. `AGM.inv.backend` and `AGM.society.backend` are printed on start so
you can see what it picked.

## Installing

```
1. Drop the folder into your resources as `ag_mechanic`.
2. ensure ag_mechanic          (after ox_lib, ox_target, oxmysql and qbx_core)
3. Add the items — see docs/items.md
4. Move the shop — see docs/locations.md
```

Tables are created on first start. `sql/install.sql` is there if you would
rather apply them yourself.

Add the job to `qbx_core/shared/jobs.lua` with grades matching
`Config.job.grades` in `config/config.js` — five by default: Trainee, Mechanic,
Senior Mechanic, Shop Manager, Owner.

## Configuration

| File | What lives there |
| --- | --- |
| `config/config.js` | job, grades and permissions, tablet, repair rules, diagnostics, economy, persistence, anti-abuse, all player-facing text |
| `config/components.js` | the component health blueprints — the heart of it |
| `config/tiers.js` | the named upgrade ladders |
| `config/dtc.js` | fault codes, which system reports them, where each part physically is, and the three diagnostic devices |
| `config/damage.js` | what each kind of abuse damages, and detection thresholds |
| `config/handling.js` | how a performance axis maps onto handling fields |
| `config/shop.js` | catalogue, prices, order and delivery timings |
| `config/locations.js` | bays, lifts, stash, duty point and the delivery route |
| `config/classes.js` | GTA vehicle class → blueprint |

Adding a component is one entry in `config/components.js`. Effect weights are
normalised per axis at load, so you do not have to rebalance the other twenty
numbers to make room for it.

## Checking your config

After editing anything in `config/`, run:

```bash
node tools/validate.js
```

It cross-references the whole config set — part names against the catalogue,
wear sources against the components they claim to damage, handling axes against
components that actually affect them, delivery marks, tablet grades — and exits
non-zero on anything wrong. It needs nothing but Node.

## The tablet UI

Source in `web/`, built output committed in `html/`. You only need Node to
change it:

```bash
cd web
npm install
npm run dev      # http://localhost:5173/?screen=tablet
npm run build    # writes ../html
```

`?screen=` takes `tablet`, `report`, `upgrades`, `diagnose` or `scanner`, and
`?screen=scanner&device=obd|bite|marine` picks which of the three tools to render.
The dev fixtures in `web/src/lib/dev.js` mean every screen works in a plain
browser — including canned RPC responses, so the tablet's apps and the scanner's
live data both tick without the game.

## Exports and commands

```lua
-- server
exports.ag_mechanic:getVehicleHealth(plate, vin)                  --> { component = 0-100 } | nil
exports.ag_mechanic:getVehicleTiers(plate, vin)                   --> { category = { index, label } } | nil
exports.ag_mechanic:applyVehicleWear(plate, vin, source, amount)  --> boolean
```

```lua
-- client (for inventory item use)
exports.ag_mechanic:useTablet()
exports.ag_mechanic:useScanner()
exports.ag_mechanic:useImprovised()
```

`agmechanic <flush|stats|orders|reset [plate]>` — console, or a player with the
`command.agmechanic` ace. `agmechanic_debug` dumps the nearest vehicle's state to
F8 when `Config.debug` is on.

## Documentation

| | |
| --- | --- |
| [`docs/scanner.md`](docs/scanner.md) | the scanner: what it can see, the menu, erasing codes, adding your own |
| [`docs/items.md`](docs/items.md) | every item, ready to paste into ox_inventory or qb-core |
| [`docs/locations.md`](docs/locations.md) | moving the shop: bays, lifts, stash, delivery route |
| [`docs/tuning.md`](docs/tuning.md) | making the damage model harsher or gentler |

## Notes on the implementation

- **The server is the authority.** Clients detect abuse because they are the only
  ones who can see RPM, wheel slip and impact direction, but every report is rate
  limited, clamped per component, checked against the vehicle's blueprint, and
  distance-checked against the player before it counts.
- **No module system on the client.** FiveM's client JS runtime evaluates every
  file into one shared global scope, so everything hangs off a single `AGM`
  namespace with load order declared in `fxmanifest.lua`. The server does the
  same for consistency.
- **`global.exports` on the server.** Server scripts are CommonJS modules, where
  the bare `exports` identifier is `module.exports`, not FiveM's export proxy.
- **Zones are created from Lua.** `client/lib_bridge.lua` handles ox_target zone
  registration and the yielding parts of ox_lib (progress bars, dialogs), because
  ox_lib's zone maths needs real `vector3` values and a JS export cannot wait on
  a Lua coroutine.
- **Handling fields are a config table.** Handling sub-classes are not equally
  well supported across FiveM builds. Any field whose stock value reads back as
  zero or non-finite is skipped automatically, and you can retarget the rest in
  `config/handling.js` without touching logic.

## Licence

MIT.
