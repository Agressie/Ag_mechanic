<script>
    /*
     * Parts ordering.
     *
     * Two halves: the catalogue with a cart, and the order list where a ready
     * order gets checked in - which is the step that actually sends the van.
     */
    import { rpc } from '../lib/nui.js';
    import { money, relative } from '../lib/format.js';

    let tab = $state('catalogue');
    let catalogue = $state(null);
    let orders = $state(null);
    let loading = $state(true);
    let error = $state('');
    let notice = $state('');
    let category = $state('consumables');
    let search = $state('');
    let cart = $state({});
    let working = $state(false);
    let placing = $state(false);

    async function load() {
        loading = true;
        const [c, o] = await Promise.all([
            rpc('shop:catalogue'),
            rpc('shop:orders'),
        ]);
        if (c && c.ok) catalogue = c;
        if (o && o.ok) orders = o;
        if (!c || !c.ok) error = 'The parts system is not available to you.';
        loading = false;
    }

    $effect(() => {
        load();
        const handle = setInterval(async () => {
            const o = await rpc('shop:orders');
            if (o && o.ok) orders = o;
        }, 20000);
        return () => clearInterval(handle);
    });

    const items = $derived(
        (catalogue?.items || []).filter((item) => {
            if (search.trim()) return item.label.toLowerCase().includes(search.trim().toLowerCase());
            return item.category === category;
        }),
    );

    const cartLines = $derived(
        Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([item, qty]) => {
                const entry = (catalogue?.items || []).find((i) => i.item === item);
                return { item, qty, label: entry?.label || item, unit: entry?.unit || 0 };
            }),
    );

    const cartTotal = $derived(cartLines.reduce((a, l) => a + l.unit * l.qty, 0));
    const cartUnits = $derived(cartLines.reduce((a, l) => a + l.qty, 0));

    function addToCart(item, qty) {
        cart = { ...cart, [item]: (cart[item] || 0) + qty };
    }

    function setQty(item, qty) {
        const value = Math.max(0, Math.floor(Number(qty) || 0));
        cart = { ...cart, [item]: value };
    }

    const REASONS = {
        noPermission: 'Your grade cannot place orders.',
        funds: 'The shop account cannot cover that.',
        tooManyOpen: 'Too many orders are already in flight.',
        tooManyUnits: 'That is more than one delivery can carry.',
        emptyCart: 'Nothing in the cart.',
        notReady: 'That order is not at the depot yet.',
        deliveryBusy: 'A delivery is already on its way.',
        nobodyAtShop: 'Somebody has to be at the shop to take the delivery.',
        tooLate: 'Too late to cancel that one.',
        noDatabase: 'The order database is unavailable.',
        tooFast: 'Give the system a second to catch up.',
    };

    async function placeOrder() {
        if (!cartLines.length || working) return;
        working = true;
        placing = true;
        error = '';
        notice = '';

        /* The order genuinely takes a beat to go through - the server paces this
           call - so the button shows it working rather than freezing. */
        const [result] = await Promise.all([
            rpc('shop:order', { lines: cartLines.map((l) => ({ item: l.item, qty: l.qty })) }),
            new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);

        if (result && result.ok) {
            cart = {};
            notice = `Order #${result.order.id} confirmed and placed. It will be at the depot ${relative(result.order.etaMs)}.`;
            const o = await rpc('shop:orders');
            if (o && o.ok) orders = o;
            const c = await rpc('shop:catalogue');
            if (c && c.ok) catalogue = c;
            tab = 'orders';
        } else {
            error = REASONS[result && result.reason] || 'The order was refused.';
        }
        placing = false;
        working = false;
    }

    async function receive(order) {
        if (working) return;
        working = true;
        error = '';
        notice = '';

        const result = await rpc('shop:receive', { order: order.id });
        if (result && result.ok) {
            notice = order.status === 'returned'
                ? 'The van is heading back out. Meet it out front and sign for it this time.'
                : 'The van is on its way. Meet it out front and sign for it.';
            const o = await rpc('shop:orders');
            if (o && o.ok) orders = o;
        } else {
            error = REASONS[result && result.reason] || 'Could not send the van out.';
        }
        working = false;
    }

    async function cancel(order) {
        working = true;
        const result = await rpc('shop:cancel', { order: order.id });
        if (result && result.ok) {
            notice = `Order #${order.id} cancelled. ${money(result.refund)} back into the account.`;
            const o = await rpc('shop:orders');
            if (o && o.ok) orders = o;
        } else {
            error = REASONS[result && result.reason] || 'Could not cancel that.';
        }
        working = false;
    }
</script>

{#if loading && !catalogue}
    <div class="empty">Loading…</div>
{:else if !catalogue}
    <div class="empty">{error || 'Unavailable.'}</div>
{:else}
    {#if error}<div class="banner bad">{error}</div>{/if}
    {#if notice}<div class="banner good">{notice}</div>{/if}

    <div class="tabs">
        <button class:active={tab === 'catalogue'} onclick={() => (tab = 'catalogue')}>Catalogue</button>
        <button class:active={tab === 'orders'} onclick={() => (tab = 'orders')}>
            Orders
            {#if orders?.open?.length}<span class="pill">{orders.open.length}</span>{/if}
        </button>
        <span class="spacer"></span>
        <span class="dim small">
            {catalogue.paymentMode === 'society' ? `Account ${money(catalogue.balance)}` : `Paid from your own ${catalogue.paymentMode}`}
        </span>
    </div>

    {#if tab === 'catalogue'}
        <div class="shop-grid">
            <div class="cats">
                <input class="search" placeholder="Search parts" bind:value={search} />
                {#each catalogue.categories as cat}
                    <button
                        class:active={cat.id === category && !search.trim()}
                        onclick={() => { category = cat.id; search = ''; }}
                    >{cat.label}</button>
                {/each}
            </div>

            <div class="listing">
                {#if !items.length}
                    <div class="empty">Nothing matches that.</div>
                {/if}
                {#each items as item}
                    <div class="product">
                        <div class="col info">
                            <span class="name">{item.label}</span>
                            {#if item.blurb}<span class="blurb">{item.blurb}</span>{/if}
                            <span class="stock faint">
                                {item.inStock ? `${item.inStock} in the stash` : 'none in the stash'}
                            </span>
                        </div>
                        <span class="price mono">{money(item.unit)}</span>
                        <div class="packs">
                            {#each item.packs as pack}
                                <button disabled={!catalogue.canOrder} onclick={() => addToCart(item.item, pack)}>+{pack}</button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            <aside class="cart">
                <h2 class="eyebrow">Cart</h2>
                {#if !cartLines.length}
                    <div class="empty small">Empty.</div>
                {:else}
                    {#each cartLines as line}
                        <div class="cart-line">
                            <span class="cart-name">{line.label}</span>
                            <input
                                class="qty mono" type="number" min="0" max="100"
                                value={line.qty}
                                oninput={(e) => setQty(line.item, e.currentTarget.value)}
                            />
                            <span class="mono line-total">{money(line.unit * line.qty)}</span>
                        </div>
                    {/each}

                    <div class="cart-total">
                        <span class="dim">{cartUnits} unit{cartUnits === 1 ? '' : 's'}</span>
                        <span class="spacer"></span>
                        <span class="mono total">{money(cartTotal)}</span>
                    </div>
                {/if}

                <button
                    class="primary order"
                    disabled={!cartLines.length || !catalogue.canOrder || working}
                    onclick={placeOrder}
                >
                    {#if placing}
                        <span class="spinner" aria-hidden="true"></span>Placing the order…
                    {:else}
                        Place the order
                    {/if}
                </button>

                {#if !catalogue.canOrder}
                    <p class="faint small">Your grade cannot place orders.</p>
                {:else}
                    <p class="faint small">Delivery takes about an hour, then it has to be checked in.</p>
                {/if}
            </aside>
        </div>

    {:else}
        {#if !orders?.orders?.length}
            <div class="empty">No orders yet.</div>
        {:else}
            <table>
                <thead>
                    <tr>
                        <th>Order</th><th>Contents</th><th>Placed by</th><th>Status</th><th class="right">Cost</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    {#each orders.orders as order}
                        <tr>
                            <td class="mono">#{order.id}</td>
                            <td class="contents">{order.lines.map((l) => `${l.qty}× ${l.label}`).join(', ')}</td>
                            <td class="dim">{order.orderedBy}</td>
                            <td>
                                <span class="status {order.status}">{order.status}</span>
                                {#if order.status === 'pending'}
                                    <span class="dim small">{relative(order.etaMs)}</span>
                                {:else if order.status === 'ready'}
                                    <span class="dim small">at the depot</span>
                                {:else if order.status === 'dispatched'}
                                    <span class="dim small">van en route</span>
                                {:else if order.status === 'returned'}
                                    <span class="dim small">not signed for - back at the depot</span>
                                {/if}
                            </td>
                            <td class="right mono">{money(order.cost)}</td>
                            <td class="right">
                                {#if order.status === 'ready'}
                                    <button class="primary" disabled={working || orders.deliveryActive} onclick={() => receive(order)}>
                                        {orders.deliveryActive ? 'Van already out' : 'Check in'}
                                    </button>
                                {:else if order.status === 'returned'}
                                    <button class="primary" disabled={working || orders.deliveryActive} onclick={() => receive(order)}>
                                        {orders.deliveryActive ? 'Van already out' : 'Re-ship'}
                                    </button>
                                {:else if order.status === 'pending' && orders.canOrder}
                                    <button class="ghost" disabled={working} onclick={() => cancel(order)}>Cancel</button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    {/if}
{/if}

<style>
    .banner { font-size: 12px; padding: 9px 12px; border-radius: var(--radius-sm); margin-bottom: 12px; }
    .banner.bad { background: var(--danger-bg); border: 1px solid var(--danger-line); color: var(--danger-text); }
    .banner.good { background: var(--ok-bg); border: 1px solid var(--ok-line); color: var(--ok-text); }

    .tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
    .tabs button {
        font-size: 11px; padding: 6px 14px; background: transparent; border-color: transparent;
        color: var(--text-dim); letter-spacing: 0.06em; text-transform: uppercase; box-shadow: none;
    }
    .tabs button:hover { box-shadow: none; }
    .tabs button.active {
        background: var(--accent-soft); border-color: var(--accent); color: var(--accent);
        box-shadow: var(--glow);
    }
    .pill {
        font-family: var(--mono); font-size: 10px; background: var(--accent); color: #02121f;
        border-radius: 10px; padding: 0 6px; margin-left: 6px;
    }

    .shop-grid { display: grid; grid-template-columns: 168px 1fr 250px; gap: 16px; align-items: start; }

    .cats { display: flex; flex-direction: column; gap: 3px; }
    .cats .search { margin-bottom: 8px; }
    .cats button {
        text-align: left; background: transparent; border-color: transparent;
        font-size: 12px; padding: 7px 10px; color: var(--text-dim);
    }
    .cats button.active {
        background: var(--accent-soft); color: var(--accent);
        border-color: var(--line); box-shadow: inset 0 0 16px rgba(30, 166, 240, 0.10);
    }

    .listing { display: flex; flex-direction: column; gap: 6px; }
    .product {
        display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center;
        background: var(--bg-panel); border: 1px solid var(--line);
        border-radius: var(--radius-sm); padding: 10px 13px;
        transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }
    .product:hover { border-color: var(--line-strong); box-shadow: inset 0 0 20px rgba(30, 166, 240, 0.06); }
    .info { gap: 2px; min-width: 0; }
    .name { font-size: 13px; }
    .blurb { font-size: 11px; color: var(--text-faint); line-height: 1.4; }
    .stock { font-size: 10px; }
    .price { font-size: 13px; color: var(--text-dim); }
    .packs { display: flex; gap: 4px; }
    .packs button { font-size: 11px; padding: 4px 9px; }

    .cart { background: var(--bg-panel); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px; position: sticky; top: 0; }
    .cart h2 { margin: 0 0 10px; }
    .cart-line { display: grid; grid-template-columns: 1fr 54px auto; gap: 8px; align-items: center; padding: 5px 0; font-size: 12px; }
    .cart-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qty { padding: 4px 6px; font-size: 12px; text-align: center; }
    .line-total { font-size: 11px; color: var(--text-dim); }
    .cart-total { display: flex; align-items: center; margin: 10px 0; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12px; }
    .total { font-size: 16px; font-weight: 600; color: var(--accent); }
    .order {
        width: 100%; margin-top: 4px;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    }
    .cart p { margin: 8px 0 0; line-height: 1.4; }

    .spinner {
        width: 13px; height: 13px; flex: none;
        border: 2px solid rgba(2, 18, 31, 0.28);
        border-top-color: #02121f;
        border-radius: 50%;
        animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
        text-align: left; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--text-faint); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--line);
    }
    td { padding: 10px; border-bottom: 1px solid var(--bg-raised); vertical-align: middle; }
    .right { text-align: right; }
    .contents { max-width: 320px; font-size: 12px; color: var(--text-dim); }

    .status {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
        border: 1px solid var(--line-strong); border-radius: 3px; padding: 1px 6px;
        color: var(--text-faint); margin-right: 8px;
    }
    .status.ready { border-color: var(--warn); color: var(--warn); }
    .status.dispatched { border-color: var(--accent); color: var(--accent); }
    .status.returned { border-color: var(--danger); color: var(--danger-text); }
    .status.delivered { border-color: var(--ok); color: var(--ok); }
    .status.cancelled { opacity: 0.5; }

    .small { font-size: 11px; }
    .empty.small { padding: 12px; text-align: left; }
</style>
