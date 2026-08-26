<script>
    /*
     * Parts delivery sign-off. A static packing slip and a click-to-sign box -
     * the player never actually draws anything, they just click and a pencil
     * fills in the driver's signature for them.
     */
    import { sendResult, close } from '../lib/nui.js';

    let { payload = {} } = $props();

    const lines = $derived(payload.lines || []);
    const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

    let signing = $state(false);
    let signed = $state(false);

    function sign() {
        if (signing || signed) return;
        signing = true;
        setTimeout(() => {
            signing = false;
            signed = true;
        }, 1100);
    }

    function confirm() {
        sendResult({ signed: true });
        close();
    }

    function decline() {
        sendResult({ signed: false });
        close();
    }
</script>

<div class="overlay">
    <div class="sheet card">
        <header>
            <div class="col">
                <div class="eyebrow">Delivery Receipt</div>
                <h1>Proof of Delivery</h1>
            </div>
            <div class="col meta">
                <span class="dim small">Order #{payload.orderId ?? '—'}</span>
                <span class="faint small">{today}</span>
            </div>
        </header>

        <div class="slip">
            <div class="row field">
                <span class="eyebrow">Carrier</span>
                <span>Benny's Freight &amp; Salvage Co.</span>
            </div>
            <div class="row field">
                <span class="eyebrow">Manifest</span>
                <span class="dim small">Contents as ordered - quantities to be verified against the stash on arrival.</span>
            </div>

            <table>
                <thead>
                    <tr><th>Item</th><th class="right">Qty</th></tr>
                </thead>
                <tbody>
                    {#if lines.length}
                        {#each lines as line}
                            <tr><td>{line.label}</td><td class="right mono">{line.qty}</td></tr>
                        {/each}
                    {:else}
                        <tr><td colspan="2" class="dim">1 pallet, contents as ordered</td></tr>
                    {/if}
                </tbody>
            </table>

            <p class="clause faint small">
                By signing below you confirm the goods above were received in good order.
                No further inspection is required at time of signing.
            </p>
        </div>

        <div class="sigblock">
            <span class="eyebrow">Signature</span>
            <button
                type="button"
                class="sigpad"
                class:signing
                class:signed
                disabled={signing || signed}
                onclick={sign}
            >
                {#if signed}
                    <span class="script">Benny</span>
                {:else if signing}
                    <span class="pencil">✎</span>
                    <span class="script drawing">Benny</span>
                {:else}
                    <span class="placeholder">Click to sign</span>
                {/if}
            </button>
        </div>

        <footer>
            <button class="ghost" onclick={decline}>Cancel</button>
            <span class="spacer"></span>
            <button class="primary" disabled={!signed} onclick={confirm}>Confirm &amp; hand over</button>
        </footer>
    </div>
</div>

<style>
    .sheet { width: 420px; padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }

    header { display: flex; align-items: flex-start; justify-content: space-between; }
    header h1 { margin: 2px 0 0; font-size: 17px; }
    .meta { align-items: flex-end; gap: 2px; }

    .slip {
        background: var(--bg-panel); border: 1px solid var(--line);
        border-radius: var(--radius-sm); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .field { justify-content: space-between; gap: 12px; }
    .field .eyebrow { flex-shrink: 0; }
    .field span:last-child { text-align: right; font-size: 12px; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); padding: 4px 0; border-bottom: 1px solid var(--line); }
    td { padding: 5px 0; border-bottom: 1px solid var(--bg-hover); }
    .right { text-align: right; }

    .clause { margin: 0; line-height: 1.4; }

    .sigblock { display: flex; flex-direction: column; gap: 6px; }
    .sigpad {
        position: relative;
        height: 84px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-deep);
        border: 1px dashed var(--line-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .sigpad:hover:not(:disabled) { border-color: var(--accent); box-shadow: var(--glow); }
    .sigpad.signed { border-style: solid; border-color: var(--ok-line); background: var(--ok-bg); }
    .sigpad.signing { border-color: var(--accent); }

    .placeholder { font-size: 12px; color: var(--text-faint); letter-spacing: 0.04em; }

    .script {
        font-family: 'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive;
        font-size: 34px;
        color: var(--text);
        line-height: 1;
    }
    .sigpad.signed .script { color: var(--ok-text); }

    .script.drawing {
        display: inline-block;
        clip-path: inset(0 100% 0 0);
        animation: reveal 1000ms ease-out 60ms forwards;
    }
    @keyframes reveal {
        to { clip-path: inset(0 0% 0 0); }
    }

    .pencil {
        position: absolute;
        font-size: 20px;
        left: 14%;
        transform: rotate(28deg);
        animation: scrawl 1000ms ease-out 60ms forwards;
    }
    @keyframes scrawl {
        0%   { left: 12%; }
        100% { left: 82%; }
    }

    footer { display: flex; align-items: center; }
</style>
