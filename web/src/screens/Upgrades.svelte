<script>
    /*
     * Fitting named tiers. Every ladder starts at the factory part, so removing
     * an upgrade is just fitting tier 0 - which is why tier 0 needs no part.
     */
    import { clientAction, close } from '../lib/nui.js';
    import { money, perfDelta } from '../lib/format.js';

    let { payload = {} } = $props();

    const categories = $derived(payload.categories || []);
    let selected = $state(0);

    const current = $derived(categories[selected] || { tiers: [] });

    function install(tier) {
        clientAction('installTier', {
            category: current.id,
            tier: tier.index,
            label: tier.label,
            install: tier.install,
        });
    }

    /* Why a tier cannot be fitted right now, or null if it can. */
    function blocker(tier) {
        if (tier.fitted) return 'Already fitted';
        if (tier.item && !tier.have) return `Need ${tier.itemLabel}`;
        if (tier.install === 'garage' && !payload.inBay) return 'Needs a workshop bay';
        return null;
    }
</script>

<div class="overlay">
    <div class="sheet card">
        <header>
            <div class="col">
                <div class="eyebrow">Performance</div>
                <h1>{payload.blueprintLabel} <span class="plate mono">{payload.plate}</span></h1>
            </div>
            <div class="perf">
                {#each Object.entries(payload.performance || {}) as [axis, value]}
                    <div class="stat">
                        <span class="eyebrow">{axis}</span>
                        <span class="mono" class:up={value > 1.001} class:down={value < 0.999}>{perfDelta(value)}</span>
                    </div>
                {/each}
            </div>
        </header>

        {#if !payload.inBay}
            <div class="notice">Not on a lift - only the lighter jobs can be done out here.</div>
        {/if}

        <div class="split">
            <nav class="cats">
                {#each categories as category, index}
                    <button class:active={index === selected} onclick={() => (selected = index)}>
                        <span class="cat-label">{category.label}</span>
                        <span class="cat-current">{category.tiers[category.current]?.label || 'Standard'}</span>
                    </button>
                {/each}
            </nav>

            <div class="tiers">
                {#each current.tiers as tier}
                    {@const stop = blocker(tier)}
                    <div class="tier" class:fitted={tier.fitted}>
                        <div class="tier-head">
                            <span class="tier-name">{tier.label}</span>
                            {#if tier.fitted}<span class="tag ok">Fitted</span>{/if}
                            {#if tier.install === 'garage'}<span class="tag">Workshop</span>{/if}
                        </div>

                        {#if tier.blurb}<p class="blurb">{tier.blurb}</p>{/if}

                        <div class="tier-foot">
                            <div class="deltas">
                                {#each Object.entries(tier.perf || {}) as [axis, mult]}
                                    <span class="delta" class:up={mult > 1} class:down={mult < 1}>
                                        {axis} {perfDelta(mult)}
                                    </span>
                                {/each}
                                {#if !Object.keys(tier.perf || {}).length}
                                    <span class="delta faint">no handling change</span>
                                {/if}
                            </div>

                            <div class="buy">
                                {#if tier.labour}<span class="labour dim">Labour {money(tier.labour)}</span>{/if}
                                <button
                                    class={tier.index === 0 ? '' : 'primary'}
                                    disabled={!!stop}
                                    title={stop || ''}
                                    onclick={() => install(tier)}
                                >
                                    {stop || (tier.index === 0 ? 'Strip back to standard' : 'Fit')}
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>

        <footer>
            <span class="dim small">Parts come out of your own inventory. Labour is what you charge the customer.</span>
            <span class="spacer"></span>
            <button class="ghost" onclick={close}>Close</button>
        </footer>
    </div>
</div>

<style>
    .sheet { width: 940px; max-height: 84vh; display: flex; flex-direction: column; padding: 22px 24px 14px; }

    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    h1 { margin: 4px 0 0; font-size: 21px; font-weight: 600; }
    .plate {
        font-size: 13px; border: 1px solid var(--line-strong); border-radius: 4px;
        padding: 2px 7px; margin-left: 8px; vertical-align: 3px; color: var(--text-dim);
    }

    .perf { display: flex; gap: 16px; flex-wrap: wrap; justify-content: flex-end; max-width: 460px; }
    .stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .stat .mono { font-size: 13px; color: var(--text-dim); }
    .stat .up { color: var(--ok); }
    .stat .down { color: var(--danger); }

    .notice {
        margin-top: 14px; padding: 9px 12px; font-size: 12px;
        background: var(--warn-bg); border: 1px solid var(--warn-line);
        border-radius: var(--radius-sm); color: var(--text-dim);
    }

    .split { display: grid; grid-template-columns: 220px 1fr; gap: 18px; margin-top: 18px; flex: 1; min-height: 0; }

    .cats { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
    .cats button {
        display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
        text-align: left; background: transparent; border-color: transparent; padding: 9px 11px;
    }
    .cats button.active {
        background: var(--accent-soft); border-color: var(--line);
        box-shadow: inset 0 0 16px rgba(30, 166, 240, 0.10);
    }
    .cats button.active .cat-label { color: var(--accent); }
    .cat-label { font-size: 13px; }
    .cat-current { font-size: 11px; color: var(--text-faint); }

    .tiers { overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 6px; }
    .tier { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; background: var(--bg-panel); }
    .tier.fitted {
        border-color: var(--accent); background: var(--accent-soft);
        box-shadow: var(--glow), inset 0 0 20px rgba(30, 166, 240, 0.08);
    }

    .tier-head { display: flex; align-items: center; gap: 8px; }
    .tier-name { font-size: 14px; font-weight: 600; }
    .tag {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
        border: 1px solid var(--line-strong); border-radius: 3px; padding: 1px 5px; color: var(--text-faint);
    }
    .tag.ok { border-color: var(--ok); color: var(--ok); }

    .blurb { margin: 6px 0 10px; font-size: 12px; color: var(--text-dim); line-height: 1.5; }

    .tier-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .deltas { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--text-faint); }
    .delta.up { color: var(--ok); }
    .delta.down { color: var(--danger); }

    .buy { display: flex; align-items: center; gap: 10px; }
    .labour { font-size: 11px; }
    .buy button { font-size: 12px; padding: 6px 12px; }

    footer { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 12px; }
    .small { font-size: 11px; }
</style>
