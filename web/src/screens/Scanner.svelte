<script>
    /*
     * The handheld scanner.
     *
     * Deliberately a *device*, not a menu: a character LCD and six physical
     * buttons, and you work the firmware the way you would work a real one.
     * Reading a code tells you what has failed; opening it tells you where to
     * go and look.
     *
     * Every button is clickable, and the keyboard mirrors it - a keypress
     * depresses the matching button on screen, so it still reads as hardware.
     */
    import { vehicleRpc, close } from '../lib/nui.js';
    import ObdChassis from '../lib/chassis/ObdChassis.svelte';
    import BiteChassis from '../lib/chassis/BiteChassis.svelte';
    import MarineChassis from '../lib/chassis/MarineChassis.svelte';

    let { payload = {} } = $props();

    let scan = $state(payload.scan || { codes: [], modules: [], live: [], monitors: [], counts: {} });

    /* The three tools do not use the same words for the same things, so every
       label on the device comes from its own lexicon. */
    const FALLBACK_LEXICON = {
        codes: 'STORED CODES', pending: 'PENDING CODES', systems: 'SYSTEM SCAN',
        system: 'MODULE', code: 'CODE', lamp: 'MIL',
        live: 'LIVE DATA', frame: 'FREEZE FRAME', monitors: 'I/M MONITORS',
    };
    const device = $derived(scan.device || { model: 'AGM-9000', bus: 'OBD-II / CAN', lexicon: FALLBACK_LEXICON });
    const lex = $derived({ ...FALLBACK_LEXICON, ...(device.lexicon || {}) });

    /* --- firmware state ------------------------------------------------ */
    let view = $state('boot');
    let stack = $state([]);
    let cursor = $state(0);
    let top = $state(0);
    let status = $state('');
    let bootLines = $state([]);
    let moduleFilter = $state(null);
    let openSystem = $state(null);
    let openPart = $state(null);
    let openCode = $state(null);
    let frame = $state(null);
    let pressed = $state(null);

    const ROWS = 7;

    const MENU = $derived([
        { id: 'codes', label: `READ ${lex.codes}` },
        { id: 'pending', label: lex.pending },
        { id: 'systems', label: lex.systems },
        { id: 'live', label: lex.live },
        { id: 'freeze', label: lex.frame },
        { id: 'info', label: 'VEHICLE INFO' },
        { id: 'monitors', label: lex.monitors },
    ]);

    const stored = $derived(scan.codes.filter((c) => c.status === 'stored'));
    const pending = $derived(scan.codes.filter((c) => c.status === 'pending'));

    /* The list the cursor is currently walking. */
    const list = $derived.by(() => {
        switch (view) {
            case 'menu': return MENU;
            case 'codes': return stored;
            case 'pending': return pending;
            case 'systems': return scan.modules;
            case 'systemParts': return openSystem ? openSystem.parts : [];
            case 'part': return openPart ? openPart.codes : [];
            case 'moduleCodes': return scan.codes.filter((c) => c.module === moduleFilter);
            case 'live': return scan.live;
            case 'monitors': return scan.monitors;
            case 'freeze': return frame || [];
            default: return [];
        }
    });

    const menuCounts = $derived({
        codes: stored.length,
        pending: pending.length,
        systems: scan.modules.length,
    });

    /* --- boot ----------------------------------------------------------- */
    $effect(() => {
        const timers = [];
        const say = (text, delay) => timers.push(setTimeout(() => { bootLines = [...bootLines, text]; }, delay));

        say(`${device.model}  ${(scan.device && scan.device.label ? scan.device.label : 'SCAN TOOL').toUpperCase()}`, 120);
        say('FIRMWARE v2.14  SELF TEST OK', 480);
        say('', 700);
        say('ESTABLISHING LINK...', 820);
        timers.push(setTimeout(() => { view = 'link'; }, 1500));
        return () => timers.forEach(clearTimeout);
    });

    $effect(() => {
        if (view !== 'link') return;
        const timer = setTimeout(() => { if (view === 'link') go('menu'); }, 2200);
        return () => clearTimeout(timer);
    });

    /* --- live data polling ---------------------------------------------- */
    $effect(() => {
        if (view !== 'live') return;
        const handle = setInterval(async () => {
            const result = await vehicleRpc('scanner:live', {});
            if (result && result.ok) scan = { ...scan, live: result.live };
        }, payload.liveInterval || 900);
        return () => clearInterval(handle);
    });

    /* --- navigation ----------------------------------------------------- */
    function go(next, remember = true) {
        if (remember && view !== next) {
            stack = [...stack, { view, cursor, top, moduleFilter, openSystem, openPart, openCode }];
        }
        view = next;
        cursor = 0;
        top = 0;
        status = '';
    }

    function back() {
        if (!stack.length) {
            if (view === 'menu') return close();
            return go('menu', false);
        }
        const previous = stack[stack.length - 1];
        stack = stack.slice(0, -1);
        view = previous.view;
        cursor = previous.cursor;
        top = previous.top;
        moduleFilter = previous.moduleFilter;
        openSystem = previous.openSystem;
        openPart = previous.openPart;
        openCode = previous.openCode;
        status = '';
    }

    function move(delta) {
        const length = list.length;
        if (!length) return;
        cursor = Math.max(0, Math.min(length - 1, cursor + delta));
        if (cursor < top) top = cursor;
        if (cursor >= top + ROWS) top = cursor - ROWS + 1;
    }

    async function openFreeze(component) {
        const result = await vehicleRpc('scanner:freeze', { component });
        frame = result && result.ok ? result.frame : [];
        go('freeze');
    }

    async function select() {
        if (view === 'boot' || view === 'link') return go('menu', false);

        if (view === 'menu') {
            const choice = MENU[cursor];
            if (choice.id === 'freeze') {
                const worst = stored[0];
                if (!worst) return beep('NO CODES TO FRAME');
                return openFreeze(worst.component);
            }
            return go(choice.id);
        }

        if (view === 'codes' || view === 'pending' || view === 'moduleCodes' || view === 'part') {
            const code = list[cursor];
            if (!code) return;
            /* Codes reached through a part already know which part they are on. */
            openCode = view === 'part'
                ? { ...code, component: openPart.id, componentLabel: openPart.label, where: openPart.where, location: openPart.location, moduleLabel: openSystem ? openSystem.label : '' }
                : code;
            return go('code');
        }

        /* Systems are browsable whether or not they have faults - a module
           reporting nothing wrong is still worth being able to look at. */
        if (view === 'systems') {
            const module = list[cursor];
            if (!module) return;
            openSystem = module;
            return go('systemParts');
        }

        if (view === 'systemParts') {
            const part = list[cursor];
            if (!part) return;
            openPart = part;
            return go('part');
        }

        if (view === 'code' && openCode) return openFreeze(openCode.component);
    }

    function beep(message) {
        status = message;
        setTimeout(() => { if (status === message) status = ''; }, 1600);
    }

    /* --- input ---------------------------------------------------------- */
    function press(button) {
        pressed = button;
        setTimeout(() => { if (pressed === button) pressed = null; }, 130);

        switch (button) {
            case 'up': return move(-1);
            case 'down': return move(1);
            case 'left': return move(-ROWS);
            case 'right': return move(ROWS);
            case 'enter': return select();
            case 'back': return back();
            case 'readiness':
                return view === 'monitors' ? undefined : go('monitors');
            case 'info':
                return view === 'info' ? undefined : go('info');
            case 'live':
                return view === 'live' ? undefined : go('live');
            default:
                return undefined;
        }
    }

    const KEYS = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        Enter: 'enter', Space: 'enter', Backspace: 'back', Escape: 'back',
    };

    function onKeyDown(event) {
        const button = KEYS[event.code] || KEYS[event.key];
        if (!button) return;
        event.preventDefault();

        if (event.repeat && button !== 'up' && button !== 'down') return;
        press(button);
    }

    function onKeyUp(event) {
        if ((KEYS[event.code] || KEYS[event.key]) === 'enter') pressed = null;
    }

    $effect(() => {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    });

    /* --- helpers -------------------------------------------------------- */
    const clip = (text, width) => {
        const value = String(text ?? '');
        return value.length > width ? `${value.slice(0, width - 1)}…` : value;
    };

    const window7 = $derived(list.slice(top, top + ROWS));

    /*
     * Five soft keys, the way a flight-line test set works: the labels live on
     * the screen directly above the physical buttons, and change with the page.
     */
    const softKeys = $derived.by(() => {
        const enter = view === 'code' ? lex.frame.split(' ')[0]
            : view === 'systems' ? 'OPEN'
                : view === 'systemParts' ? 'DETAIL'
                    : view === 'part' ? 'OPEN'
                        : view === 'boot' || view === 'link' ? 'CONT'
                            : 'SELECT';
        return [
            { label: stack.length || view !== 'menu' ? 'BACK' : 'EXIT', action: 'back' },
            { label: 'UP', action: 'up' },
            { label: 'DOWN', action: 'down' },
            { label: enter, action: 'enter' },
            { label: 'SETUP', action: 'info' },
        ];
    });

    /* Traffic-light indicator, exactly what a consumer code reader shows. */
    const lamps = $derived({
        green: !scan.mil && !pending.length,
        amber: pending.length > 0 && !scan.mil,
        red: scan.mil,
    });

    const chassis = $derived(
        device.id === 'bite' ? BiteChassis : device.id === 'marine' ? MarineChassis : ObdChassis,
    );

    /* "3/6" on the detail page, so you know where you are in the list. */
    const codeIndex = $derived.by(() => {
        if (!openCode) return '';
        const source = stack.length ? stack[stack.length - 1] : null;
        const from = source && source.view === 'pending' ? pending
            : source && source.view === 'moduleCodes' ? scan.codes.filter((c) => c.module === moduleFilter)
                : stored;
        const at = from.findIndex((c) => c.code === openCode.code && c.component === openCode.component);
        return at >= 0 ? `${at + 1}/${from.length}` : '';
    });
    const scrollHint = $derived(list.length > ROWS ? `${cursor + 1}/${list.length}` : '');

    const TITLES = $derived({
        menu: 'MAIN MENU',
        codes: lex.codes,
        pending: lex.pending,
        systems: lex.systems,
        systemParts: openSystem ? openSystem.short : lex.system,
        part: openPart ? 'PART' : lex.system,
        moduleCodes: moduleFilter || lex.system,
        code: `${lex.code} DETAIL`,
        live: lex.live,
        freeze: lex.frame,
        info: 'VEHICLE INFO',
        monitors: lex.monitors,
    });

    /* Word-wraps the "where" text onto the LCD without breaking words. */
    function wrap(text, width) {
        const words = String(text || '').split(/\s+/);
        const lines = [];
        let line = '';
        for (const word of words) {
            if (!line.length) line = word;
            else if (`${line} ${word}`.length <= width) line += ` ${word}`;
            else { lines.push(line); line = word; }
        }
        if (line.length) lines.push(line);
        return lines;
    }
