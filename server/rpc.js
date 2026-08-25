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

onNet('ag_mechanic:rpc', async (name, requestId, args) => {
    const src = Number(global.source);
    const reply = (value) => emitNet('ag_mechanic:rpcResult', src, requestId, value);

    const handler = AGM.rpc.handlers.get(name);
    if (!handler) {
        AGM.log.warn(`unknown rpc '${name}' from ${src}`);
        return reply(null);
    }

    try {
        const result = await handler(src, args || {});
        reply(result === undefined ? null : result);
    } catch (err) {
        AGM.log.error(`rpc '${name}' threw:`, err && err.stack ? err.stack : err);
        reply(null);
    }
});
