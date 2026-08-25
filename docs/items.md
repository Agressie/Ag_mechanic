# Items

Every item this resource consumes or gives out. Paste the block for your
inventory into its item list and restart it — nothing here needs images, though
they are obviously nicer with them.

The names on the left are what `config/shop.js`, `config/components.js` and
`config/tiers.js` refer to. If you rename one, rename it in the config too.

## ox_inventory

Add to `ox_inventory/data/items.lua`, inside the `return { ... }` table:

```lua
    -- Consumables
    ['ducttape'] = { label = 'Duct Tape', weight = 120, close = true, client = { export = 'ag_mechanic.useImprovised' } },
    ['zipties'] = { label = 'Cable Ties', weight = 40, close = true, client = { export = 'ag_mechanic.useImprovised' } },
    ['obd_scanner'] = { label = 'OBD Diagnostic Scanner', weight = 800, stack = false, close = true, client = { export = 'ag_mechanic.useScanner' } },
    ['mechanic_toolbox'] = { label = 'Mechanic Toolbox', weight = 4000, stack = false },
    ['mechanic_tablet'] = { label = 'Shop Tablet', weight = 700, stack = false, close = true, client = { export = 'ag_mechanic.useTablet' } },

    -- Engine & Induction
    ['air_filter'] = { label = 'Air Filter', weight = 500 },
    ['spark_plugs'] = { label = 'Spark Plugs & Coil Pack', weight = 400 },
    ['oil_filter'] = { label = 'Oil Filter & Service Kit', weight = 600 },
    ['radiator'] = { label = 'Radiator & Coolant', weight = 5000 },
    ['gasket_set'] = { label = 'Head Gasket Set', weight = 900 },
    ['fuel_pump'] = { label = 'Fuel Pump & Lines', weight = 1200 },
    ['exhaust'] = { label = 'Exhaust & Manifold', weight = 6000 },
    ['engine_block'] = { label = 'Engine Assembly', weight = 90000 },

    -- Drivetrain
    ['clutch_kit'] = { label = 'Clutch & Flywheel Kit', weight = 9000 },
    ['gearbox'] = { label = 'Gearbox Assembly', weight = 45000 },
    ['driveshaft'] = { label = 'Driveshaft & Differential', weight = 15000 },
    ['drive_chain'] = { label = 'Drive Chain & Sprocket Set', weight = 1500 },

    -- Braking
    ['brake_pads'] = { label = 'Brake Pads & Discs', weight = 2500 },
    ['brake_lines'] = { label = 'Brake Lines & Master Cylinder', weight = 800 },

    -- Chassis & Running Gear
    ['suspension_kit'] = { label = 'Suspension & Damper Kit', weight = 12000 },
    ['steering_rack'] = { label = 'Steering Rack & Column', weight = 8000 },
    ['wheel_rim'] = { label = 'Wheel & Hub', weight = 7000 },
    ['tire'] = { label = 'Tyre', weight = 9000 },

    -- Body & Glass
    ['body_panel'] = { label = 'Body Panel & Filler', weight = 9000 },
    ['glass_set'] = { label = 'Glass Set', weight = 5000 },
    ['light_assembly'] = { label = 'Light Assembly', weight = 1200 },

    -- Electrical
    ['battery'] = { label = 'Battery & Alternator', weight = 12000 },
    ['wiring_harness'] = { label = 'Wiring Harness & ECU', weight = 2000 },

    -- Aircraft
    ['turbine_module'] = { label = 'Turbine / Powerplant Module', weight = 120000 },
    ['rotor_gearbox'] = { label = 'Main Rotor Gearbox', weight = 80000 },
    ['main_rotor_blade'] = { label = 'Main Rotor Blade Set', weight = 60000 },
    ['tail_rotor_blade'] = { label = 'Tail Rotor Blade Set', weight = 12000 },
    ['tail_drive_shaft'] = { label = 'Tail Drive Shaft', weight = 9000 },
    ['hydraulic_pack'] = { label = 'Hydraulic Pack', weight = 12000 },
    ['control_linkage'] = { label = 'Control Linkage Set', weight = 3000 },
    ['control_surface'] = { label = 'Control Surface', weight = 15000 },
    ['propeller'] = { label = 'Propeller Assembly', weight = 20000 },
    ['landing_gear'] = { label = 'Landing Gear & Actuator', weight = 35000 },
    ['airframe_section'] = { label = 'Airframe Section', weight = 40000 },
    ['avionics_unit'] = { label = 'Avionics Unit', weight = 4000 },

    -- Marine
    ['bilge_pump'] = { label = 'Bilge Pump', weight = 1500 },

    -- Performance Upgrades
    ['engine_intake'] = { label = 'High-Flow Air Filter & Intake', weight = 7000 },
    ['engine_head'] = { label = 'Ported Head & Uprated Gaskets', weight = 7000 },
    ['engine_forged'] = { label = 'Forged Internals & Camshafts', weight = 7000 },
    ['engine_race'] = { label = 'Billet Race Block', weight = 7000 },
    ['turbo_kit'] = { label = 'Bolt-On Turbocharger Kit', weight = 7000 },
    ['brakes_steel'] = { label = 'Steel Brake Kit', weight = 7000 },
    ['brakes_titanium'] = { label = 'Titanium Brake Kit', weight = 7000 },
    ['brakes_carbon'] = { label = 'Carbon Fibre Brake Kit', weight = 7000 },
    ['trans_close'] = { label = 'Close-Ratio Gearset', weight = 7000 },
    ['trans_sequential'] = { label = 'Short-Shift Sequential Gearbox', weight = 7000 },
    ['trans_dogbox'] = { label = 'Dogbox Race Transmission', weight = 7000 },
    ['susp_springs'] = { label = 'Lowering Spring Set', weight = 7000 },
    ['susp_street'] = { label = 'Street Coilovers', weight = 7000 },
    ['susp_sport'] = { label = 'Sport Coilovers', weight = 7000 },
    ['susp_race'] = { label = 'Competition Race Suspension', weight = 7000 },
    ['chassis_cage'] = { label = 'Welded Roll Cage', weight = 7000 },
    ['chassis_doors'] = { label = 'Reinforced Doors & Pillars', weight = 7000 },
    ['chassis_titanium'] = { label = 'Titanium Chassis Bracing', weight = 7000 },
    ['chassis_ballistic'] = { label = 'Bullet-Resistant Body Work', weight = 7000 },
    ['chassis_shell'] = { label = 'Ballistic Composite Shell', weight = 7000 },
    ['rotor_balanced'] = { label = 'Balanced Composite Blades', weight = 7000 },
    ['rotor_highlift'] = { label = 'High-Lift Composite Blades', weight = 7000 },
    ['rotor_carbon'] = { label = 'Carbon Fibre Rotor System', weight = 7000 },
    ['prop_balanced'] = { label = 'Balanced Composite Propeller', weight = 7000 },
    ['prop_constant'] = { label = 'Constant-Speed Propeller', weight = 7000 },
    ['prop_carbon'] = { label = 'Carbon Fibre Race Propeller', weight = 7000 },

```

