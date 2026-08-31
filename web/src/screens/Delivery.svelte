<script>
    /*
     * Parts delivery sign-off. Deliberately not themed like the rest of the
     * NUI - this is meant to read as an actual clipboard the driver is
     * holding, not a menu. The signature isn't a control, it's the line on
     * the form; clicking it is what "signs".
     */
    import { sendResult, close } from '../lib/nui.js';

    let { payload = {} } = $props();

    const lines = $derived(payload.lines || []);
    const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

    let stage = $state('idle'); // idle -> signing -> stamped

    function sign() {
        if (stage !== 'idle') return;
        stage = 'signing';
        setTimeout(() => {
            stage = 'stamped';
            setTimeout(finish, 850);
        }, 950);
    }

    function finish() {
        sendResult({ signed: true });
        close();
    }

    function decline() {
        sendResult({ signed: false });
        close();
    }
</script>

<div class="backdrop" onclick={decline}>
    <button class="closer" onclick={(e) => { e.stopPropagation(); decline(); }} title="Wave the driver off" aria-label="Cancel">✕</button>

    <div class="board" onclick={(e) => e.stopPropagation()}>
        <div class="clip">
            <div class="clip-jaw"></div>
            <div class="clip-arm"></div>
        </div>

        <div class="paper">
            <div class="stain"></div>

            <header class="letterhead">
                <span class="mark">🔧</span>
                <div class="wordmark">
                    <span class="name">Benny's</span>
                    <span class="sub">Original Motor Works</span>
                </div>
            </header>
            <div class="addr">9827 Elgin Ave, Strawberry, Los Santos &nbsp;·&nbsp; Freight &amp; Parts Delivery</div>

            <div class="rule"></div>

            <h1>Delivery Manifest</h1>

            <div class="formrow">
                <span>Order No.</span>
                <span class="fill">{payload.orderId ?? '—'}</span>
                <span>Date</span>
                <span class="fill">{today}</span>
            </div>

            <table>
                <thead>
                    <tr><th>Item</th><th class="right">Qty</th></tr>
                </thead>
                <tbody>
                    {#if lines.length}
                        {#each lines as line}
                            <tr><td>{line.label}</td><td class="right">{line.qty}</td></tr>
                        {/each}
                    {:else}
                        <tr><td colspan="2">1 pallet, contents as ordered</td></tr>
                    {/if}
                </tbody>
            </table>

            <div class="clause">
                <p class="fineprint">
                    Goods received in the condition described above. No further inspection
                    required at time of signing.
                </p>
                {#if stage === 'stamped'}
                    <div class="stamp">RECEIVED</div>
                {/if}
            </div>

            <div class="sigline" class:done={stage !== 'idle'} onclick={sign}>
                <span class="x">X</span>
                <span class="line">
                    {#if stage !== 'idle'}
                        <span class="script" class:drawing={stage === 'signing'}>Benny</span>
                    {/if}
                    {#if stage === 'signing'}
                        <span class="pencil">✎</span>
                    {/if}
                </span>
                <span class="siglabel">Driver's signature</span>
            </div>
        </div>
    </div>
</div>

<style>
    /* Deliberately not using the app's cyan/dark UI tokens - this should
       read as a real piece of paper on a clipboard, not a menu. */

    .backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(10, 10, 8, 0.62);
        cursor: default;
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
        line-height: 1;
        cursor: pointer;
    }
    .closer:hover { background: rgba(0, 0, 0, 0.55); color: #fff; }

    .board {
        position: relative;
        width: 380px;
        padding: 30px 16px 20px;
        background: linear-gradient(155deg, #8a5a34 0%, #6e4423 55%, #5c3819 100%);
        border-radius: 10px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(0, 0, 0, 0.25);
        transform: rotate(-0.6deg);
    }

    .clip {
        position: absolute;
        top: -14px;
        left: 50%;
        transform: translateX(-50%);
        width: 96px;
        height: 30px;
        z-index: 2;
    }
    .clip-jaw {
        position: absolute;
        inset: 0;
        border-radius: 6px;
        background: linear-gradient(180deg, #d8d8d8 0%, #a8a8a8 45%, #8a8a8a 100%);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }
    .clip-arm {
        position: absolute;
        top: 22px;
        left: 50%;
        transform: translateX(-50%);
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #cfcfcf, #7c7c7c 70%);
        box-shadow: 0 2px 3px rgba(0, 0, 0, 0.4);
    }

    .paper {
        position: relative;
        background:
            repeating-linear-gradient(
                to bottom,
                rgba(60, 90, 130, 0.10) 0,
                rgba(60, 90, 130, 0.10) 1px,
                transparent 1px,
                transparent 27px
            ),
            #f4efe2;
        color: #2c2823;
        padding: 26px 22px 20px;
        border-radius: 2px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        font-family: 'Courier New', Courier, monospace;
        overflow: hidden;
    }

    .stain {
        position: absolute;
        top: 130px;
        right: -18px;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        border: 7px solid rgba(120, 90, 40, 0.07);
        pointer-events: none;
    }

    .letterhead { display: flex; align-items: center; gap: 10px; }
    .mark { font-size: 26px; filter: grayscale(0.1); }
    .wordmark { display: flex; flex-direction: column; line-height: 1.05; }
    .wordmark .name {
        font-family: Georgia, 'Times New Roman', serif;
        font-style: italic;
        font-weight: 700;
        font-size: 22px;
        color: #a3241c;
        letter-spacing: 0.01em;
    }
    .wordmark .sub {
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 0.16em;
        color: #2c2823;
    }

    .addr {
        margin-top: 4px;
        font-size: 9px;
        letter-spacing: 0.02em;
        color: #6b6255;
    }

    .rule { height: 3px; margin: 10px 0 12px; border-top: 2px solid #2c2823; border-bottom: 1px solid #2c2823; }

    h1 {
        margin: 0 0 10px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        text-align: center;
        color: #2c2823;
    }

    .formrow {
        display: grid;
        grid-template-columns: auto 1fr auto 1fr;
        gap: 6px 8px;
        align-items: end;
        font-size: 11px;
        margin-bottom: 12px;
    }
    .formrow .fill {
        border-bottom: 1px dotted #8a8072;
        padding-bottom: 1px;
        font-weight: 700;
    }

    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
    th {
        text-align: left; font-family: Arial, sans-serif; font-size: 9px; letter-spacing: 0.08em;
        text-transform: uppercase; color: #6b6255; padding-bottom: 3px; border-bottom: 1px solid #2c2823;
    }
    td { padding: 4px 0; border-bottom: 1px dotted #b9ae99; }
    .right { text-align: right; }

    .clause { position: relative; margin-bottom: 12px; }
    .fineprint {
        margin: 0;
        max-width: 74%;
        font-size: 9.5px;
        font-style: italic;
        line-height: 1.5;
        color: #6b6255;
    }

    .sigline {
        position: relative;
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 6px 4px;
        margin: 0 -4px 4px;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    .sigline:hover { background: rgba(255, 221, 87, 0.18); }
    .sigline.done { cursor: default; }
    .sigline.done:hover { background: transparent; }

    .x { font-weight: 700; font-size: 12px; color: #2c2823; }
    .line {
        position: relative;
        flex: 1;
        min-width: 0;
        height: 22px;
        border-bottom: 1px solid #2c2823;
        display: flex;
        align-items: flex-end;
        overflow: visible;
    }
    .siglabel {
        position: absolute;
        left: 4px;
        bottom: -12px;
        font-family: Arial, sans-serif;
        font-size: 8px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #8a8072;
    }

    .script {
        font-family: 'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive;
        font-size: 26px;
        color: #1c3a6e;
        line-height: 1;
        transform: rotate(-2deg);
        transform-origin: left bottom;
    }
    .script.drawing {
        display: inline-block;
        clip-path: inset(0 100% 0 0);
        animation: reveal 900ms ease-out 40ms forwards;
    }
    @keyframes reveal {
        to { clip-path: inset(0 0% 0 0); }
    }

    .pencil {
        position: absolute;
        bottom: 2px;
        font-size: 16px;
        color: #2c2823;
        transform: rotate(35deg);
        animation: scrawl 900ms ease-out 40ms forwards;
    }
    @keyframes scrawl {
        0%   { left: 2%; }
        100% { left: 78%; }
    }

    .stamp {
        position: absolute;
        top: -6px;
        right: 4px;
        padding: 6px 10px;
        border: 3px solid #a3241c;
        border-radius: 4px;
        color: #a3241c;
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 800;
        font-size: 15px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(-14deg) scale(1);
        opacity: 0.85;
        mix-blend-mode: multiply;
        animation: thump 340ms cubic-bezier(0.2, 1.4, 0.4, 1);
        pointer-events: none;
    }
    @keyframes thump {
        0%   { transform: rotate(-14deg) scale(2.2); opacity: 0; }
        70%  { transform: rotate(-14deg) scale(0.92); opacity: 0.9; }
        100% { transform: rotate(-14deg) scale(1); opacity: 0.85; }
    }
</style>
