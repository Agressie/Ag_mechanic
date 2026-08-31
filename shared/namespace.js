/*
 * ag_mechanic - shared namespace
 *
 * FiveM's client-side JS runtime has no module system: every file listed in the
 * manifest is evaluated in order inside one shared global scope. So instead of
 * require()/import we hang everything off a single global namespace and rely on
 * the load order declared in fxmanifest.lua. The server side (real Node) shares
 * globalThis per resource, so the exact same pattern works there.
 */
globalThis.AGM = globalThis.AGM || {};

AGM.RESOURCE = GetCurrentResourceName();
AGM.IS_SERVER = IsDuplicityVersion();
AGM.IS_CLIENT = !AGM.IS_SERVER;

/** Tiny structured logger. Debug output is gated behind Config.debug. */
AGM.log = {
    info: (...a) => console.log(`^5[ag_mechanic]^7`, ...a),
    warn: (...a) => console.log(`^3[ag_mechanic]^7`, ...a),
    error: (...a) => console.log(`^1[ag_mechanic]^7`, ...a),
    debug: (...a) => {
        if (AGM.Config && AGM.Config.debug) console.log(`^6[ag_mechanic:debug]^7`, ...a);
    },
};

/*
 * Every file in the manifest is evaluated into one shared scope, so a config
 * file that never loaded leaves a hole that only surfaces as "cannot read
 * properties of undefined" somewhere unrelated, in a file that is fine.
 *
 * Called from both entry points at boot. It does not just name the missing
 * file, it goes and looks at it, because the ways this happens each need a
 * different fix.
 */
AGM.CONFIG_FILES = {
    Config: 'config/config.js',
    Classes: 'config/classes.js',
    Components: 'config/components.js',
    Tiers: 'config/tiers.js',
    Dtc: 'config/dtc.js',
    Damage: 'config/damage.js',
    Handling: 'config/handling.js',
    Shop: 'config/shop.js',
    Locations: 'config/locations.js',
    util: 'shared/util.js',
    Health: 'shared/health.js',
};

/*
 * The script lists out of fxmanifest.lua, with Lua line comments stripped
 * first - a commented-out entry is still in the file's text, and mistaking one
 * for a live entry is exactly the wrong answer to give someone.
 */
AGM.manifestScripts = function (manifest, block) {
    const match = manifest.match(new RegExp(`${block}\\s*\\{([^}]*)\\}`));
    if (!match) return [];
    return Array.from(match[1].replace(/--[^\n]*/g, '').matchAll(/'([^']+)'/g), (m) => m[1])
        .filter((file) => !file.startsWith('@'));
};

/*
 * What the server is *actually* running, as opposed to what fxmanifest.lua on
 * disk says. These come apart when the manifest changes: FiveM caches resource
 * metadata and only rescans it on `refresh`, so `ensure`/`restart` alone will
 * happily restart a resource using a file list from before your edit.
 */
AGM.loadedScripts = function (key) {
    if (typeof GetNumResourceMetadata !== 'function') return null;
    const out = [];
    const count = GetNumResourceMetadata(AGM.RESOURCE, key) || 0;
    for (let i = 0; i < count; i += 1) out.push(GetResourceMetadata(AGM.RESOURCE, key, i));
    return out;
};

AGM.requireConfig = function () {
    const manifest = LoadResourceFile(AGM.RESOURCE, 'fxmanifest.lua') || '';
    const shared = AGM.manifestScripts(manifest, 'shared_scripts');
    const own = AGM.manifestScripts(manifest, AGM.IS_SERVER ? 'server_scripts' : 'client_scripts');
    const loads = shared.concat(own);

    /* A stale metadata cache: the manifest on disk lists files this running
       resource has never heard of. `ensure` cannot fix this, only `refresh`. */
    const running = (AGM.loadedScripts('shared_script') || [])
        .concat(AGM.loadedScripts(AGM.IS_SERVER ? 'server_script' : 'client_script') || []);
    if (running.length) {
        const unseen = loads.filter((file) => !file.includes('*') && !running.includes(file));
        if (unseen.length) {
            throw new Error(
                'fxmanifest.lua lists files this resource is not running, so the server is using a'
                + ' cached copy of the manifest from before it changed - run `refresh` and then'
                + ` \`ensure ${AGM.RESOURCE}\`, because \`ensure\` on its own does not re-read the`
                + ` manifest:\n  - ${unseen.join('\n  - ')}`,
            );
        }
    }
    const onDisk = (file) => {
        const src = LoadResourceFile(AGM.RESOURCE, file);
        return src === null || src === undefined ? null : src;
    };

    /* First: files the manifest promises that are not actually there. That is
       what a half-updated copy looks like - files you already had get
       overwritten while files that are new never get copied at all. */
    const absent = loads.filter((file) => onDisk(file) === null);
    if (absent.length) {
        throw new Error(
            'these files are in fxmanifest.lua but not on disk, so this copy of the resource is'
            + ` incomplete - copy the whole folder over again:\n  - ${absent.join('\n  - ')}`,
        );
    }

    const missing = Object.keys(AGM.CONFIG_FILES).filter((key) => !AGM[key]);
    if (!missing.length) return;

    const runtime = AGM.IS_SERVER ? 'server' : 'client';
    const detail = missing.map((key) => {
        const file = AGM.CONFIG_FILES[key];
        const src = onDisk(file);

        if (src === null) {
            return `${file} is not on disk - copy the whole resource folder over again`;
        }
        if (!loads.includes(file)) {
            return `${file} is on disk but the ${runtime} never loads it - fxmanifest.lua does not`
                + ' list it in shared_scripts, or the line is commented out';
        }
        if (!src.includes(`AGM.${key} =`)) {
            return `${file} is on disk and loaded but never assigns AGM.${key}`
                + ' - it is an old copy of the file, replace it';
        }
        return `${file} is on disk, is loaded, and does assign AGM.${key} (${src.length} bytes), so`
            + ' it threw while running - FiveM printed the real error earlier in this console,'
            + ' above the "Started resource" line';
    });

    throw new Error(`shared config did not load:\n  - ${detail.join('\n  - ')}`);
};
