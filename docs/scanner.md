# The scanner

A handheld OBD tool, and the other half of diagnostics. It is a real device on
screen: a character LCD and six buttons, and you work the firmware the way you
would work the real thing.

## What it can and cannot see

The scanner reads what the vehicle's control modules know. That is a lot — and
it is not everything.

| The scanner finds | Only an inspection finds |
| --- | --- |
| engine, gaskets, air filter, plugs, oil, cooling | driveshaft |
| fuel system, exhaust, ECU, battery | brake pads and discs |
| clutch, gearbox | suspension, springs and dampers |
| brake lines, steering, wheel-speed sensors, lights | wheels, hubs and bearings |
| aircraft: rotors, gearboxes, hydraulics, controls, avionics | body panels, frame, glass |

Nothing is watching a brake pad wear down, so no code will ever set for one.
That is why the two tools are complementary rather than alternatives, and why a
mechanic who only ever plugs the cable in will keep missing things.

The split is per component: `ecu: false` in `config/dtc.js` makes a part
invisible to the scanner. Both tools grant knowledge into the same place, so a
vehicle you have scanned *and* inspected gives you a complete report.

## Using it

You need `obd_scanner` in your inventory. Then either:

- target the vehicle → **Plug in a diagnostic scanner**, or
- use the item, if your inventory is wired for it (see `docs/items.md`).

The device boots, links up and reports the protocol, VIN, MIL state and code
counts. From there:

| Button | Does |
| --- | --- |
| ▲ ▼ | move the cursor |
| ◀ ▶ | jump a page |
| ENTER | select, and hold to confirm an erase |
| BACK | up one level; from the main menu it unplugs |
| ERASE | jumps straight to the erase prompt |
| INFO | vehicle information |
| UNPLUG | done |

The keyboard mirrors the buttons — arrows, Enter, Backspace/Escape, Delete —
and pressing a key visibly depresses the matching button.

## The menu

| Page | What it gives you |
| --- | --- |
| READ CODES | confirmed faults, worst first. Open one for the detail |
| PENDING CODES | seen but not confirmed over enough drive cycles |
| MODULE SCAN | how many faults each module holds — this is the "where" |
| LIVE DATA | sensor values, refreshed while the page is open |
| FREEZE FRAME | the conditions captured when the code set |
| VEHICLE INFO | VIN, plate, protocol, calibration ID, odometer, MIL |
| I/M MONITORS | readiness monitors, and whether they have run |
| ERASE CODES | clears stored codes. Repairs nothing |

Opening a code is the payoff. It names the fault, the module that reported it,
the actual part, the sub-location — *which* cylinder, *which* corner — and a
plain-language description of where to go and look:

```
P0301                              2/6  STORED
Cylinder 1 misfire detected
------------------------------------------------
SYSTEM   Engine Control Module
PART     Spark Plugs & Coil Packs
AT       Cylinder 1, bank 1
SEVERITY HIGH
------------------------------------------------
WHERE    Coil pack on cylinder 1, under the
         ignition cover
```

## Codes are deterministic

The same vehicle always reports the same cylinder, bank, corner or blade for the
same fault. A mechanic who scans a car twice and gets two different answers has
learnt nothing, so locations are derived from a hash of the vehicle key and the
component rather than rolled fresh each time. Cylinder count comes from the
model, so a given car is consistent across every scan anyone ever runs on it.

Code namespaces follow the machine, because they do in life:

| Machine | Namespace | Example |
| --- | --- | --- |
| Cars and bikes | OBD-II | `P0301`, `C0045`, `B1201`, `U0100` |
| Helicopters and aircraft | BITE | `RTR-118`, `ENG-041`, `HYD-002` |
| Boats | SAE J1939 | `SPN 100 FMI 1` |

## Erasing codes

Holding ENTER on the erase page clears the stored codes and resets the readiness
monitors. It repairs precisely nothing.

What actually happens:

1. Stored codes drop back to **pending** and the MIL goes out.
2. The readiness monitors read **incomplete** — a giveaway to the next person
   who scans it.
3. After `Config.scanner.reconfirmMetres` of driving (2 km by default) the faults
   re-confirm and the light comes back on.

This is deliberately the trick somebody pulls before selling a car, and it is
logged to `ag_mechanic_log` with the actor and the number of codes cleared. Set
`Config.scanner.allowErase = false` to remove it, or
`eraseRequiresJob = true` to restrict it to mechanics.

## Configuration

```js
scanner: {
    item: 'obd_scanner',       // required in inventory; no item, no scan
    hookupDuration: 4500,      // finding the port
    linkTtl: 10 * 60 * 1000,   // how long the findings stay usable
    allowErase: true,
    eraseRequiresJob: false,
    reconfirmMetres: 2000,     // driving needed before a cleared fault returns
    liveInterval: 900,         // live data refresh, ms
}
```

## Adding or changing codes

`config/dtc.js`. A component entry looks like:

```js
radiator: C({
    module: 'ECM',
    location: 'fixed',
    where: 'Front of the engine bay, behind the grille',
    codes: [
        D('P0128', 'Coolant thermostat below regulating temperature', { at: 68, severity: 'low' }),
        D('P0480', 'Cooling fan 1 control circuit', { at: 45, severity: 'medium' }),
        D('P0217', 'Engine over-temperature condition', { at: 25, severity: 'high' }),
    ],
}),
```

`at` is the health below which the code sets, so several codes on one component
make the fault escalate as it gets worse. `location` decides which placeholders
you may use in the code and description:

| `location` | Placeholders | Renders as |
| --- | --- | --- |
| `cylinder` | `{cyl}` `{bank}` | "Cylinder 3, bank 2" |
| `bank` | `{bank}` | "Bank 1" |
| `wheel` | `{wheel}` | "Left front" |
| `blade` | `{n}` | "Blade 2" |
| `wing` | `{wing}` | "Right wing" |
| `fixed` | `{bank}` | no sub-location |

Set `loc: false` on a code that is not specific to one cylinder or corner — a
random-misfire code should not claim a cylinder it has not identified.

Run `node tools/validate.js` afterwards. It checks that every component has an
entry, that modules exist, and that no code uses a placeholder its location kind
cannot fill — otherwise a stray `{cyl}` renders literally on the LCD.
