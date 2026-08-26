/*
 * ag_mechanic - request/response over net events
 * ============================================================================
 * ox_lib's callback API is Lua-only, and this resource is JavaScript, so we run
 * our own tiny RPC: the client sends a name, a request id and arguments; the
 * handler's return value (awaited if it is a promise) goes straight back.
 *
 * Every handler receives the calling source as its first argument and is wrapped
 * in a try/catch, so a thrown error resolves the client's promise with null
 * instead of leaving it hanging forever.
 * ============================================================================
 */

AGM.rpc = { handlers: new Map() };

AGM.rpc.register = function (name, handler) {
    if (AGM.rpc.handlers.has(name)) AGM.log.warn(`rpc handler '${name}' registered twice`);
    AGM.rpc.handlers.set(name, handler);
};

/*
 * Throttling. Every handler is reachable by any client firing the net event in
 * a loop, so "the UI only calls this once" is not a guarantee of anything.
 *
 *   burst      a blanket per-player ceiling. Set well above anything normal
 *              play produces, so it only ever catches scripted spam.
 *   cooldown   per-handler pacing for the calls worth slowing down - this is
 *              what the loading spinners in the UI are actually waiting on, so
 *              the wait is real rather than a client-side animation.
 */
const burst = new Map();      // src -> { count, windowStart }
const lastCall = new Map();   // `${src}:${name}` -> timestamp

function overBurst(src) {
    const limit = AGM.Config.security.rpcPerSecond;
    const now = Date.now();
    let entry = burst.get(src);

    if (!entry || now - entry.windowStart >= 1000) {
        entry = { count: 0, windowStart: now };
        burst.set(src, entry);
    }
    entry.count += 1;
    return entry.count > limit;
}

/** Remaining cooldown for this handler in ms, or 0 when it is ready. */
function cooldownLeft(src, name) {
    const wait = AGM.Config.security.cooldowns[name];
    if (!wait) return 0;
    const key = `${src}:${name}`;
    const left = wait - (Date.now() - (lastCall.get(key) || 0));
    return left > 0 ? left : 0;
}

onNet('ag_mechanic:rpc', async (name, requestId, args) => {
    const src = Number(global.source);
    const reply = (value) => emitNet('ag_mechanic:rpcResult', src, requestId, value);

    const handler = AGM.rpc.handlers.get(name);
    if (!handler) {
        AGM.log.warn(`unknown rpc '${name}' from ${src}`);
        return reply(null);
    }

    if (overBurst(src)) {
        AGM.log.warn(`rpc flood from ${src} (${name}) - dropped`);
        return reply({ ok: false, reason: 'tooFast' });
    }

    const left = cooldownLeft(src, name);
    if (left > 0) return reply({ ok: false, reason: 'tooFast', retryIn: left });
    if (AGM.Config.security.cooldowns[name]) lastCall.set(`${src}:${name}`, Date.now());

    try {
        /* Args must be an object. A string or array here would sail straight
           into handlers that do property lookups on it. */
        const payload = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
        const result = await handler(src, payload);
        reply(result === undefined ? null : result);
    } catch (err) {
        AGM.log.error(`rpc '${name}' threw:`, err && err.stack ? err.stack : err);
        reply(null);
    }
});

/** Forget a player's counters when they leave, so the maps do not grow. */
on('playerDropped', () => {
    const src = Number(global.source);
    burst.delete(src);
    for (const key of Array.from(lastCall.keys())) {
        if (key.startsWith(`${src}:`)) lastCall.delete(key);
    }
});
