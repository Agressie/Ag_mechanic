/** Shared formatting helpers. */

export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export const pct = (n) => `${Math.round(Number(n) || 0)}%`;

/** "in 43 minutes" / "12 minutes ago" */
export function relative(ms) {
    const value = Number(ms) || 0;
    const abs = Math.abs(value);
    const mins = Math.round(abs / 60000);
    const label = mins < 1
        ? 'less than a minute'
        : mins < 60
            ? `${mins} min`
            : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
    return value >= 0 ? `in ${label}` : `${label} ago`;
}

export function date(ts) {
    if (!ts) return '--';
    return new Date(Number(ts)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Colour token for a condition band. */
export const bandColour = (band) => `var(--band-${band || 'unknown'})`;

/** Multiplier (0.82) -> readable delta ("-18%"). */
export function perfDelta(mult) {
    const value = Number(mult);
    if (!Number.isFinite(value)) return '--';
    const delta = Math.round((value - 1) * 100);
    if (delta === 0) return 'stock';
    return `${delta > 0 ? '+' : ''}${delta}%`;
}
