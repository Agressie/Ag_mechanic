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

    let { payload = {} } = $props();

    let scan = $state(payload.scan || { codes: [], modules: [], live: [], monitors: [], counts: {} });
    const canErase = $derived(payload.canErase !== false);

    /* The three tools do not use the same words for the same things, so every
       label on the device comes from its own lexicon. */
    const FALLBACK_LEXICON = {
        codes: 'STORED CODES', pending: 'PENDING CODES', systems: 'SYSTEM SCAN',
        system: 'MODULE', code: 'CODE', erase: 'ERASE CODES', lamp: 'MIL',
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
    let eraseHeld = $state(0);
    let erasedCount = $state(0);
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
        { id: 'erase', label: lex.erase },
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
            if (choice.id === 'erase' && !canErase) return beep('ERASE DISABLED');
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

        if (view === 'erased') return go('menu', false);
    }

    function beep(message) {
        status = message;
        setTimeout(() => { if (status === message) status = ''; }, 1600);
    }

    /* --- erase ---------------------------------------------------------- */
    let eraseTimer = null;

    function startErase() {
        if (view !== 'erase' || eraseTimer) return;
        const started = Date.now();
        eraseTimer = setInterval(async () => {
            eraseHeld = Math.min(1, (Date.now() - started) / 3000);
            if (eraseHeld < 1) return;

            stopErase();
            view = 'erasing';
            const result = await vehicleRpc('scanner:erase', {});
            if (result && result.ok) {
                erasedCount = result.cleared;
                scan = result.scan;
                view = 'erased';
            } else {
                view = 'erase';
                beep(result && result.reason === 'noItem' ? 'SCANNER NOT PRESENT' : 'ERASE FAILED');
            }
        }, 50);
    }

    function stopErase() {
        if (eraseTimer) clearInterval(eraseTimer);
        eraseTimer = null;
        eraseHeld = 0;
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
            case 'erase':
                if (!canErase) return beep('ERASE DISABLED');
                return view === 'erase' ? undefined : go('erase');
            default:
                return undefined;
        }
    }

    const KEYS = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        Enter: 'enter', Space: 'enter', Backspace: 'back', Escape: 'back', Delete: 'erase',
    };

    function onKeyDown(event) {
        const button = KEYS[event.code] || KEYS[event.key];
        if (!button) return;
        event.preventDefault();

        if (button === 'enter' && view === 'erase') {
            if (event.repeat) return;
            pressed = 'enter';
            return startErase();
        }
        if (event.repeat && button !== 'up' && button !== 'down') return;
        press(button);
    }

    function onKeyUp(event) {
        const button = KEYS[event.code] || KEYS[event.key];
        if (button === 'enter') {
            pressed = null;
            stopErase();
        }
    }

    $effect(() => {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            stopErase();
        };
    });

    /* --- helpers -------------------------------------------------------- */
    const clip = (text, width) => {
        const value = String(text ?? '');
        return value.length > width ? `${value.slice(0, width - 1)}…` : value;
    };

    const window7 = $derived(list.slice(top, top + ROWS));

    /* The keypad is silkscreened in the device's own language: ERASE on a car
       tool, CLEAR on a BITE set, RESET on a marine reader. */
    const eraseKey = $derived(lex.erase.split(' ')[0]);

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
        erase: lex.erase,
        erasing: 'CLEARING',
        erased: 'DONE',
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

