# Moving the shop

Everything world-positioned lives in `config/locations.js`, in one block per
shop, so relocating the whole business is a single edit.

The defaults are set up around the Los Santos Customs on Greenwich Pl. If you
are putting the job somewhere else — a custom MLO, Benny's, an airfield — you
need to re-survey the marks below.

## Getting coordinates

In game, with `Config.debug = true`:

```
/agmechanic_debug          -- dumps the nearest vehicle's state to F8
```

For raw coordinates any of the usual tools work. ox_lib's own is convenient
since you already have it:

```
/ox_lib:copyCoords
```

Paste them as `[x, y, z]` arrays. Headings are single floats in degrees.

## What each mark is for

```js
{
    id: 'lamesa',                 // internal id; used in the database and logs
    label: 'La Mesa Auto Works',  // shown on the tablet and blip
    job: 'mechanic',              // must match Config.job.name

    bays: [ ... ],                // vehicle must be inside one for workshop jobs
    lifts: [ ... ],               // where a mechanic stands to work on the bay
    stash: { ... },               // the shared parts store
    duty: { ... },                // clock on / off point
    delivery: { ... },            // the parts van's route and marks
}
```

### bays

Rotated boxes. A vehicle counts as "on a lift" when its centre is inside one, and
that is what gates every `garage` repair and heavy install.

```js
{ coords: [-337.0, -136.5, 39.0], size: [10.0, 12.0, 4.0], rotation: 70.0, label: 'Bay 1' }
```

`size` is the full extent on each axis, `rotation` is the box's yaw. Make them a
little generous — a car parked slightly crooked should still count. Set
`Config.debug = true` to have ox_target draw the zones while you tune them.

The server checks bay membership itself, with the same maths, so a client cannot
claim to be on a lift when it is not.

### lifts

Sphere zones a mechanic interacts with. Each one names the bay it serves; the
option finds whatever vehicle is parked in that bay and opens its report.

```js
{ coords: [-337.0, -136.5, 39.0], radius: 6.0, bay: 'Bay 1' }
```

### stash

```js
stash: {
    id: 'ag_mechanic_lamesa',       // must be unique per shop
    label: 'Auto Works Parts Store',
    slots: 250,
    weight: 1000000,                // grams
    point: { coords: [...], radius: 1.4 },   // physical access, plus the tablet
}
```

Changing `id` after the shop has been in use orphans whatever was in the old
stash — ox_inventory keys its contents on that string.

### delivery

Five marks and an optional list of waypoints. The van drives them in order.

| Mark | What happens there |
| --- | --- |
| `spawn` | van appears here, ideally out of sight down the road |
| `route` | optional waypoints driven in order before the final approach |
| `park` | van parks up outside the shop |
| `drop` | driver sets the pallet down here; it stays put |
| `sign` | driver stands here with the clipboard, waiting to be signed |
| `exit` | van drives towards here, then despawns |

Pick `spawn` on an actual road node — the driver uses GTA's pathfinding, and a
van spawned in a field will simply sit there. Keep `drop` and `sign` clear of the
bay entrances so a parked pallet cannot block your own doors, and keep them
within a few metres of each other: signing is distance-checked at 8 m on the
server.

If the van cannot reach `park` within 45 seconds it unloads wherever it stopped
rather than giving up, so an imperfect route degrades instead of breaking.

## Multiple shops

`shops` is an array. Add a second entry with its own `id` and its own stash id
and the whole system — tablet, orders, deliveries, bays — works per shop. Both
will answer to the same `job`, so use `Config.job.grades` for who can do what
rather than trying to separate access by shop.

## Blips

```js
blip: { sprite: 446, colour: 47, scale: 0.8, label: 'Auto Works' }
```

Set `blip: false` for none. The blip is anchored to the stash point, falling back
to the first bay.