</script>

{#snippet screen()}
    <!-- The glass is part of the screen, not the case: the chassis provides the
         bezel around it and the --lcd-* tokens that tint it. -->
    <div class="glass">
                    {#if view === 'boot'}
                        <div class="boot">
                            {#each bootLines as line}<div class="line">{line}</div>{/each}
                            <div class="line caret">_</div>
                        </div>

                    {:else if view === 'link'}
                        <div class="statusbar"><span>LINK</span><span class="spacer"></span><span>OK</span></div>
                        <div class="kv"><span>PROTOCOL</span><b>{clip(scan.protocol, 22)}</b></div>
                        <div class="kv"><span>VIN</span><b>{scan.vin}</b></div>
                        <div class="kv"><span>PLATE</span><b>{scan.plate}</b></div>
                        <div class="kv"><span>{lex.lamp}</span><b class:alarm={scan.mil}>{scan.mil ? 'ON' : 'OFF'}</b></div>
                        <div class="kv"><span>FAULTS</span><b>{scan.counts.stored} ACTIVE / {scan.counts.pending} PENDING</b></div>
                        <div class="hint blink">PRESS ENTER</div>

                    {:else if view === 'part' && openPart}
                        <div class="statusbar">
                            <span>{clip(openPart.label, 24)}</span>
                            <span class="spacer"></span>
                            <span class:alarm={openPart.status === 'fault'}>
                                {openPart.status === 'fault' ? 'FAULT' : openPart.status === 'pending' ? 'PENDING' : 'NO FAULT'}
                            </span>
                        </div>
                        {#if openSystem}
                            <div class="kv"><span>{lex.system}</span><b>{clip(openSystem.label, 27)}</b></div>
                        {/if}
                        {#if openPart.location}
                            <div class="kv"><span>AT</span><b>{clip(openPart.location, 27)}</b></div>
                        {/if}
                        <div class="kv where"><span>WHERE</span><b>
                            {#each wrap(openPart.where, 27) as line}<div>{line}</div>{/each}
                        </b></div>
                        <div class="rule"></div>

                        {#if !openPart.codes.length}
                            <div class="centre dim">NO {lex.code}S STORED</div>
                        {:else}
                            {#each openPart.codes as code, index}
                                <div class="row" class:active={index === cursor}>
                                    <span class="marker">{index === cursor ? '>' : ' '}</span>
                                    <span class="code">{clip(code.code, 14)}</span>
                                    <span class="text">{clip(code.desc, 22)}</span>
                                    <span class="tail sev {code.severity}">{code.status === 'stored' ? 'S' : 'P'}</span>
                                </div>
                            {/each}
                            <div class="hint">[ENTER] OPEN {lex.code} &nbsp; [BACK]</div>
                        {/if}

                    {:else if view === 'code' && openCode}
                        <div class="statusbar">
                            <span>{openCode.code}</span>
                            <span class="index">{codeIndex}</span>
                            <span class="spacer"></span>
                            <span class:alarm={openCode.status === 'stored'}>{openCode.status.toUpperCase()}</span>
                        </div>
                        <div class="desc">{openCode.desc}</div>
                        <div class="rule"></div>
                        <div class="kv"><span>{lex.system}</span><b>{clip(openCode.moduleLabel, 27)}</b></div>
                        <div class="kv"><span>PART</span><b>{clip(openCode.componentLabel, 27)}</b></div>
                        {#if openCode.location}
                            <div class="kv"><span>AT</span><b>{clip(openCode.location, 27)}</b></div>
                        {/if}
                        <div class="kv"><span>SEVERITY</span><b class:alarm={openCode.severity === 'high'}>
                            {openCode.severity.toUpperCase()}
                        </b></div>
                        <div class="rule"></div>
                        <div class="kv where"><span>WHERE</span><b>
                            {#each wrap(openCode.where, 27) as line}<div>{line}</div>{/each}
                        </b></div>
                        <div class="hint">[ENTER] {lex.frame} &nbsp; [BACK]</div>

                    {:else if view === 'info'}
                        <div class="statusbar"><span>VEHICLE</span><span class="spacer"></span><span>{scan.blueprintLabel}</span></div>
                        <div class="kv"><span>VIN</span><b>{scan.vin}</b></div>
                        <div class="kv"><span>PLATE</span><b>{scan.plate}</b></div>
                        <div class="kv"><span>PROTOCOL</span><b>{clip(scan.protocol, 22)}</b></div>
                        <div class="kv"><span>CAL ID</span><b>{scan.calibration}</b></div>
                        <div class="kv"><span>ODOMETER</span><b>{scan.odometer.toLocaleString('en-US')} km</b></div>
                        <div class="kv"><span>MIL</span><b class:alarm={scan.mil}>{scan.mil ? 'ON' : 'OFF'}</b></div>

                    {:else}
                        <div class="statusbar">
                            <span>{TITLES[view] || ''}</span>
                            <span class="spacer"></span>
                            <span>{scrollHint}</span>
                        </div>

                        {#if !list.length}
                            <div class="centre dim">
                                {view === 'pending' ? `NO ${lex.pending}` : view === 'codes' ? `NO ${lex.codes}` : 'NO DATA'}
                            </div>
                        {/if}

                        {#each window7 as row, index}
                            {@const active = top + index === cursor}
                            <div class="row" class:active>
                                <span class="marker">{active ? '>' : ' '}</span>

                                {#if view === 'menu'}
                                    <span class="num">{top + index + 1}</span>
                                    <span class="text">{row.label}</span>
                                    <span class="tail">{menuCounts[row.id] ?? ''}</span>

                                {:else if view === 'codes' || view === 'pending' || view === 'moduleCodes'}
                                    <span class="code">{clip(row.code, 14)}</span>
                                    <span class="text">{clip(row.desc, 20)}</span>
                                    <span class="tail sev {row.severity}">{row.severity === 'high' ? '!!' : row.severity === 'medium' ? '!' : ''}</span>

                                {:else if view === 'systems'}
                                    <span class="code">{row.short}</span>
                                    <span class="text">{clip(row.label, 25)}</span>
                                    <span class="tail" class:alarm={row.stored > 0}>
                                        {row.stored || row.pending ? `${row.stored}S ${row.pending}P` : 'OK'}
                                    </span>

                                {:else if view === 'systemParts'}
                                    <span class="text">{clip(row.label, 30)}</span>
                                    <span
                                        class="tail"
                                        class:alarm={row.status === 'fault'}
                                        class:warn={row.status === 'pending'}
                                    >{row.status === 'fault' ? 'FAULT' : row.status === 'pending' ? 'PEND' : 'OK'}</span>

                                {:else if view === 'live'}
                                    <span class="text">{clip(row.label, 24)}</span>
                                    <span class="tail" class:alarm={!row.ok}>{row.value}{row.unit}</span>

                                {:else if view === 'monitors'}
                                    <span class="code">{row.id}</span>
                                    <span class="text">{clip(row.label, 20)}</span>
                                    <span class="tail" class:alarm={row.state === 'failed'}>{row.state.toUpperCase()}</span>

                                {:else if view === 'freeze'}
                                    <span class="text">{clip(row.label, 24)}</span>
                                    <span class="tail">{row.value}{row.unit}</span>
                                {/if}
                            </div>
                        {/each}
                    {/if}

                    {#if status}<div class="toast">{status}</div>{/if}
    </div>
{/snippet}

<div class="overlay">
    <!--
        One firmware, three instruments. The chassis owns the case, the bezel and
        the buttons; the screen snippet above is the same code on all three, so a
        change to the firmware lands on every device at once.
    -->
    <svelte:component
        this={chassis}
        {screen} {press} {pressed} {device} {lex} {scan} {softKeys} {lamps} {view}
    />
</div>

<style>
    /*
     * Only the screen is styled here. The case, bezel and buttons belong to the
     * chassis components, which also set the --lcd-* tokens below - that is how
     * one firmware renders on a cheap car reader, a flight-line test set and a
     * sealed marine box without the markup knowing which it is on.
     */
    .glass {
        position: relative;
        height: var(--lcd-height, 232px);
        font-family: var(--mono);
        font-size: var(--lcd-size, 12px);
        line-height: 1.55;
        color: var(--lcd-ink, #8fe3ff);
        text-shadow: 0 0 6px var(--lcd-glow, rgba(30, 166, 240, 0.55));
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .statusbar {
        display: flex; gap: 8px;
        border-bottom: 1px solid var(--lcd-rule, rgba(30, 166, 240, 0.32));
        padding-bottom: 4px; margin-bottom: 5px;
        color: var(--lcd-accent, #1ea6f0);
        letter-spacing: 0.08em;
        font-size: calc(var(--lcd-size, 12px) - 1px);
    }
    .statusbar .index { color: var(--lcd-faint, #5d80a0); letter-spacing: 0.04em; }

    .row { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; padding: 0 2px; }
    .row.active { background: var(--lcd-select, rgba(30, 166, 240, 0.20)); color: var(--lcd-bright, #eafaff); border-radius: 2px; }
    .marker { width: 8px; color: var(--lcd-accent, #1ea6f0); }
    .num { width: 12px; color: var(--lcd-faint, #5d80a0); }
    .code { min-width: 80px; color: var(--lcd-accent, #1ea6f0); }
    .text { flex: 1; overflow: hidden; }
    .tail { color: var(--lcd-bright, #cfefff); }
    .tail.alarm, .alarm { color: var(--lcd-alarm, #ff8f6b); }
    .tail.warn { color: var(--lcd-warn, #ffd23f); }
    .sev.high { color: var(--lcd-alarm, #ff8f6b); }
    .sev.medium { color: var(--lcd-warn, #ffd23f); }

    .kv { display: flex; gap: 8px; padding: 1px 2px; }
    .kv span { width: 68px; color: var(--lcd-faint, #5d80a0); flex: none; }
    .kv b { font-weight: 400; color: var(--lcd-bright, #cfefff); }
    .kv.where { align-items: flex-start; }
    .kv.where b div { line-height: 1.45; }

    .desc { padding: 3px 2px; color: var(--lcd-bright, #cfefff); white-space: normal; line-height: 1.5; }
    .desc.dim { color: var(--lcd-faint, #6f9cba); font-size: calc(var(--lcd-size, 12px) - 1px); }
    .rule { border-top: 1px dashed var(--lcd-rule, rgba(30, 166, 240, 0.3)); margin: 5px 0; }
    .centre { text-align: center; margin: auto 0; font-size: calc(var(--lcd-size, 12px) + 2px); letter-spacing: 0.08em; }
    .hint { margin-top: auto; text-align: center; color: var(--lcd-faint, #5d80a0); font-size: 10px; letter-spacing: 0.1em; }

    .boot .line { letter-spacing: 0.06em; }
    .caret { animation: blink 1s steps(1) infinite; }
    .blink { animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0.25; } }

    .toast {
        position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
        background: var(--lcd-select, rgba(30, 166, 240, 0.2));
        border: 1px solid var(--lcd-accent, #1ea6f0);
        border-radius: 3px; padding: 2px 10px;
        font-size: 10px; letter-spacing: 0.1em; color: var(--lcd-bright, #eafaff);
    }
</style>
