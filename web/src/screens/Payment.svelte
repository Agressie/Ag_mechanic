<script>
    /*
     * The customer side of the same card machine - the amount due, and a spot
     * to tap. No PIN, no drag-to-swipe fiddliness: click the pad, watch the
     * card tap, get approved.
     */
    import { sendResult, close } from '../lib/nui.js';

    let { payload = {} } = $props();

    const amount = $derived(payload.amount ?? 0);
    const mechanic = $derived(payload.mechanic || 'the mechanic');

    let stage = $state('idle'); // idle -> tapping -> approved

    function tap() {
        if (stage !== 'idle') return;
        stage = 'tapping';
        setTimeout(() => {
            stage = 'approved';
            setTimeout(finish, 750);
        }, 900);
    }

    function finish() {
        sendResult({ paid: true });
        close();
    }

    function decline() {
        sendResult({ paid: false });
        close();
    }
</script>

<div class="backdrop">
    <button class="closer" onclick={decline} aria-label="Close">✕</button>

    <div class="device" class:approved={stage === 'approved'}>
        <div class="brand">BENNY'S <span>PAY</span></div>

        <div class="screen">
            {#if stage === 'approved'}
                <div class="approved-view">
                    <span class="tick">✓</span>
                    <span class="approved-label">APPROVED</span>
                </div>
            {:else}
                <span class="due-label">AMOUNT DUE</span>
                <span class="due-amount">${amount}</span>
                <span class="due-sub">charged by {mechanic}</span>
            {/if}
        </div>

        <button class="pad" class:tapping={stage === 'tapping'} disabled={stage !== 'idle'} onclick={tap}>
            <span class="rings" aria-hidden="true">
                <span class="ring r1"></span>
                <span class="ring r2"></span>
                <span class="ring r3"></span>
            </span>
            <span class="nfc" aria-hidden="true">
                <span class="arc a1"></span>
                <span class="arc a2"></span>
                <span class="arc a3"></span>
            </span>
            <span class="card" aria-hidden="true"><span class="chip"></span></span>
            <span class="pad-label">
                {stage === 'idle' ? 'Tap to pay' : stage === 'tapping' ? 'Reading…' : 'Done'}
            </span>
        </button>
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
        padding: 16px 14px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        background: linear-gradient(180deg, #2b2d31 0%, #1b1c1f 100%);
        border-radius: 22px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        border: 1px solid #000;
        transition: box-shadow 0.3s ease;
    }
    .device.approved { box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), 0 0 0 2px #3fd67a; }

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
        height: 70px;
        background: #0c1c12;
        border-radius: 8px;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
    }
    .due-label {
        font-family: Arial, sans-serif;
        font-size: 9px;
        letter-spacing: 0.14em;
        color: #3a9e6b;
    }
    .due-amount {
        font-family: 'Courier New', monospace;
        font-size: 26px;
        color: #57f39a;
        text-shadow: 0 0 8px rgba(87, 243, 154, 0.45);
    }
    .due-sub { font-family: Arial, sans-serif; font-size: 9px; color: #4d7a5f; }

    .approved-view { display: flex; flex-direction: column; align-items: center; gap: 2px; animation: pop 260ms ease; }
    .tick {
        font-size: 26px;
        color: #57f39a;
        text-shadow: 0 0 10px rgba(87, 243, 154, 0.6);
    }
    .approved-label {
        font-family: Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #57f39a;
    }
    @keyframes pop {
        0% { transform: scale(0.6); opacity: 0; }
        70% { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); }
    }

    .pad {
        position: relative;
        width: 128px;
        height: 128px;
        border-radius: 50%;
        border: none;
        background: radial-gradient(circle at 50% 42%, #34373d 0%, #232529 70%);
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5), 0 2px 0 #101113;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        overflow: hidden;
    }
    .pad:disabled { cursor: default; }
    .pad:hover:not(:disabled) { filter: brightness(1.08); }

    .pad-label {
        position: absolute;
        bottom: 12px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: Arial, sans-serif;
        font-size: 9px;
        letter-spacing: 0.08em;
        color: #8a8f97;
        text-transform: uppercase;
    }

    /* Contactless mark: three concentric arcs, like the NFC symbol. */
    .nfc {
        position: absolute;
        top: 34px;
        width: 40px;
        height: 40px;
    }
    .arc {
        position: absolute;
        inset: 0;
        border: 3px solid #4a4f57;
        border-radius: 50%;
        border-left-color: transparent;
        border-bottom-color: transparent;
        transform: rotate(-45deg);
        transition: border-color 0.2s ease;
    }
    .a1 { inset: 12px; }
    .a2 { inset: 6px; }
    .a3 { inset: 0; }
    .pad.tapping .arc { border-color: #57f39a; border-left-color: transparent; border-bottom-color: transparent; }
    .pad.tapping .a1 { animation: glow 900ms ease-in-out infinite; }
    .pad.tapping .a2 { animation: glow 900ms ease-in-out 100ms infinite; }
    .pad.tapping .a3 { animation: glow 900ms ease-in-out 200ms infinite; }
    @keyframes glow {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
    }

    /* Pulse rings that expand outward while reading. */
    .rings { position: absolute; inset: 0; }
    .ring {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 40px;
        height: 40px;
        top: 34px;
        border-radius: 50%;
        border: 2px solid rgba(87, 243, 154, 0.55);
        opacity: 0;
    }
    .pad.tapping .ring { animation: ripple 900ms ease-out infinite; }
    .pad.tapping .r2 { animation-delay: 260ms; }
    .pad.tapping .r3 { animation-delay: 520ms; }
    @keyframes ripple {
        0% { transform: scale(0.9); opacity: 0.7; }
        100% { transform: scale(2.1); opacity: 0; }
    }

    /* Card that taps down onto the pad from above. */
    .card {
        position: absolute;
        top: -70px;
        width: 58px;
        height: 38px;
        border-radius: 5px;
        background: linear-gradient(135deg, #3f6fd6 0%, #274a99 100%);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
        opacity: 0;
    }
    .chip {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 12px;
        height: 9px;
        border-radius: 2px;
        background: linear-gradient(135deg, #e8cf7a, #b89a44);
    }
    .pad.tapping .card { animation: tapdown 900ms cubic-bezier(0.3, 0.6, 0.3, 1) forwards; }
    @keyframes tapdown {
        0%   { top: -70px; opacity: 0; }
        45%  { top: 6px; opacity: 1; }
        60%  { top: 14px; }
        75%  { top: 6px; }
        100% { top: -70px; opacity: 0; }
    }
</style>
