<script>
    /*
     * Marine engine reader, after the sealed handhelds that live on a boat -
     * Volvo Penta Vodia, Diacom, the diesel-handheld family. The details that
     * make one read as marine rather than automotive:
     *
     *   - squat sealed case with a visible gasket seam and four corner screws
     *   - big square keys sized for wet hands and gloves, widely spaced
     *   - a black Deutsch 9-pin under a hinged weather flap. Black is the J1939
     *     250k keying, which is exactly what this tool reports
     *   - lanyard lug, because everything on a boat is tied to something
     *   - an IP rating badge, printed on the case like the real ones
     *   - high-contrast near-white screen, for reading in direct sun
     */
    import { close } from '../nui.js';

    let { screen, press, pressed, device, lex, scan, eraseKey, holdStart, holdEnd } = $props();
</script>

<div class="unit">
    <!-- Sealed cable gland and the Deutsch 9-pin, side-mounted under a flap. -->
    <svg class="loom" viewBox="0 0 240 170" aria-hidden="true">
        <path class="jacket" d="M62 2 C62 52 96 74 130 100 C166 128 200 148 236 152" />
        <path class="sheen" d="M62 2 C62 52 96 74 130 100 C166 128 200 148 236 152" />
    </svg>

    <div class="lug"><i></i></div>

    <div class="shell">
        <div class="screws">
            <i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>
        </div>

        <div class="header">
            <span class="marque">{device.model}</span>
            <span class="sub">{device.bus}</span>
            <span class="ip">IP67</span>
        </div>

        <!-- Gasket seam between lid and body. -->
        <div class="seam"></div>

        <div class="window">
            <div class="glassplate">
                {@render screen()}
                <div class="sun"></div>
            </div>
        </div>

        <div class="keys">
            <div class="navblock">
                <button class="mk k-up" class:held={pressed === 'up'} onclick={() => press('up')} aria-label="Up">▲</button>
                <button class="mk k-left" class:held={pressed === 'left'} onclick={() => press('left')} aria-label="Page up">◀</button>
                <button
                    class="mk k-enter" class:held={pressed === 'enter'}
                    onclick={() => press('enter')}
                    onpointerdown={holdStart}
                    onpointerup={holdEnd}
                    onpointerleave={holdEnd}
                >OK</button>
                <button class="mk k-right" class:held={pressed === 'right'} onclick={() => press('right')} aria-label="Page down">▶</button>
                <button class="mk k-down" class:held={pressed === 'down'} onclick={() => press('down')} aria-label="Down">▼</button>
            </div>

            <div class="sideblock">
                <button class="mk wide" class:held={pressed === 'back'} onclick={() => press('back')}>BACK</button>
                <button class="mk wide" onclick={() => press('readiness')}>TEST</button>
                <button class="mk wide alert" class:held={pressed === 'erase'} onclick={() => press('erase')}>{eraseKey}</button>
                <button class="mk wide" onclick={close}>OFF</button>
            </div>
        </div>

        <div class="footrail">
            <span class="port">
                <span class="flap"></span>
                <span class="deutsch">
                    {#each Array(9) as _}<i></i>{/each}
                </span>
                <span class="portlabel">J1939 · 250k</span>
            </span>
            <span class="warnlamp" class:lit={scan.mil}>{lex.lamp}</span>
        </div>
    </div>
</div>

<style>
    .unit {
        position: relative;
        /* Transflective, sunlight-readable: near-white on almost black. */
        --lcd-ink: #dff2fb;
        --lcd-accent: #7fe3ff;
        --lcd-bright: #ffffff;
        --lcd-faint: #6f93a8;
        --lcd-rule: rgba(127, 227, 255, 0.34);
        --lcd-select: rgba(127, 227, 255, 0.22);
        --lcd-glow: rgba(127, 227, 255, 0.30);
        --lcd-alarm: #ff7a52;
        --lcd-warn: #ffc32e;
        --lcd-height: 200px;
        --lcd-size: 12.5px;
    }

    /* Sealed lead out of the bottom of the case, next to the port. */
    .loom {
        position: absolute;
        left: 8px; bottom: -152px;
        width: 240px; height: 170px;
        overflow: visible; pointer-events: none;
    }
    .loom .jacket { fill: none; stroke: #0a141d; stroke-width: 14; stroke-linecap: round; }
    .loom .sheen { fill: none; stroke: rgba(127, 227, 255, 0.16); stroke-width: 3.5; transform: translateX(-3.5px); }

    /* Lanyard lug - everything on a boat is tied to something. */
    /* Moulded ear on the case corner with a lanyard hole through it. */
    .lug {
        position: absolute; right: -22px; top: 26px;
        width: 40px; height: 30px;
        border-radius: 0 14px 14px 0;
        background: linear-gradient(90deg, #12293c 0%, #0d1d2a 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 2px 2px 6px rgba(0, 0, 0, 0.4);
        display: grid; place-items: center;
        z-index: -1;
    }
    .lug i {
        width: 12px; height: 12px; border-radius: 50%;
        margin-left: 16px;
        background: #02090e;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 1), 0 1px 0 rgba(255, 255, 255, 0.07);
    }

    .shell {
        position: relative;
        width: 476px;
        padding: 13px 20px 24px;
        border-radius: 20px;
        background: linear-gradient(172deg, #12293c 0%, #0a1926 46%, #050d15 100%);
        border: 1px solid rgba(127, 227, 255, 0.22);
        box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.09);
    }

    /* Four sealing screws, because the case is gasketed shut. */
    .screws i {
        position: absolute;
        width: 9px; height: 9px; border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #4b5f6d 0%, #1a2731 75%);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.6);
    }
    .screws i::after {
        content: ''; position: absolute; inset: 3px 1px;
        border-top: 1px solid rgba(0, 0, 0, 0.7);
    }
    .screws i.tl { left: 9px; top: 9px; }
    .screws i.tr { right: 9px; top: 9px; }
    .screws i.bl { left: 9px; bottom: 9px; }
    .screws i.br { right: 9px; bottom: 9px; }

    .header { display: flex; align-items: baseline; gap: 10px; padding: 0 14px 9px; }
    .marque { font-family: var(--mono); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; color: #eaf7ff; }
    .sub { font-size: 9px; letter-spacing: 0.15em; color: #6f93a8; }
    .ip {
        margin-left: auto;
        font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em;
        color: #0a1a24; background: #7fe3ff;
        border-radius: 3px; padding: 2px 6px;
    }

    .seam {
        height: 3px; margin: 0 -20px 12px;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.75) 0%, rgba(127, 227, 255, 0.14) 100%);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .window {
        border-radius: 8px;
        padding: 8px;
        background: #06121b;
        box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.75), inset 0 0 0 3px rgba(127, 227, 255, 0.16);
    }
    .glassplate {
        position: relative;
        border-radius: 4px;
        padding: 8px 11px;
        background: #01131c;
        overflow: hidden;
    }
    .sun {
        position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(100deg, rgba(255, 255, 255, 0.05) 0%, transparent 40%);
    }

    .keys { display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-top: 15px; align-items: center; }

    /* Wide, widely spaced keys - meant for wet hands and gloves. */
    .navblock {
        display: grid;
        grid-template-columns: repeat(3, 54px);
        grid-template-rows: repeat(3, 40px);
        gap: 7px;
    }
    .k-up { grid-area: 1 / 2; }
    .k-left { grid-area: 2 / 1; }
    .k-enter { grid-area: 2 / 2; }
    .k-right { grid-area: 2 / 3; }
    .k-down { grid-area: 3 / 2; }

    .mk {
        font-family: var(--mono);
        font-size: 13px; letter-spacing: 0.06em;
        color: #dff0fa;
        border-radius: 9px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: linear-gradient(180deg, #2c4658 0%, #13242f 100%);
        box-shadow: 0 4px 0 rgba(2, 8, 12, 0.9), inset 0 1px 0 rgba(190, 235, 255, 0.2);
        cursor: pointer;
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s ease, color 0.12s ease;
    }
    .mk:hover { background: linear-gradient(180deg, #365567 0%, #182c39 100%); }
    .mk:active, .mk.held {
        transform: translateY(4px);
        box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.7);
        background: linear-gradient(180deg, #152834 0%, #0d1a23 100%);
        color: var(--accent);
    }
    .mk.k-enter {
        color: #02121f; font-weight: 700;
        background: linear-gradient(180deg, #7fe3ff 0%, #1b86c4 100%);
        border-color: #7fe3ff;
        box-shadow: 0 4px 0 rgba(2, 8, 12, 0.9), 0 0 18px rgba(127, 227, 255, 0.35);
    }
    .mk.k-enter:hover { background: linear-gradient(180deg, #a3edff 0%, #2496d6 100%); }
    .mk.k-enter.held { background: linear-gradient(180deg, #1b86c4 0%, #0d5c8c 100%); color: #02121f; }

    .sideblock { display: grid; grid-template-columns: repeat(2, 84px); gap: 7px; }
    .mk.wide { padding: 12px 0; font-size: 11px; }
    .mk.wide.alert { border-color: rgba(255, 122, 82, 0.42); color: #ffbda8; }

    .footrail { display: flex; align-items: flex-end; gap: 14px; margin-top: 16px; padding: 0 10px 2px; min-height: 40px; }

    /* Black Deutsch 9-pin behind a weather flap. */
    .port { position: relative; display: flex; align-items: flex-end; gap: 10px; padding-top: 14px; }
    /* Weather flap, hinged up and out of the way. */
    .flap {
        position: absolute; left: 0; top: 0;
        width: 42px; height: 11px;
        border-radius: 7px 7px 2px 2px;
        background: linear-gradient(180deg, #22384a 0%, #0c1720 100%);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
    }
    /* Black Deutsch 9-pin: black is the 250k keying, which is what we report. */
    .deutsch {
        display: grid;
        grid-template-columns: repeat(3, 5px);
        gap: 3px;
        padding: 7px;
        border-radius: 50%;
        background: #05080b;
        box-shadow: inset 0 0 0 2px #121a21, 0 0 0 1px rgba(255, 255, 255, 0.07);
    }
    .deutsch i { width: 5px; height: 5px; border-radius: 50%; background: #223038; }
    .portlabel { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: #5d7c8f; }

    .warnlamp {
        margin-left: auto;
        font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
        color: #3f5666;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 4px; padding: 4px 10px;
    }
    .warnlamp.lit {
        color: #1a0d06; background: #ffa040; border-color: #ffa040;
        box-shadow: 0 0 16px rgba(255, 160, 64, 0.5);
    }
</style>
