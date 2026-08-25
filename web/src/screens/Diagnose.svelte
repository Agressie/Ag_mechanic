<script>
    /*
     * The diagnose minigame.
     *
     * Two stages, both about not breaking things:
     *   bolts  build torque and stop inside the band. Overshoot and you round
     *          the head off; stop short and it has not moved yet.
     *   lines  hold the release tab down, then draw the connector out at a
     *          steady speed. Snatch it and the tab snaps.
     *
     * The score is the only thing that leaves this component - the server turns
     * it into how much of the report the player gets to read.
     */
    import { sendResult, close } from '../lib/nui.js';

    let { payload = {} } = $props();

    const boltCount = $derived(Math.max(1, Number(payload.bolts) || 3));
    const lineCount = $derived(Math.max(1, Number(payload.lines) || 1));
    const skilled = $derived(!!payload.skilled);

    let stage = $state('intro');       // intro | bolts | lines | done
    let message = $state('');
    let flash = $state('');            // ok | bad

    /* --- bolt stage ---------------------------------------------------- */
    let boltIndex = $state(0);
    let torque = $state(0);
    let holding = $state(false);
    let boltScores = $state([]);
    let attempts = $state(0);
    let band = $state({ start: 0.55, end: 0.78 });
    let boltDeadline = 0;

    /* --- line stage ---------------------------------------------------- */
    let lineIndex = $state(0);
    let tabHeld = $state(false);
    let pull = $state(0);
    let pullSpeed = $state(0);
    let lineScores = $state([]);
    let linePenalties = $state(0);
    let dragging = $state(false);
    let lastPointerX = 0;

    const totalSteps = $derived(boltCount + lineCount);
    let stepsDone = $derived(boltScores.length + lineScores.length);

    /* Bands narrow and the needle climbs faster as you work along the bolts.
       A mechanic gets a slightly kinder window than a driver guessing. */
    function bandFor(index) {
        const width = (skilled ? 0.20 : 0.15) - index * 0.022;
        const start = 0.42 + index * 0.055;
        return { start, end: start + Math.max(0.075, width) };
    }

    function riseSpeed(index) {
        return (skilled ? 0.62 : 0.74) + index * 0.14;
    }

    const maxPullSpeed = $derived(skilled ? 0.036 : 0.028);

    function beginBolts() {
        stage = 'bolts';
        boltIndex = 0;
        boltScores = [];
        startBolt();
    }

    function startBolt() {
        torque = 0;
        holding = false;
        attempts = 0;
        band = bandFor(boltIndex);
        boltDeadline = performance.now() + 9000;
        message = 'Hold SPACE to load the breaker bar. Let go inside the band.';
    }

    function finishBolt(score, note, good) {
        boltScores = [...boltScores, Math.max(0, Math.min(1, score))];
        message = note;
        flash = good ? 'ok' : 'bad';
        setTimeout(() => { flash = ''; }, 320);

        boltIndex += 1;
        if (boltIndex >= boltCount) {
            setTimeout(beginLines, 950);
        } else {
            setTimeout(startBolt, 950);
        }
    }

    function releaseBolt() {
        if (stage !== 'bolts' || !holding) return;
        holding = false;

        const penalty = attempts * 0.18;

        if (torque > band.end + 0.06) {
            finishBolt(0.12 - penalty, 'You rounded the head off. That is going to be fun for somebody.', false);
            return;
        }
        if (torque > band.end) {
            finishBolt(0.5 - penalty, 'Over-torqued, but it moved.', false);
            return;
        }
        if (torque < band.start) {
            attempts += 1;
            torque = 0;
            if (attempts >= 3) {
                finishBolt(0.2, 'Three goes and it still has not shifted. Moving on.', false);
                return;
            }
            message = 'Not enough on it. Again.';
            return;
        }

        const centre = (band.start + band.end) / 2;
        const offset = Math.abs(torque - centre) / ((band.end - band.start) / 2);
        finishBolt(1 - offset * 0.28 - penalty, 'Clean. Bolt out.', true);
    }

    function beginLines() {
        stage = 'lines';
        lineIndex = 0;
        lineScores = [];
        startLine();
    }

    function startLine() {
        pull = 0;
        pullSpeed = 0;
        tabHeld = false;
        dragging = false;
        linePenalties = 0;
        message = 'Hold SHIFT to press the release tab, then drag the connector out.';
    }

    function finishLine(score, note, good) {
        lineScores = [...lineScores, Math.max(0, Math.min(1, score))];
        message = note;
        flash = good ? 'ok' : 'bad';
        setTimeout(() => { flash = ''; }, 320);

        lineIndex += 1;
        if (lineIndex >= lineCount) {
            setTimeout(complete, 700);
        } else {
            setTimeout(startLine, 950);
        }
    }

    function complete() {
        stage = 'done';
        const boltAverage = boltScores.length ? boltScores.reduce((a, b) => a + b, 0) / boltScores.length : 0;
        const lineAverage = lineScores.length ? lineScores.reduce((a, b) => a + b, 0) / lineScores.length : 0;
        const score = boltAverage * 0.55 + lineAverage * 0.45;

        message = score > 0.8 ? 'Textbook.' : score > 0.55 ? 'Good enough to read something off it.' : 'Messy. The numbers will be vague.';
        setTimeout(() => sendResult({ score, cancelled: false }), 900);
    }

    function abandon() {
        sendResult({ cancelled: true });
        close();
    }

    /* --- input -------------------------------------------------------- */

    function onKeyDown(event) {
        if (event.repeat) return;

        if (event.code === 'Escape') {
            abandon();
            return;
        }
        if (stage === 'intro' && (event.code === 'Space' || event.code === 'Enter')) {
            event.preventDefault();
            beginBolts();
            return;
        }
        if (stage === 'bolts' && event.code === 'Space') {
            event.preventDefault();
            holding = true;
            return;
        }
        if (stage === 'lines' && (event.code === 'ShiftLeft' || event.code === 'ShiftRight')) {
            tabHeld = true;
        }
    }

    function onKeyUp(event) {
        if (stage === 'bolts' && event.code === 'Space') {
            releaseBolt();
            return;
        }
        if (stage === 'lines' && (event.code === 'ShiftLeft' || event.code === 'ShiftRight')) {
            tabHeld = false;
            if (pull > 0.05 && pull < 1) {
                linePenalties += 1;
                pull = 0;
                dragging = false;
                if (linePenalties >= 3) {
                    finishLine(0.15, 'The connector kept re-seating. You have mangled the tab.', false);
                } else {
                    message = 'Tab sprang back and it clicked home again. Keep SHIFT down.';
                }
            }
        }
    }

    function onPointerDown(event) {
        if (stage !== 'lines') return;
        dragging = true;
        lastPointerX = event.clientX;
    }

    function onPointerMove(event) {
        if (stage !== 'lines' || !dragging) return;

        const delta = event.clientX - lastPointerX;
        lastPointerX = event.clientX;
        if (delta === 0) return;

        if (!tabHeld) {
            message = 'The tab is still locked. Hold SHIFT.';
            return;
        }

        const step = delta / 320;
        pullSpeed = Math.abs(step);

        if (step > maxPullSpeed) {
            linePenalties += 1;
            pull = 0;
            dragging = false;
            if (linePenalties >= 3) {
                finishLine(0.1, 'You snapped the tab clean off.', false);
            } else {
                message = 'Too quick - it jammed. Ease it out.';
            }
            return;
        }

        pull = Math.max(0, Math.min(1, pull + step));

        if (pull >= 1) {
            dragging = false;
            finishLine(1 - linePenalties * 0.28, 'Connector free, tab intact.', true);
        }
    }

    function onPointerUp() {
        dragging = false;
        pullSpeed = 0;
    }

    /* --- animation loop ----------------------------------------------- */

    $effect(() => {
        let frame;
        let previous = performance.now();

        const loop = (now) => {
            const dt = Math.min(0.05, (now - previous) / 1000);
            previous = now;

            if (stage === 'bolts') {
                if (holding) {
                    torque = Math.min(1, torque + riseSpeed(boltIndex) * dt);
                    if (torque >= 1) {
                        holding = false;
                        finishBolt(0.05, 'Snapped the bolt. Well done.', false);
                    }
                } else if (torque > 0) {
                    torque = Math.max(0, torque - 1.6 * dt);
                }

                if (now > boltDeadline && boltScores.length === boltIndex) {
                    boltDeadline = Infinity;
                    finishBolt(0.25, 'Took too long. Next one.', false);
                }
            }

            if (stage === 'lines' && !dragging) {
                pullSpeed = Math.max(0, pullSpeed - dt * 0.4);
            }

            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    });

    $effect(() => {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('pointerup', onPointerUp);
        };
    });

    const speedState = $derived(
        pullSpeed === 0 ? 'idle' : pullSpeed > maxPullSpeed * 0.82 ? 'fast' : 'good',
    );
