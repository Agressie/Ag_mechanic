<script>
    /*
     * The parts stash.
     *
     * With ox_inventory or qb-inventory running, the real UI is theirs and this
     * is a live manifest with a button to open it. Without one, this *is* the
     * stash: take and put work straight through the server.
     */
    import { rpc, clientAction } from '../lib/nui.js';

    let { payload = {} } = $props();

    let data = $state(null);
    let loading = $state(true);
    let error = $state('');
    let search = $state('');
    let amounts = $state({});

    const shop = $derived(payload.shop?.id);

    async function load() {
        loading = true;
        const result = await rpc('shop:stash', { shop });
        if (result && result.ok) {
            data = result;
            error = '';
        } else {
            error = 'The stash is not available to you.';
        }
        loading = false;
    }

    $effect(() => { load(); });

    const items = $derived(
        (data?.items || []).filter((entry) =>
            !search.trim() || entry.label.toLowerCase().includes(search.trim().toLowerCase())),
    );

    const totals = $derived({
        lines: data?.items?.length || 0,
        units: (data?.items || []).reduce((a, e) => a + e.count, 0),
    });

    function qtyFor(item) {
        const value = Number(amounts[item]);
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
    }

    async function move(name, item) {
        error = '';
        const result = await rpc(name, { shop, item, qty: qtyFor(item) });
        if (result && result.ok) {
            data = { ...data, items: result.items };
        } else {
            error = REASONS[result && result.reason] || 'That did not work.';
        }
    }

    const REASONS = {
        noPermission: 'Your grade does not allow that.',
        notInStash: 'There are not that many in the stash.',
        cannotCarry: 'You cannot carry that - it went back on the shelf.',
        noItem: 'You are not carrying that.',
    };

    async function openNative() {
        const result = await rpc('shop:stashOpen', { shop });
        if (result && result.ok) clientAction('tabletClosed', {});
    }
</script>

{#if loading && !data}
    <div class="empty">Loading…</div>
{:else if !data}
    <div class="empty">{error || 'Unavailable.'}</div>
{:else}
    {#if error}<div class="error">{error}</div>{/if}

    <div class="bar">
        <input class="search" placeholder="Search the stash" bind:value={search} />
        <span class="spacer"></span>
        <span class="dim small">{totals.lines} lines · {totals.units} units</span>
        {#if data.native}
            <button class="primary" onclick={openNative}>Open the shelves</button>
        {/if}
        <button class="ghost" onclick={load}>Refresh</button>
    </div>

    {#if data.native}
        <p class="note dim">
            Stock lives in {data.backend === 'ox' ? 'ox_inventory' : 'your inventory resource'}.
            This is a live manifest — use “Open the shelves” to actually move things about.
        </p>
    {/if}

    {#if !items.length}
        <div class="empty">{search ? 'Nothing matches that.' : 'The stash is empty.'}</div>
    {:else}
        <div class="grid">
            {#each items as entry}
                <div class="item">
                    <div class="col">
                        <span class="name">{entry.label}</span>
                        <span class="mono faint small">{entry.item}</span>
                    </div>
                    <span class="count mono">{entry.count}</span>

                    {#if !data.native}
                        <div class="controls">
                            <input
                                class="qty mono"
                                type="number" min="1" max="100"
                                value={amounts[entry.item] ?? 1}
                                oninput={(e) => (amounts = { ...amounts, [entry.item]: e.currentTarget.value })}
                            />
                            <button disabled={!data.can.take} onclick={() => move('shop:stashTake', entry.item)}>Take</button>
                            <button disabled={!data.can.put} onclick={() => move('shop:stashPut', entry.item)}>Put</button>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
{/if}

<style>
    .error {
        background: var(--danger-bg); border: 1px solid var(--danger-line);
        color: var(--danger-text); font-size: 12px; padding: 9px 12px;
        border-radius: var(--radius-sm); margin-bottom: 12px;
    }
    .bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .search { max-width: 280px; }
    .note { font-size: 12px; margin: 0 0 14px; line-height: 1.5; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }
    .item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px 12px;
        align-items: center;
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-deep) 100%);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        padding: 11px 13px;
        transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }
    .item:hover { border-color: var(--line-strong); box-shadow: inset 0 0 20px rgba(30, 166, 240, 0.07); }
    .name { font-size: 13px; }
    .count { font-size: 18px; font-weight: 600; color: var(--accent); }
    .controls { grid-column: 1 / -1; display: flex; gap: 6px; }
    .controls button { font-size: 12px; padding: 5px 10px; }
    .qty { width: 62px; padding: 5px 8px; font-size: 12px; }
    .small { font-size: 11px; }
</style>
