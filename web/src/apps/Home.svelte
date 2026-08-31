<script>
    /* Dashboard: what a manager wants to see the second they pick the tablet up. */
    import { rpc } from '../lib/nui.js';
    import { money, relative } from '../lib/format.js';
    import Icon from '../lib/Icon.svelte';

    let { payload = {}, navigate } = $props();

    let data = $state(null);
    let loading = $state(true);

    async function load() {
        loading = true;
        data = await rpc('tablet:dashboard');
        loading = false;
    }

    $effect(() => {
        load();
        const handle = setInterval(load, 30000);
        return () => clearInterval(handle);
    });

    const PHASE = {
        driving: 'Van is on the road',
        parking: 'Van is pulling up outside',
        unloading: 'Driver is unloading',
        waiting: 'Driver is waiting for a signature',
        leaving: 'Driver is heading off',
    };
</script>

{#if loading && !data}
    <div class="empty">Loading…</div>
{:else if !data || !data.ok}
    <div class="empty">Could not reach the shop system.</div>
{:else}
    {#if data.delivery}
        <button class="banner" onclick={() => navigate('shop')}>
            <Icon name="truck" />
            <span><strong>{PHASE[data.delivery] || 'Delivery in progress'}</strong> — out front now.</span>
        </button>
    {/if}

    {#if data.readyCount}
        <button class="banner ready" onclick={() => navigate('shop')}>
            <Icon name="alert" />
            <span>
                <strong>{data.readyCount} order{data.readyCount === 1 ? '' : 's'} waiting at the depot.</strong>
                Check {data.readyCount === 1 ? 'it' : 'them'} in to send the van out.
            </span>
        </button>
    {/if}

    <div class="tiles">
        <div class="tile">
            <span class="eyebrow">Shop account</span>
            <span class="value mono">{money(data.balance)}</span>
        </div>
        <div class="tile">
            <span class="eyebrow">On the books</span>
            <span class="value mono">{data.staff.total}</span>
            <span class="sub">{data.staff.online} on shift</span>
        </div>
        <div class="tile">
            <span class="eyebrow">Parts in the stash</span>
            <span class="value mono">{data.stash.units}</span>
            <span class="sub">{data.stash.lines} line{data.stash.lines === 1 ? '' : 's'}</span>
        </div>
        <div class="tile">
            <span class="eyebrow">Orders in flight</span>
            <span class="value mono">{data.openOrders.length}</span>
        </div>
    </div>

    <div class="columns">
        <section>
            <h2 class="eyebrow">Open orders</h2>
            {#if !data.openOrders.length}
                <div class="empty small">Nothing on order.</div>
            {:else}
                {#each data.openOrders as order}
                    <div class="line">
                        <span class="mono id">#{order.id}</span>
                        <span class="status {order.status}">{order.status}</span>
                        <span class="spacer"></span>
                        <span class="dim small">
                            {order.status === 'pending' ? relative(order.etaMs) : order.status === 'ready' ? 'waiting to be checked in' : 'van en route'}
                        </span>
                        <span class="mono cost">{money(order.cost)}</span>
                    </div>
                {/each}
            {/if}
        </section>

        <section>
            <h2 class="eyebrow">Running low</h2>
            {#if !data.stash.lowStock.length}
                <div class="empty small">Consumables are all stocked.</div>
            {:else}
                {#each data.stash.lowStock as entry}
                    <div class="line">
                        <span>{entry.label}</span>
                        <span class="spacer"></span>
                        <span class="mono" class:bad={entry.count === 0}>{entry.count}</span>
                    </div>
                {/each}
                <button class="ghost link" onclick={() => navigate('shop')}>Order more →</button>
            {/if}
        </section>
    </div>
{/if}

<style>
    .banner {
        display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
        background: var(--accent-soft); border: 1px solid var(--accent-dim);
        color: var(--text); font-size: 13px; padding: 11px 14px; margin-bottom: 12px;
    }
    .banner.ready { background: var(--warn-bg); border-color: var(--warn-line); color: var(--text); }

    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .tile {
        display: flex; flex-direction: column; gap: 4px;
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-deep) 100%);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm); padding: 13px 15px;
        box-shadow: inset 0 0 22px rgba(30, 166, 240, 0.06);
    }
    .tile .value { font-size: 22px; font-weight: 600; color: var(--accent); }
    .tile .sub { font-size: 11px; color: var(--text-faint); }

    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    h2 { margin: 0 0 8px; }

    .line {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; border-radius: var(--radius-sm); font-size: 13px;
    }
    .line:nth-child(odd) { background: var(--bg-raised); }
    .id { color: var(--text-faint); }
    .cost { color: var(--text-dim); font-size: 12px; }
    .bad { color: var(--danger); }
    .small { font-size: 12px; }

    .status {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
        border: 1px solid var(--line-strong); border-radius: 3px; padding: 1px 6px; color: var(--text-faint);
    }
    .status.ready { border-color: var(--warn); color: var(--warn); }
    .status.dispatched { border-color: var(--accent); color: var(--accent); }

    .link { margin-top: 6px; font-size: 12px; padding: 4px 8px; }
    .empty.small { padding: 14px; text-align: left; }
</style>
