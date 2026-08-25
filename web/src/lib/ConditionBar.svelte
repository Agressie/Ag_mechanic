<script>
    /* A component's condition, as a bar plus either a figure or a band name. */
    let { value = null, band = 'unknown', label = null, width = 96 } = $props();

    const known = $derived(value !== null && value !== undefined);
    const pct = $derived(known ? Math.max(0, Math.min(100, Number(value))) : null);
    /* Nothing readable? Show the bar half-lit in grey rather than empty, so an
       unknown part does not look like a failed one. */
    const shown = $derived(known ? pct : 50);
</script>

<div class="wrap" style="--w:{width}px">
    <div class="bar" class:unknown={!known}>
        <div class="fill" style="width:{shown}%; background:var(--band-{band})"></div>
    </div>
    <span class="label mono" style="color:var(--band-{band})">
        {#if known}{Math.round(pct)}%{:else}{label || 'no reading'}{/if}
    </span>
</div>

<style>
    .wrap { display: flex; align-items: center; gap: 10px; }
    .bar {
        width: var(--w);
        height: 6px;
        background: var(--bg);
        border-radius: 3px;
        overflow: hidden;
        flex: none;
    }
    .bar.unknown { opacity: 0.35; }
    .fill { height: 100%; transition: width 0.25s ease; }
    .label { font-size: 12px; min-width: 62px; }
</style>
