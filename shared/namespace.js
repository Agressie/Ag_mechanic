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