<div class="overlay">
    <div class="device">
        <svg class="cable" viewBox="0 0 260 200" aria-hidden="true">
            <path d="M232 200 C232 120 150 96 96 62 C60 40 42 18 38 -10" />
            <path class="sheen" d="M232 200 C232 120 150 96 96 62 C60 40 42 18 38 -10" />
        </svg>

        <div class="shell">
            <div class="brandbar">
                <span class="brand">{device.model}</span>
                <span class="brand-sub">{device.bus}</span>
                <span class="mil" class:on={scan.mil}>{lex.lamp}</span>
            </div>

            <!-- ---------------------------------------------------- screen -->
            <div class="lcd">
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

                    {:else if view === 'erase'}
                        <div class="statusbar"><span>ERASE</span><span class="spacer"></span><span class="alarm">CAUTION</span></div>
                        <div class="desc">Clears {stored.length} {lex.code.toLowerCase()}{stored.length === 1 ? '' : 's'} and resets the monitors.</div>
                        <div class="desc dim">It does not repair anything. The fault will set again once the vehicle has been driven.</div>
                        <div class="holdbar"><div class="fill" style="width:{eraseHeld * 100}%"></div></div>
                        <div class="hint blink">HOLD ENTER TO CONFIRM</div>

                    {:else if view === 'erasing'}
                        <div class="statusbar"><span>ERASE</span><span class="spacer"></span><span>BUSY</span></div>
                        <div class="centre blink">CLEARING {lex.code}S...</div>

                    {:else if view === 'erased'}
                        <div class="statusbar"><span>ERASE</span><span class="spacer"></span><span>DONE</span></div>
                        <div class="centre">{erasedCount} {lex.code}{erasedCount === 1 ? '' : 'S'} CLEARED</div>
                        <div class="desc dim">Monitors reset. Faults will re-confirm once it has been used again.</div>
                        <div class="hint">[ENTER] MAIN MENU</div>

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
                <div class="scanlines"></div>
            </div>

            <!-- --------------------------------------------------- buttons -->
            <div class="keypad">
                <div class="side">
                    <button class="key wide" class:held={pressed === 'back'} onclick={() => press('back')}>BACK</button>
                    <button class="key wide danger" class:held={pressed === 'erase'} onclick={() => press('erase')}>{eraseKey}</button>
                </div>

                <div class="dpad">
                    <button class="key arrow up" class:held={pressed === 'up'} onclick={() => press('up')} aria-label="Up">▲</button>
                    <button class="key arrow left" class:held={pressed === 'left'} onclick={() => press('left')} aria-label="Page up">◀</button>
                    <button
                        class="key enter" class:held={pressed === 'enter'}
                        onclick={() => press('enter')}
                        onpointerdown={() => { if (view === 'erase') { pressed = 'enter'; startErase(); } }}
                        onpointerup={stopErase}
                        onpointerleave={stopErase}
                    >ENTER</button>
                    <button class="key arrow right" class:held={pressed === 'right'} onclick={() => press('right')} aria-label="Page down">▶</button>
                    <button class="key arrow down" class:held={pressed === 'down'} onclick={() => press('down')} aria-label="Down">▼</button>
                </div>

                <div class="side">
                    <button class="key wide" onclick={() => go('info')}>INFO</button>
                    <button class="key wide" onclick={close}>UNPLUG</button>
                </div>
            </div>

            <div class="footer">
                <span class="port"></span>
                <span class="footnote">ARROWS MOVE &middot; ENTER SELECTS &middot; BACK RETURNS</span>
            </div>
        </div>
    </div>
</div>

