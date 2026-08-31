<script>
    /*
     * The merchant side of the card machine. Deliberately not themed like the
     * rest of the NUI - this should read as an actual handheld terminal, keys
     * and all, not a menu with a text field on it.
     */
    import { sendResult, close } from '../lib/nui.js';

    let { payload = {} } = $props();

    const device = $derived(payload.device || 'shop');
    const pending = $derived(payload.pending || { active: false });

    let digits = $state('');
    const amount = $derived(Number(digits) || 0);

    function press(key) {
        if (key === 'C') { digits = ''; return; }
        if (key === '<') { digits = digits.slice(0, -1); return; }
        if (digits.replace('-', '').length >= 6) return;
        digits = digits === '0' ? String(key) : digits + String(key);
    }

    function charge() {
        if (!amount) return;
        sendResult({ action: 'charge', amount });
        close();
    }

    function cancelCharge() {
        sendResult({ action: 'cancel' });
        close();
    }

    function stow() {
        sendResult({ action: 'stow' });
        close();
    }

    const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '<'];
</script>

<div class="backdrop">
    <button class="closer" onclick={close} aria-label="Close">✕</button>

    <div class="device">
        <div class="brand">BENNY'S <span>PAY</span></div>

        <div class="screen">
            {#if pending.active}
                <div class="pending">
                    <span class="pending-label">CHARGE PENDING</span>
                    <span class="pending-amount">${pending.amount}</span>
                </div>
            {/if}
            <div class="entry">
                <span class="cursor-row">
                    <span class="dollar">$</span>{amount}<span class="caret">|</span>
                </span>
            </div>
        </div>

        <div class="pad">
            {#each KEYS as key}
                <button class="key" class:fn={key === 'C' || key === '<'} onclick={() => press(key)}>
                    {key === '<' ? '⌫' : key}
                </button>
            {/each}
        </div>

        <button class="charge" disabled={!amount} onclick={charge}>
            Charge ${amount || 0}
        </button>

        <div class="footrow">
            {#if pending.active}
                <button class="link danger" onclick={cancelCharge}>Cancel pending charge</button>
            {/if}
            {#if device === 'mobile'}
                <button class="link" onclick={stow}>Put the reader away</button>
            {/if}
        </div>
    </div>
</div>

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(8, 8, 10, 0.6);
    }

    .closer {
        position: absolute;
        top: 22px;
        right: 26px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.35);
        color: rgba(255, 255, 255, 0.75);
        font-size: 14px;
        cursor: pointer;
    }
    .closer:hover { background: rgba(0, 0, 0, 0.55); color: #fff; }

    .device {
        width: 240px;
        padding: 16px 14px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        background: linear-gradient(180deg, #2b2d31 0%, #1b1c1f 100%);
        border-radius: 22px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        border: 1px solid #000;
    }

    .brand {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: #6b6f76;
    }
    .brand span { color: #3fd67a; }

    .screen {
        width: 100%;
        min-height: 62px;
        background: #0c1c12;
        border-radius: 8px;
        padding: 8px 10px;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
    }

    .pending {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 1px dashed rgba(63, 214, 122, 0.25);
        padding-bottom: 4px;
    }
    .pending-label {
        font-family: Arial, sans-serif;
        font-size: 8px;
        letter-spacing: 0.1em;
        color: #ffb84d;
    }
    .pending-amount {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #ffb84d;
    }

    .entry { display: flex; justify-content: flex-end; }
    .cursor-row {
        font-family: 'Courier New', monospace;
        font-size: 26px;
        color: #57f39a;
        text-shadow: 0 0 8px rgba(87, 243, 154, 0.45);
        letter-spacing: 0.02em;
    }
    .dollar { color: #3a9e6b; margin-right: 1px; }
    .caret { animation: blink 1s step-end infinite; color: #3a9e6b; }
    @keyframes blink { 50% { opacity: 0; } }

    .pad {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 7px;
    }
    .key {
        height: 40px;
        border-radius: 8px;
        border: none;
        background: linear-gradient(180deg, #45484e 0%, #35373c 100%);
        color: #eef0f2;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: 700;
        box-shadow: 0 2px 0 #16171a, inset 0 1px 0 rgba(255, 255, 255, 0.08);
        cursor: pointer;
    }
    .key:active { transform: translateY(2px); box-shadow: 0 0 0 #16171a; }
    .key.fn { background: linear-gradient(180deg, #3a2f2f 0%, #2a2222 100%); color: #ff9d7a; }

    .charge {
        width: 100%;
        height: 44px;
        margin-top: 2px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(180deg, #3fd67a 0%, #23a659 100%);
        color: #04220f;
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 0.02em;
        box-shadow: 0 3px 0 #146338, inset 0 1px 0 rgba(255, 255, 255, 0.25);
        cursor: pointer;
    }
    .charge:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #146338; }
    .charge:disabled { opacity: 0.35; cursor: not-allowed; }

    .footrow { display: flex; flex-direction: column; gap: 2px; align-items: center; }
    .link {
        background: none;
        border: none;
        color: #6b6f76;
        font-size: 11px;
        text-decoration: underline;
        cursor: pointer;
        padding: 2px;
    }
    .link:hover { color: #9aa0a8; }
    .link.danger { color: #ff8a7a; }
    .link.danger:hover { color: #ffb0a4; }
</style>
