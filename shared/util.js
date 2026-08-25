/* ag_mechanic - small shared helpers */
AGM.util = {};

AGM.util.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

AGM.util.round = (v, dp = 0) => {
    const f = Math.pow(10, dp);
    return Math.round(v * f) / f;
};

AGM.util.randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

AGM.util.randFloat = (min, max) => Math.random() * (max - min) + min;

AGM.util.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

AGM.util.shuffle = function (arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/** Replaces each %s in `str` with the next argument. */
AGM.util.fmt = function (str, ...args) {
    let i = 0;
    return String(str).replace(/%s/g, () => (i < args.length ? String(args[i++]) : '%s'));
};

AGM.util.dist = function (a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = (a[2] || 0) - (b[2] || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

AGM.util.dist2d = function (a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
};

/** Deep clone for the plain JSON-ish objects this resource passes around. */
AGM.util.clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

AGM.util.now = () => Date.now();

/** Human-readable "in 42 minutes" / "3 minutes ago". */
AGM.util.relativeTime = function (ms) {
    const abs = Math.abs(ms);
    const mins = Math.round(abs / 60000);
    const label = mins < 1 ? 'less than a minute'
        : mins < 60 ? `${mins} minute${mins === 1 ? '' : 's'}`
            : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return ms >= 0 ? `in ${label}` : `${label} ago`;
};

/** Normalises a plate the way GTA stores them: 8 chars, upper, trimmed. */
AGM.util.normalisePlate = function (plate) {
    return String(plate || '').toUpperCase().trim().replace(/\s+/g, '');
};

/**
 * Stable key for a vehicle. Prefers a real VIN-style state bag value if another
 * resource set one, so the health record survives a plate change.
 */
AGM.util.vehicleKey = function (plate, vin) {
    const clean = vin ? String(vin).trim() : '';
    return clean.length ? `vin:${clean}` : `plate:${AGM.util.normalisePlate(plate)}`;
};

/** Sums the numeric values of an object. */
AGM.util.sum = (obj) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

/** True when `obj` has no own enumerable keys. */
AGM.util.isEmpty = (obj) => !obj || Object.keys(obj).length === 0;

/** Simple per-key rate limiter. Returns true when the action is allowed. */
AGM.util.rateLimiter = function (intervalMs) {
    const last = new Map();
    return function (key) {
        const now = Date.now();
        const prev = last.get(key) || 0;
        if (now - prev < intervalMs) return false;
        last.set(key, now);
        return true;
    };
};
