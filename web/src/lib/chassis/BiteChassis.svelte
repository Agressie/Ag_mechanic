<script>
    /*
     * Avionics flight-line test set, after the IFR 4000 / Barfield ramp testers.
     * What makes one of these unmistakable:
     *
     *   - landscape ruggedised case with thick moulded corner bumpers, in
     *     aviation hazard yellow
     *   - FIVE soft keys in a row beneath the display, labelled by text ON the
     *     screen directly above them, changing with the page
     *   - a separate arrow cluster and a dedicated SETUP key
     *   - a folding carry handle across the top
     *   - MIL-spec circular bayonet connectors on the top panel, not a car plug
     *   - battery state and a certification/calibration plate, because these
     *     things live on a calibration schedule
     */
    import { close } from '../nui.js';

    let { screen, press, pressed, device, lex, scan, softKeys, holdStart, holdEnd } = $props();
</script>

<div class="testset">
    <!-- Folding carry handle. -->
    <div class="handle"><span></span></div>

    <div class="case">
        <!-- Top panel: circular bayonet connectors and the cal plate. -->
        <div class="toppanel">
            <span class="conn"><i></i></span>
            <span class="conn small"><i></i></span>
            <span class="plate">
                <b>{device.model}</b>
                <em>{device.bus}</em>
            </span>
            <span class="cal">CAL DUE 04/27</span>
            <span class="battery"><i></i><i></i><i></i></span>
        </div>

        <div class="face">
            <div class="bezel">
                <div class="screen">
                    {@render screen()}
                    <div class="gloss"></div>
                </div>

                <!-- Soft-key labels sit on the glass, above their buttons. -->
                <div class="softlabels">
                    {#each softKeys as key}
                        <span class="softlabel">{key.label}</span>
                    {/each}
                </div>
            </div>

            <div class="softrow">
                {#each softKeys as key}
                    <button
                        class="sk" class:held={pressed === key.action}
                        onclick={() => press(key.action)}
                        onpointerdown={key.action === 'enter' ? holdStart : undefined}
                        onpointerup={key.action === 'enter' ? holdEnd : undefined}
                        onpointerleave={key.action === 'enter' ? holdEnd : undefined}
                    ></button>
                {/each}
            </div>

            <div class="lowerdeck">
                <div class="cluster">
                    <button class="hk up" class:held={pressed === 'up'} onclick={() => press('up')} aria-label="Up">▲</button>
                    <button class="hk left" class:held={pressed === 'left'} onclick={() => press('left')} aria-label="Page up">◀</button>
                    <button class="hk right" class:held={pressed === 'right'} onclick={() => press('right')} aria-label="Page down">▶</button>
                    <button class="hk down" class:held={pressed === 'down'} onclick={() => press('down')} aria-label="Down">▼</button>
                </div>

                <div class="fnkeys">
                    <button class="fn" onclick={() => press('readiness')}>BITE<em>STATUS</em></button>
                    <button class="fn" onclick={() => press('info')}>SETUP<em>AIRCRAFT</em></button>
                    <button class="fn warn" class:held={pressed === 'erase'} onclick={() => press('erase')}>
                        {lex.erase.split(' ')[0]}<em>FAULT LOG</em>
                    </button>
                    <button class="fn" onclick={close}>DISC<em>PORT</em></button>
                </div>

                <div class="statuslamps">
                    <span class="sl pwr lit">PWR</span>
                    <span class="sl cau" class:lit={scan.mil}>{lex.lamp}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="bumper tl"></div><div class="bumper tr"></div>
    <div class="bumper bl"></div><div class="bumper br"></div>
</div>

<style>
    .testset {
        position: relative;
        /* Instrument screen: cooler, larger, amber accents like a real BITE set. */
        --lcd-ink: #b7d9ea;
        --lcd-accent: #ffc266;
        --lcd-bright: #eaf6ff;
        --lcd-faint: #6d90a8;
        --lcd-rule: rgba(255, 194, 102, 0.30);
        --lcd-select: rgba(255, 194, 102, 0.18);
        --lcd-glow: rgba(120, 190, 230, 0.35);
        --lcd-alarm: #ff8f6b;
        --lcd-warn: #ffd23f;
        --lcd-height: 214px;
        --lcd-size: 12px;
    }

    /* Folding handle across the top. */
    .handle {
        position: absolute;
        left: 50%; top: -34px;
        width: 200px; height: 46px;
        margin-left: -95px;
        border: 10px solid #14202b;
        border-bottom: none;
        border-radius: 22px 22px 0 0;
        box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.05);
    }
    .handle span {
        position: absolute; left: 22px; right: 22px; top: -3px; height: 4px;
        border-radius: 3px;
        background: rgba(255, 194, 102, 0.22);
    }

    .case {
        position: relative;
        width: 620px;
        padding: 0 0 22px;
        border-radius: 16px;
        background: linear-gradient(170deg, #1b2a36 0%, #0d1a25 45%, #060e16 100%);
        border: 1px solid rgba(255, 194, 102, 0.22);
        box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    /* Aviation hazard-yellow corner bumpers. */
    /* Corner caps: heavily rounded on the outside, square where they meet the
       case, so they read as bumpers wrapping the corner rather than stickers. */
    .bumper {
        position: absolute;
        width: 58px; height: 42px;
        background: linear-gradient(140deg, #e8ad35 0%, #93670f 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 6px rgba(0, 0, 0, 0.45);
        z-index: -1;
    }
    .bumper.tl { left: -15px; top: -13px; border-radius: 20px 0 0 0; }
    .bumper.tr { right: -15px; top: -13px; border-radius: 0 20px 0 0; }
    .bumper.bl { left: -15px; bottom: -13px; border-radius: 0 0 0 20px; }
    .bumper.br { right: -15px; bottom: -13px; border-radius: 0 0 20px 0; }

    .toppanel {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 22px 11px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: linear-gradient(180deg, rgba(255, 194, 102, 0.06) 0%, transparent 100%);
        border-radius: 16px 16px 0 0;
    }
    /* MIL-spec circular bayonet, not an OBD trapezoid. */
    .conn {
        width: 30px; height: 30px; border-radius: 50%;
        background: radial-gradient(circle at 40% 35%, #2b3d4c 0%, #101c26 70%);
        box-shadow: inset 0 0 0 2px #0a141c, inset 0 0 0 4px #24333f, 0 1px 0 rgba(255, 255, 255, 0.06);
        display: grid; place-items: center;
    }
    .conn i {
        width: 13px; height: 13px; border-radius: 50%;
        background: repeating-conic-gradient(#0a1219 0deg 24deg, #16242f 24deg 48deg);
    }
    .conn.small { width: 22px; height: 22px; }
    .conn.small i { width: 9px; height: 9px; }

    .plate { display: flex; flex-direction: column; gap: 1px; margin-left: 4px; }
    .plate b { font-family: var(--mono); font-size: 16px; letter-spacing: 0.05em; color: #f0f6fa; }
    .plate em { font-style: normal; font-size: 8px; letter-spacing: 0.16em; color: #e0a52f; }

    .cal {
        margin-left: auto;
        font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em;
        color: #7d95a6;
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 3px; padding: 3px 7px;
    }
    .battery { display: flex; gap: 2px; align-items: flex-end; }
    .battery i { width: 4px; background: #37e07f; box-shadow: 0 0 6px rgba(55, 224, 127, 0.6); }
    .battery i:nth-child(1) { height: 7px; }
    .battery i:nth-child(2) { height: 10px; }
    .battery i:nth-child(3) { height: 13px; }

    .face { padding: 14px 22px 0; }

    .bezel {
        position: relative;
        border-radius: 8px;
        padding: 12px 14px 4px;
        background: #060f18;
        box-shadow: inset 0 0 0 1px rgba(255, 194, 102, 0.18), inset 0 3px 10px rgba(0, 0, 0, 0.8);
    }
    .screen {
        position: relative;
        padding: 2px 4px;
        overflow: hidden;
    }
    .gloss {
        position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(112deg, rgba(255, 255, 255, 0.045) 0%, transparent 34%);
    }

    /* On-glass labels, aligned to the buttons below. */
    .softlabels {
        display: grid; grid-template-columns: repeat(5, 1fr);
        gap: 8px; margin-top: 8px;
        border-top: 1px solid rgba(255, 194, 102, 0.24);
        padding-top: 6px;
    }
    .softlabel {
        font-family: var(--mono);
        font-size: 10px; letter-spacing: 0.08em;
        text-align: center;
        color: #ffc266;
        text-shadow: 0 0 6px rgba(255, 194, 102, 0.4);
    }

    .softrow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 9px; }
    .sk {
        height: 26px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        background: linear-gradient(180deg, #2a3a48 0%, #14212c 100%);
        box-shadow: 0 3px 0 rgba(3, 8, 12, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s ease;
    }
    .sk::after {
        content: '';
        display: block; width: 22px; height: 3px; margin: 0 auto;
        border-radius: 2px; background: rgba(255, 194, 102, 0.35);
    }
    .sk:hover { background: linear-gradient(180deg, #34485a 0%, #1a2937 100%); }
    .sk:active, .sk.held {
        transform: translateY(3px);
        box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7);
        background: linear-gradient(180deg, #17252f 0%, #0f1a23 100%);
    }

    .lowerdeck { display: flex; align-items: center; gap: 22px; margin-top: 16px; }

    .cluster { position: relative; width: 104px; height: 78px; flex: none; }
    .hk {
        position: absolute;
        width: 34px; height: 26px;
        display: grid; place-items: center;
        font-size: 10px;
        color: #c3d8e6;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        background: linear-gradient(180deg, #2a3a48 0%, #14212c 100%);
        box-shadow: 0 3px 0 rgba(3, 8, 12, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        cursor: pointer;
        transition: transform 0.06s ease, box-shadow 0.06s ease;
    }
    .hk.up { left: 35px; top: 0; }
    .hk.down { left: 35px; bottom: 0; }
    .hk.left { left: 0; top: 26px; }
    .hk.right { right: 0; top: 26px; }
    .hk:active, .hk.held { transform: translateY(3px); box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7); color: #ffc266; }

    .fnkeys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex: 1; }
    .fn {
        display: flex; flex-direction: column; gap: 2px; align-items: center;
        font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
        color: #d3e4ef;
        padding: 8px 4px; border-radius: 5px;
        border: 1px solid rgba(255, 255, 255, 0.10);
        background: linear-gradient(180deg, #263544 0%, #121e28 100%);
        box-shadow: 0 3px 0 rgba(3, 8, 12, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.10);
        cursor: pointer;
        transition: transform 0.06s ease, box-shadow 0.06s ease;
    }
    .fn em { font-style: normal; font-size: 7px; letter-spacing: 0.12em; color: #7d95a6; }
    .fn.warn { border-color: rgba(224, 165, 47, 0.4); color: #ffd08a; }
    .fn:active, .fn.held { transform: translateY(3px); box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7); }

    .statuslamps { display: flex; flex-direction: column; gap: 7px; flex: none; }
    .sl {
        font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em;
        text-align: center; width: 46px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px; padding: 3px 0;
        color: #4d6474;
    }
    .sl.pwr.lit { color: #9df3c4; border-color: rgba(55, 224, 127, 0.5); box-shadow: 0 0 10px rgba(55, 224, 127, 0.25); }
    .sl.cau.lit { color: #ffd08a; border-color: rgba(224, 165, 47, 0.6); box-shadow: 0 0 10px rgba(224, 165, 47, 0.35); }
</style>
