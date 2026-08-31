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
 * file, it goes and looks at it, because the three ways this happens need
 * three different fixes.
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

AGM.requireConfig = function () {
    const manifest = LoadResourceFile(AGM.RESOURCE, 'fxmanifest.lua') || '';

    /* First: files the manifest promises that are not actually there. This is
       what a half-updated copy looks like - overwriting the files you already
       had while never copying the ones that are new. FiveM does log these, but
       a long way up, mixed in with everything else starting. */
    const listed = Array.from(manifest.matchAll(/'([^'@]+\.(?:js|lua))'/g), (m) => m[1]);
    const absent = listed.filter((file) => {
        const src = LoadResourceFile(AGM.RESOURCE, file);
        return src === null || src === undefined;
    });
    if (absent.length) {
        throw new Error(
            'these files are in fxmanifest.lua but not on disk, so this copy of the resource is'
            + ` incomplete - copy the whole folder over again:\n  - ${absent.join('\n  - ')}`,
        );
    }

    const missing = Object.keys(AGM.CONFIG_FILES).filter((key) => !AGM[key]);
    if (!missing.length) return;
    const detail = missing.map((key) => {
        const file = AGM.CONFIG_FILES[key];
        const src = LoadResourceFile(AGM.RESOURCE, file);

        if (src === null || src === undefined) {
            return `${file} is not on disk - copy the whole resource folder over again`;
        }
        if (!manifest.includes(`'${file}'`)) {
            return `${file} is on disk but not listed in fxmanifest.lua shared_scripts - add it`;
        }
        if (!src.includes(`AGM.${key} =`)) {
            return `${file} is on disk and in the manifest but never assigns AGM.${key}`
                + ' - it is an old copy of the file, replace it';
        }
        return `${file} loaded but AGM.${key} is still missing, so it threw partway through`
            + ' - the real error is further up this console';
    });

    throw new Error(`shared config did not load:\n  - ${detail.join('\n  - ')}`);
};
