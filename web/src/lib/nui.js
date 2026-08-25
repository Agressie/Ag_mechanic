/*
 * NUI plumbing. Every call goes through the resource's `rpc` / `client`
 * callbacks so the page never needs to know about server events.
 */

const resource = typeof window.GetParentResourceName === 'function'
    ? window.GetParentResourceName()
    : 'ag_mechanic';

/** True when the page is running in a browser for development. */
export const isBrowser = !window.invokeNative;

async function post(endpoint, body = {}) {
    if (isBrowser) return null;
    try {
        const response = await fetch(`https://${resource}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(body),
        });
        return await response.json();
    } catch (err) {
        console.error(`[ag_mechanic] nui call '${endpoint}' failed`, err);
        return null;
    }
}

/** Calls a server handler through the client's allow-list. */
export async function rpc(name, args = {}, withVehicle = false) {
    if (isBrowser) {
        const { devRpc } = await import('./dev.js');
        return devRpc(name);
    }
    return post('rpc', { name, args, withVehicle });
}

/** Same, but for handlers scoped to the vehicle the screen was opened on. */
export function vehicleRpc(name, args = {}) {
    return rpc(name, args, true);
}

/** Asks the client to do something game-side. */
export function clientAction(action, args = {}) {
    return post('client', { action, args });
}

/** Closes the page. */
export function close() {
    return post('close', {});
}

/** Reports a result back to a client script that is awaiting one. */
export function sendResult(value) {
    return post('result', value);
}

/** Hands input back to the game without ending an awaited result. */
export function release() {
    return post('release', {});
}