</script>

<div class="overlay">
    <div class="panel card" class:flash-ok={flash === 'ok'} class:flash-bad={flash === 'bad'}>
        <header>
            <div>
                <div class="eyebrow">Diagnostics</div>
                <h1>{payload.blueprintLabel || 'Vehicle'} inspection</h1>
            </div>
            <div class="steps mono">{stepsDone} / {totalSteps}</div>
        </header>

        <div class="track"><div class="fill" style="width:{(stepsDone / totalSteps) * 100}%"></div></div>

        {#if stage === 'intro'}
            <div class="body intro">
                <p>
                    {boltCount} bolt{boltCount === 1 ? '' : 's'} to back off and
                    {lineCount} connector{lineCount === 1 ? '' : 's'} to unplug.
                    Do it cleanly and the readings will be worth having.
                </p>
                <ul>
                    <li><kbd>SPACE</kbd> loads the breaker bar. Release inside the green band.</li>
                    <li><kbd>SHIFT</kbd> presses the release tab. Drag the connector out slowly.</li>
                    <li><kbd>ESC</kbd> walks away.</li>
                </ul>
                <button class="primary" onclick={beginBolts}>Start</button>
            </div>

        {:else if stage === 'bolts'}
            <div class="body">
                <div class="stage-label">Bolt {boltIndex + 1} of {boltCount}{attempts ? ` - attempt ${attempts + 1}` : ''}</div>

                <div class="gauge">
                    <div class="gauge-band" style="left:{band.start * 100}%; width:{(band.end - band.start) * 100}%"></div>
                    <div class="gauge-danger" style="left:{band.end * 100}%"></div>
                    <div class="gauge-needle" style="left:{torque * 100}%"></div>
                    <div class="gauge-fill" style="width:{torque * 100}%"></div>
                </div>

                <div class="readout row">
                    <span class="eyebrow">Torque</span>
                    <span class="mono value">{Math.round(torque * 140)} Nm</span>
                    <span class="spacer"></span>
                    <span class="eyebrow">Target</span>
                    <span class="mono value">{Math.round(band.start * 140)}-{Math.round(band.end * 140)} Nm</span>
                </div>

                <div class="bolt-row">
                    {#each Array(boltCount) as _, index}
                        <div
                            class="bolt"
                            class:done={index < boltScores.length}
                            class:poor={boltScores[index] !== undefined && boltScores[index] < 0.4}
                            class:active={index === boltIndex}
                        >⬢</div>
                    {/each}
                </div>
            </div>

        {:else if stage === 'lines'}
            <div class="body">
                <div class="stage-label">Connector {lineIndex + 1} of {lineCount}</div>

                <div
                    class="harness"
                    onpointerdown={onPointerDown}
                    onpointermove={onPointerMove}
                    role="slider"
                    tabindex="0"
                    aria-valuenow={Math.round(pull * 100)}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Connector"
                >
                    <div class="socket">
                        <span class="tab" class:pressed={tabHeld}></span>
                    </div>
                    <div class="wire"></div>
                    <div class="plug" class:held={tabHeld} style="left:calc(46px + {pull} * (100% - 126px))">
                        <span></span><span></span><span></span>
                    </div>
                    <span class="pull-hint" class:hidden={pull > 0.02}>drag this way →</span>
                </div>

                <div class="readout row">
                    <span class="eyebrow">Tab</span>
                    <span class="value" class:ok={tabHeld} class:bad={!tabHeld}>{tabHeld ? 'released' : 'locked'}</span>
                    <span class="spacer"></span>
                    <span class="eyebrow">Pull rate</span>
                    <span class="value speed {speedState}">
                        {speedState === 'idle' ? 'still' : speedState === 'good' ? 'steady' : 'too quick'}
                    </span>
                </div>

                <div class="track thin"><div class="fill" style="width:{pull * 100}%"></div></div>
            </div>

        {:else}
            <div class="body done-body">
                <div class="score mono">{Math.round((boltScores.reduce((a, b) => a + b, 0) / Math.max(1, boltScores.length) * 0.55
                    + lineScores.reduce((a, b) => a + b, 0) / Math.max(1, lineScores.length) * 0.45) * 100)}%</div>
                <div class="eyebrow">Inspection quality</div>
            </div>
        {/if}

        <footer>
            <span class="hint">{message}</span>
            <button class="ghost" onclick={abandon}>Give up</button>
        </footer>
    </div>
</div>

<style>
    .panel {
        width: 640px;
        padding: 22px 24px 16px;
        transition: box-shadow 0.2s ease;
    }
    .panel.flash-ok { box-shadow: var(--shadow), 0 0 0 2px var(--ok) inset; }
    .panel.flash-bad { box-shadow: var(--shadow), 0 0 0 2px var(--danger) inset; }

    header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 12px; }
    h1 { margin: 4px 0 0; font-size: 19px; font-weight: 600; }
    .steps { color: var(--text-dim); font-size: 13px; }

    .track { height: 4px; background: var(--bg); border-radius: 4px; overflow: hidden; }
    .track.thin { margin-top: 14px; }
    .track .fill { height: 100%; background: var(--accent); transition: width 0.12s linear; }

    .body { padding: 20px 0 14px; }
    .stage-label { font-size: 12px; color: var(--text-dim); margin-bottom: 14px; }

    .intro p { margin: 0 0 12px; color: var(--text-dim); line-height: 1.55; }
    .intro ul { margin: 0 0 18px; padding-left: 18px; color: var(--text-dim); line-height: 1.9; font-size: 13px; }
    kbd {
        font-family: var(--mono);
        font-size: 11px;
        background: var(--bg);
        border: 1px solid var(--line-strong);
        border-bottom-width: 2px;
        border-radius: 4px;
        padding: 1px 5px;
        color: var(--text);
    }

    /* --- torque gauge --- */
    .gauge {
        position: relative;
        height: 46px;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        overflow: hidden;
    }
    .gauge-fill { position: absolute; inset: 0 auto 0 0; background: var(--accent-soft); }
    .gauge-band { position: absolute; top: 0; bottom: 0; background: var(--ok-bg); border-left: 1px solid var(--ok); border-right: 1px solid var(--ok); box-shadow: 0 0 14px rgba(46, 230, 168, 0.22) inset; }
    .gauge-danger { position: absolute; top: 0; bottom: 0; right: 0; background: repeating-linear-gradient(45deg, var(--danger-bg) 0 6px, transparent 6px 12px); }
    .gauge-needle { position: absolute; top: -2px; bottom: -2px; width: 3px; background: var(--accent); box-shadow: 0 0 10px var(--accent), 0 0 20px rgba(30, 166, 240, 0.6); transition: left 0.03s linear; }

    .readout { margin-top: 12px; font-size: 12px; }
    .readout .value { color: var(--text); font-size: 13px; }
    .readout .value.ok { color: var(--ok); }
    .readout .value.bad { color: var(--text-faint); }
    .speed.good { color: var(--ok); }
    .speed.fast { color: var(--danger); }
    .speed.idle { color: var(--text-faint); }

    .bolt-row { display: flex; gap: 10px; margin-top: 18px; }
    .bolt { font-size: 22px; color: var(--line-strong); transition: color 0.2s ease, transform 0.2s ease; }
    .bolt.active { color: var(--accent); transform: scale(1.12); }
    .bolt.done { color: var(--ok); }
    .bolt.done.poor { color: var(--danger); }

    /* --- connector harness --- */
    .harness {
        position: relative;
        height: 92px;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        cursor: grab;
        overflow: hidden;
    }
    .harness:active { cursor: grabbing; }
    .socket {
        position: absolute;
        left: 0; top: 26px;
        width: 46px; height: 40px;
        background: var(--bg-panel);
        border: 1px solid var(--line-strong);
        border-left: none;
        border-radius: 0 4px 4px 0;
    }
    .tab {
        position: absolute;
        right: -6px; top: 12px;
        width: 14px; height: 6px;
        background: var(--danger);
        border-radius: 2px;
        transition: transform 0.1s ease, background 0.1s ease;
    }
    .tab.pressed { transform: translateY(4px) scaleY(0.5); background: var(--ok); }
    .wire {
        position: absolute;
        left: 46px; right: 0; top: 45px;
        height: 2px;
        background: repeating-linear-gradient(90deg, var(--line-strong) 0 8px, transparent 8px 14px);
    }
    .plug {
        position: absolute;
        top: 26px;
        left: 46px;
        width: 74px; height: 40px;
        display: flex; align-items: center; justify-content: space-evenly;
        background: var(--bg-panel);
        border: 1px solid var(--line-strong);
        border-radius: 4px;
        transition: border-color 0.12s ease;
    }
    .plug.held { border-color: var(--accent); }
    .pull-hint {
        position: absolute; right: 14px; top: 38px;
        font-size: 11px; color: var(--text-faint);
        transition: opacity 0.2s ease;
    }
    .pull-hint.hidden { opacity: 0; }
    .plug span { width: 6px; height: 16px; background: var(--accent-dim); border-radius: 1px; }

    .done-body { text-align: center; padding: 26px 0 18px; }
    .score { font-size: 46px; font-weight: 600; color: var(--accent); }

    footer {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        border-top: 1px solid var(--line);
        padding-top: 12px;
        min-height: 46px;
    }
    .hint { font-size: 12px; color: var(--text-dim); }
</style>
