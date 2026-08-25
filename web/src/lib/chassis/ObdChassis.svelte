<script>
    /*
     * Automotive code reader, built after the consumer handhelds - Autel
     * AutoLink, Innova, Launch Creader. The tells are all there:
     *
     *   - portrait body with moulded rubber side grips
     *   - a hardwired cable straight out of the top, not a socket
     *   - three colour-coded readiness LEDs above the screen, green/amber/red
     *   - a round D-pad with ENTER in the middle, the shape everyone knows
     *   - a one-touch readiness key, the feature these tools are sold on
     *   - speaker grille and USB socket along the bottom edge
     */
    import { close } from '../nui.js';

    let { screen, press, pressed, device, lex, eraseKey, lamps, holdStart, holdEnd } = $props();
</script>

<div class="reader">
    <!-- Hardwired OBD-II lead, up and off the top of the frame. -->
    <svg class="lead" viewBox="0 0 220 210" aria-hidden="true">
        <path class="jacket" d="M110 208 C110 150 78 128 52 96 C30 68 24 34 30 -8" />
        <path class="sheen" d="M110 208 C110 150 78 128 52 96 C30 68 24 34 30 -8" />
    </svg>

    <div class="grip left"></div>
    <div class="grip right"></div>

    <div class="body">
        <div class="topband">
            <span class="maker">{device.model}</span>
            <span class="bus">{device.bus}</span>
        </div>

        <!-- Readiness lamps: the thing you look at before the screen. -->
        <div class="lamps">
            <span class="lampcol">
                <i class="lamp green" class:lit={lamps.green}></i>
                <em>PASS</em>
            </span>
            <span class="lampcol">
                <i class="lamp amber" class:lit={lamps.amber}></i>
                <em>PEND</em>
            </span>
            <span class="lampcol">
                <i class="lamp red" class:lit={lamps.red}></i>
                <em>{lex.lamp}</em>
            </span>
        </div>

        <div class="bezel">
            <div class="screen">
                {@render screen()}
                <div class="scanlines"></div>
            </div>
        </div>

        <div class="pad">
            <button class="btn soft" class:held={pressed === 'back'} onclick={() => press('back')}>
                ESC
            </button>

            <div class="dpad">
                <span class="dpad-ring"></span>
                <button class="dbtn up" class:held={pressed === 'up'} onclick={() => press('up')} aria-label="Up">▲</button>
                <button class="dbtn left" class:held={pressed === 'left'} onclick={() => press('left')} aria-label="Page up">◀</button>
                <button class="dbtn right" class:held={pressed === 'right'} onclick={() => press('right')} aria-label="Page down">▶</button>
                <button class="dbtn down" class:held={pressed === 'down'} onclick={() => press('down')} aria-label="Down">▼</button>
                <button
                    class="enter" class:held={pressed === 'enter'}
                    onclick={() => press('enter')}
                    onpointerdown={holdStart}
                    onpointerup={holdEnd}
                    onpointerleave={holdEnd}
                >ENTER</button>
            </div>

            <button class="btn soft" class:held={pressed === 'erase'} onclick={() => press('erase')}>
                {eraseKey}
            </button>
        </div>

        <!-- The one-touch key these readers are sold on. -->
        <button class="oneclick" onclick={() => press('readiness')}>
            <span class="badge">I/M</span>
            ONE-CLICK READINESS
        </button>

        <div class="baseband">
            <span class="grille">
                {#each Array(9) as _}<i></i>{/each}
            </span>
            <span class="usb"></span>
            <button class="unplug" onclick={close}>UNPLUG</button>
        </div>
    </div>
</div>

<style>
    .reader {
        position: relative;
        /* Screen tint: small backlit colour TFT. */
        --lcd-ink: #8fe3ff;
        --lcd-accent: #1ea6f0;
        --lcd-bright: #eafaff;
        --lcd-faint: #5d80a0;
        --lcd-rule: rgba(30, 166, 240, 0.32);
        --lcd-select: rgba(30, 166, 240, 0.22);
        --lcd-glow: rgba(30, 166, 240, 0.55);
        --lcd-alarm: #ff8f6b;
        --lcd-warn: #ffd23f;
        --lcd-height: 228px;
        --lcd-size: 12px;
    }

    .lead {
        position: absolute;
        left: 50%; top: -196px;
        width: 220px; height: 210px;
        margin-left: -110px;
        overflow: visible; pointer-events: none;
    }
    .lead .jacket { fill: none; stroke: #0b1a2b; stroke-width: 13; stroke-linecap: round; }
    .lead .sheen { fill: none; stroke: rgba(30, 166, 240, 0.20); stroke-width: 3.5; transform: translateX(-3px); }

    /* Moulded rubber over-mould down each side. */
    .grip {
        position: absolute;
        top: 96px; bottom: 96px;
        width: 26px;
        background: linear-gradient(90deg, #16334f 0%, #0a1a2c 60%, #071320 100%);
        box-shadow: inset 0 0 0 1px rgba(30, 166, 240, 0.14);
    }
    .grip.left { left: -17px; border-radius: 14px 0 0 14px; }
    .grip.right { right: -17px; border-radius: 0 14px 14px 0; background: linear-gradient(270deg, #16334f 0%, #0a1a2c 60%, #071320 100%); }

    .body {
        position: relative;
        width: 356px;
        padding: 12px 16px 14px;
        border-radius: 30px 30px 22px 22px;
        background: linear-gradient(168deg, #12283f 0%, #071426 48%, #030a13 100%);
        border: 1px solid var(--line-strong);
        box-shadow: var(--shadow), var(--glow), inset 0 1px 0 rgba(30, 166, 240, 0.2);
    }

    .topband { display: flex; align-items: baseline; gap: 8px; padding: 2px 4px 10px; }
    .maker { font-family: var(--mono); font-size: 15px; font-weight: 700; letter-spacing: 0.04em; color: var(--text); }
    .bus { font-size: 9px; letter-spacing: 0.14em; color: var(--text-faint); }

    .lamps { display: flex; gap: 20px; padding: 0 8px 10px; }
    .lampcol { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .lampcol em {
        font-style: normal; font-size: 8px; letter-spacing: 0.12em; color: var(--text-faint);
    }
    .lamp {
        width: 13px; height: 13px; border-radius: 50%; display: block;
        background: #0a1622;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .lamp.green.lit { background: #37e07f; box-shadow: 0 0 12px rgba(55, 224, 127, 0.85), inset 0 0 3px #d7ffe8; }
    .lamp.amber.lit { background: #ffc633; box-shadow: 0 0 12px rgba(255, 198, 51, 0.85), inset 0 0 3px #fff1c2; }
    .lamp.red.lit { background: #ff5b4a; box-shadow: 0 0 14px rgba(255, 91, 74, 0.9), inset 0 0 3px #ffd4cd; }

    /* Thick plastic bezel, recessed glass. */
    .bezel {
        border-radius: 10px;
        padding: 9px;
        background: linear-gradient(180deg, #0a1726 0%, #050e18 100%);
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(30, 166, 240, 0.12);
    }
    .screen {
        position: relative;
        border-radius: 5px;
        padding: 9px 11px;
        background: #020a12;
        box-shadow: inset 0 0 26px rgba(30, 166, 240, 0.13);
        overflow: hidden;
    }
    .scanlines {
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.24) 0 1px, transparent 1px 3px);
        mix-blend-mode: multiply;
    }

    .pad {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
    }

    .btn, .dbtn, .enter, .oneclick, .unplug {
        font-family: var(--mono);
        color: #d6ecfa;
        background: linear-gradient(180deg, #1a3854 0%, #0b1c30 100%);
        border: 1px solid rgba(30, 166, 240, 0.28);
        box-shadow: 0 3px 0 rgba(2, 8, 16, 0.9), inset 0 1px 0 rgba(140, 210, 255, 0.15);
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s ease, color 0.12s ease;
        cursor: pointer;
    }
    .btn.soft {
        font-size: 11px; letter-spacing: 0.08em;
        padding: 13px 0; border-radius: 9px; width: 100%;
    }
    .btn:hover, .dbtn:hover, .enter:hover, .oneclick:hover, .unplug:hover { background: linear-gradient(180deg, #204665 0%, #0e2540 100%); }
    .held, .btn:active, .dbtn:active, .enter:active {
        transform: translateY(3px);
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.65);
        color: var(--accent);
    }

    /* The round D-pad every one of these tools has. */
    .dpad { position: relative; width: 132px; height: 132px; }
    .dpad-ring {
        position: absolute; inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 30%, #17334d 0%, #0a1826 70%, #061220 100%);
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6), 0 2px 0 rgba(2, 8, 16, 0.9), 0 0 0 1px rgba(30, 166, 240, 0.2);
    }
    .dbtn {
        position: absolute;
        width: 40px; height: 34px;
        display: grid; place-items: center;
        font-size: 12px;
        background: none; border: none; box-shadow: none;
        color: #a9cbe4;
    }
    .dbtn:hover { background: none; color: var(--accent); }
    .dbtn.up { top: 2px; left: 46px; }
    .dbtn.down { bottom: 2px; left: 46px; }
    .dbtn.left { left: 1px; top: 49px; }
    .dbtn.right { right: 1px; top: 49px; }

    .enter {
        position: absolute;
        left: 33px; top: 33px;
        width: 66px; height: 66px;
        border-radius: 50%;
        font-size: 10px; letter-spacing: 0.06em;
        color: #02121f; font-weight: 700;
        background: linear-gradient(180deg, var(--accent) 0%, var(--accent-deep) 100%);
        border-color: var(--accent);
        box-shadow: 0 3px 0 rgba(2, 8, 16, 0.9), var(--glow);
    }
    .enter:hover { background: linear-gradient(180deg, #47bcff 0%, #1470cc 100%); }
    .enter.held { background: linear-gradient(180deg, #1470cc 0%, #0b4f92 100%); }

    .oneclick {
        display: flex; align-items: center; justify-content: center; gap: 9px;
        width: 100%; margin-top: 14px;
        padding: 11px 0; border-radius: 22px;
        font-size: 10px; letter-spacing: 0.12em;
    }
    .badge {
        font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
        background: var(--accent); color: #02121f;
        border-radius: 3px; padding: 1px 5px;
    }

    .baseband { display: flex; align-items: center; gap: 12px; margin-top: 13px; padding: 0 4px; }
    .grille { display: flex; gap: 3px; }
    .grille i { width: 3px; height: 9px; border-radius: 2px; background: #061321; box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.9); }
    .usb {
        width: 22px; height: 8px; border-radius: 2px; margin-left: 2px;
        background: #061321; box-shadow: inset 0 0 0 1px rgba(30, 166, 240, 0.18);
    }
    .unplug {
        margin-left: auto;
        font-size: 9px; letter-spacing: 0.1em;
        padding: 7px 12px; border-radius: 7px;
    }
</style>