The three `client.export` entries are what make using an item do something:

| Item | Using it |
| --- | --- |
| `mechanic_tablet` | opens the tablet |
| `obd_scanner` | plugs into the nearest vehicle and opens the scanner device |
| `ducttape` / `zipties` | opens the report filtered to what can be bodged |

## qb-inventory

QBCore items live in `qb-core/shared/items.lua`. The shape is different but the
names are the same:

```lua
['air_filter'] = {
    name = 'air_filter', label = 'Air Filter', weight = 500,
    type = 'item', image = 'air_filter.png', unique = false, useable = false,
    shouldClose = true, combinable = nil, description = 'Cheap, and neglected on every vehicle you will ever see.',
},
```

`obd_scanner` is not optional flavour: without one in your inventory the scanner
interaction is refused, server side. Everything the control modules know is
behind that item.

For the three useable items, set `useable = true` and register the handler in
your own server script:

```lua
QBCore.Functions.CreateUseableItem('mechanic_tablet', function(source)
    TriggerClientEvent('ag_mechanic:client:useTablet', source)
end)
```

`ag_mechanic:client:useTablet` is the only event the resource listens for; the
scanner and improvised repairs are reachable from the ox_target menu on the
vehicle, so they need no item handler.

## No inventory resource at all

The resource still runs. `AGM.inv` falls back to a database-backed stash
(`ag_mechanic_stash`) and the tablet's Stash app becomes the real interface
rather than a manifest. Player inventories cannot be read in that mode, so parts
and consumable checks will always fail — treat it as a way to get the shop up and
running, not a way to run it long term.