<style>
    .device { position: relative; }

    /* Cable running off the top of the frame, towards the OBD port. */
    .cable {
        position: absolute;
        left: -80px; top: -186px;
        width: 260px; height: 200px;
        pointer-events: none;
        overflow: visible;
    }
    .cable path {
        fill: none;
        stroke: #0b1a2b;
        stroke-width: 11;
        stroke-linecap: round;
    }
    .cable path.sheen {
        stroke: rgba(30, 166, 240, 0.22);
        stroke-width: 3;
        transform: translateX(-2.5px);
    }

    .shell {
        position: relative;
        width: 470px;
        padding: 16px 18px 14px;
        border-radius: 26px;
        background: linear-gradient(165deg, #0d1e33 0%, #061020 55%, #030a14 100%);
        border: 1px solid var(--line-strong);
        box-shadow: var(--shadow), var(--glow), inset 0 1px 0 rgba(30, 166, 240, 0.18);
    }

    .brandbar { display: flex; align-items: center; gap: 10px; padding: 0 4px 12px; }
    .brand { font-family: var(--mono); font-size: 15px; font-weight: 700; letter-spacing: 0.06em; color: var(--text); }
    .brand-num { color: var(--accent); }
    .brand-sub { font-size: 9px; letter-spacing: 0.14em; color: var(--text-faint); flex: 1; }
    .mil {
        font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
        border: 1px solid var(--line); border-radius: 3px; padding: 2px 6px;
        color: var(--text-faint);
    }
    .mil.on {
        color: #ffb454; border-color: #7a5518; background: rgba(255, 180, 84, 0.12);
        box-shadow: 0 0 12px rgba(255, 180, 84, 0.35);
    }

    /* --- the screen --- */
    .lcd {
        position: relative;
        border-radius: 8px;
        padding: 10px 12px;
        background: #020a12;
        border: 1px solid rgba(30, 166, 240, 0.35);
        box-shadow: inset 0 0 30px rgba(30, 166, 240, 0.12), 0 0 22px rgba(30, 166, 240, 0.10);
        overflow: hidden;
    }
    .glass {
        position: relative;
        height: 232px;
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.55;
        color: #8fe3ff;
        text-shadow: 0 0 6px rgba(30, 166, 240, 0.55);
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    /* Faint horizontal banding, the way a backlit character display looks. */
    .scanlines {
        position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px);
        mix-blend-mode: multiply;
    }

    .statusbar .index { color: var(--text-faint); letter-spacing: 0.04em; }
    .statusbar {
        display: flex; gap: 8px;
        border-bottom: 1px solid rgba(30, 166, 240, 0.32);
        padding-bottom: 4px; margin-bottom: 5px;
        color: var(--accent); letter-spacing: 0.08em; font-size: 11px;
    }

    .row { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; padding: 0 2px; }
    .row.active { background: rgba(30, 166, 240, 0.20); color: #eafaff; border-radius: 2px; }
    .marker { width: 8px; color: var(--accent); }
    .num { width: 12px; color: var(--text-faint); }
    .code { min-width: 80px; color: var(--accent); }
    .text { flex: 1; overflow: hidden; }
    .tail { color: #cfefff; }
    .tail.alarm, .alarm { color: #ff8f6b; }
    .tail.warn { color: #ffd23f; }
    .sev.high { color: #ff8f6b; }
    .sev.medium { color: #ffd23f; }

    .kv { display: flex; gap: 8px; padding: 1px 2px; }
    .kv span { width: 68px; color: var(--text-faint); flex: none; }
    .kv b { font-weight: 400; color: #cfefff; }
    .kv.where { align-items: flex-start; }
    .kv.where b div { line-height: 1.45; }

    .desc { padding: 3px 2px; color: #cfefff; white-space: normal; line-height: 1.5; }
    .desc.dim { color: #6f9cba; font-size: 11px; }
    .rule { border-top: 1px dashed rgba(30, 166, 240, 0.3); margin: 5px 0; }
    .centre { text-align: center; margin: auto 0; font-size: 14px; letter-spacing: 0.08em; }
    .hint { margin-top: auto; text-align: center; color: var(--text-faint); font-size: 10px; letter-spacing: 0.1em; }
    .boot .line { letter-spacing: 0.06em; }
    .caret { animation: blink 1s steps(1) infinite; }
    .blink { animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0.25; } }

    .holdbar { height: 8px; margin: 10px 2px 6px; background: rgba(30, 166, 240, 0.12); border-radius: 4px; overflow: hidden; }
    .holdbar .fill { height: 100%; background: #ff8f6b; box-shadow: 0 0 12px rgba(255, 143, 107, 0.7); }

    .toast {
        position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
        background: rgba(30, 166, 240, 0.2); border: 1px solid var(--accent);
        border-radius: 3px; padding: 2px 10px; font-size: 10px; letter-spacing: 0.1em; color: #eafaff;
    }

    /* --- the keypad --- */
    .keypad { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; margin-top: 16px; }
    .side { display: flex; flex-direction: column; gap: 9px; }

    .key {
        font-family: var(--mono);
        font-size: 11px;
        letter-spacing: 0.08em;
        color: #d6ecfa;
        background: linear-gradient(180deg, #16304c 0%, #0b1c30 100%);
        border: 1px solid rgba(30, 166, 240, 0.30);
        border-bottom-color: rgba(0, 0, 0, 0.6);
        border-radius: 7px;
        padding: 10px 12px;
        box-shadow: 0 3px 0 rgba(2, 8, 16, 0.85), inset 0 1px 0 rgba(140, 210, 255, 0.14);
        transition: transform 0.06s ease, box-shadow 0.06s ease, background 0.12s ease;
    }
    .key:hover { background: linear-gradient(180deg, #1c3d61 0%, #0e2540 100%); box-shadow: 0 3px 0 rgba(2, 8, 16, 0.85), 0 0 14px rgba(30, 166, 240, 0.28); }
    /* Physical travel: the button actually goes down. */
    .key:active, .key.held {
        transform: translateY(3px);
        box-shadow: 0 0 0 rgba(2, 8, 16, 0.85), inset 0 2px 6px rgba(0, 0, 0, 0.6);
        background: linear-gradient(180deg, #0c1e33 0%, #081524 100%);
        color: var(--accent);
    }
    .key.wide { width: 100%; }
    .key.danger { color: #ffb0a0; border-color: rgba(255, 107, 107, 0.35); }
    .key.danger:hover { box-shadow: 0 3px 0 rgba(2, 8, 16, 0.85), 0 0 14px rgba(255, 107, 107, 0.3); }

    .dpad {
        display: grid;
        grid-template-columns: repeat(3, 44px);
        grid-template-rows: repeat(3, 40px);
        gap: 5px;
    }
    .key.arrow { padding: 0; font-size: 13px; display: grid; place-items: center; }
    .arrow.up { grid-area: 1 / 2; }
    .arrow.left { grid-area: 2 / 1; }
    .arrow.right { grid-area: 2 / 3; }
    .arrow.down { grid-area: 3 / 2; }
    .key.enter {
        grid-area: 2 / 2;
        padding: 0;
        font-size: 10px;
        border-radius: 50%;
        color: #02121f;
        background: linear-gradient(180deg, var(--accent) 0%, var(--accent-deep) 100%);
        border-color: var(--accent);
        box-shadow: 0 3px 0 rgba(2, 8, 16, 0.85), var(--glow);
    }
    .key.enter:hover { background: linear-gradient(180deg, #47bcff 0%, #1470cc 100%); }
    .key.enter:active, .key.enter.held {
        transform: translateY(3px);
        background: linear-gradient(180deg, #1470cc 0%, #0b4f92 100%);
        color: #02121f;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.5);
    }

    .footer { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 0 4px; }
    .port { width: 44px; height: 6px; border-radius: 3px; background: #071626; box-shadow: inset 0 0 0 1px rgba(30, 166, 240, 0.2); }
    .footnote { font-size: 9px; letter-spacing: 0.1em; color: var(--text-faint); }
</style>
