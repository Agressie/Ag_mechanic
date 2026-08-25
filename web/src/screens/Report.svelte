<script>
    /*
     * The diagnostic report, and the place repairs are started from.
     *
     * What the reader sees is entirely the server's decision - an exact figure,
     * a band, or nothing at all - so this component never infers a number it was
     * not given.
     */
    import { untrack } from 'svelte';
    import { clientAction, close } from '../lib/nui.js';
    import ConditionBar from '../lib/ConditionBar.svelte';

    let { payload = {} } = $props();

    const report = $derived(payload.report || { groups: [], symptoms: [], triage: { mobile: [], garage: [] } });
    const isMechanic = $derived(!!payload.isMechanic);

    /* Initial tab only - untrack makes it explicit that later payload changes
       should not yank the tab out from under the reader. */
    let filter = $state(untrack(() => payload.focus) === 'field' ? 'field' : 'attention');

    const QUALITY = {
        perfect: { label: 'Full read', tone: 'ok', note: 'Every sensor answered.' },
        good: { label: 'Good read', tone: 'ok', note: 'Faults are exact; healthy parts are estimates.' },
        partial: { label: 'Partial read', tone: 'warn', note: 'Estimates only, and some parts would not answer.' },
        vague: { label: 'Poor read', tone: 'bad', note: 'Only the obvious faults came through.' },
    };

    const quality = $derived(QUALITY[report.quality] || QUALITY.vague);

    const rows = $derived(
        report.groups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label }))),
    );

    const visible = $derived(
        filter === 'all' ? rows
            : filter === 'field' ? rows.filter((r) => r.field)
                : rows.filter((r) => r.required || r.dead),
    );

    const grouped = $derived(
        report.groups
            .map((group) => ({
                label: group.label,
                items: group.items.filter((item) => visible.some((v) => v.id === item.id)),
            }))
            .filter((group) => group.items.length),
    );

    const counts = $derived({
        all: rows.length,
        attention: rows.filter((r) => r.required || r.dead).length,
        field: rows.filter((r) => r.field).length,
    });

    function repair(item, mode) {
        clientAction('repair', { component: item.id, mode, label: item.label, group: item.group });
    }

    function service() {
        clientAction('service', {});
    }

    /* Which buttons make sense for this row, given who is reading it. */
    function actions(item) {
        const out = [];
        if (item.field) {
            out.push({ mode: 'field', label: 'Tape it up', hint: 'Improvised, 40% at best', kind: 'ghost' });
        }
        if (isMechanic && item.method === 'mobile') {
            out.push({ mode: 'mobile', label: item.partLabel ? `Fit ${item.partLabel}` : 'Repair', hint: null, kind: 'primary' });
        }
        if (isMechanic && item.method === 'garage') {
            out.push({ mode: 'workshop', label: item.partLabel ? `Replace ${item.partLabel}` : 'Rebuild', hint: 'Needs a lift', kind: 'primary' });
        }
        return out;
    }
</script>

<div class="overlay">
    <div class="sheet card">
        <header>
            <div class="col">
                <div class="eyebrow">Diagnostic report</div>
                <h1>{report.blueprintLabel || 'Vehicle'} <span class="plate mono">{report.plate}</span></h1>
                <div class="sub dim">
                    {report.odometer ? `${report.odometer.toLocaleString('en-US')} km` : 'mileage unknown'}
                    &middot; <span class={quality.tone}>{quality.label}</span>
                    &middot; {quality.note}
                </div>
            </div>
            <div class="overall">
                {#if report.overall !== null && report.overall !== undefined}
                    <div class="overall-value mono" style="color:var(--band-{report.overallBand})">{Math.round(report.overall)}%</div>
                {:else}
                    <div class="overall-value mono" style="color:var(--band-{report.overallBand})">
                        {(report.overallBand || 'unknown').replace(/^\w/, (c) => c.toUpperCase())}
                    </div>
                {/if}
                <div class="eyebrow">Overall</div>
            </div>
        </header>

        <div class="summary" class:tow={report.triage.tow}>
            <strong>{report.summary}</strong>
            {#if report.triage.tow}
                <span class="dim">
                    {report.triage.garage.length}
                    {report.triage.garage.length === 1 ? 'item needs' : 'items need'} a workshop lift.
                </span>
            {/if}
        </div>

        {#if report.symptoms && report.symptoms.length}
            <div class="symptoms">
                <span class="eyebrow">Recent history</span>
                {#each report.symptoms as symptom}
                    <span class="chip">{symptom.label}{symptom.count > 1 ? ` ×${symptom.count}` : ''}</span>
                {/each}
            </div>
        {/if}

        <nav class="filters">
            <button class:active={filter === 'attention'} onclick={() => (filter = 'attention')}>
                Needs work <span class="count">{counts.attention}</span>
            </button>
            <button class:active={filter === 'field'} onclick={() => (filter = 'field')}>
                Can be bodged <span class="count">{counts.field}</span>
            </button>
            <button class:active={filter === 'all'} onclick={() => (filter = 'all')}>
                Everything <span class="count">{counts.all}</span>
            </button>
        </nav>

        <div class="scroll">
            {#if !grouped.length}
                <div class="empty">
                    {filter === 'attention' ? 'Nothing on it needs doing.' : 'Nothing here.'}
                </div>
            {/if}

            {#each grouped as group}
                <section>
                    <h2 class="eyebrow">{group.label}</h2>
                    {#each group.items as item}
                        <div class="part" class:dead={item.dead}>
                            <div class="part-name">
                                <span>{item.label}</span>
                                <div class="tags">
                                    {#if item.dead}<span class="tag bad">Failed</span>
                                    {:else if item.required}<span class="tag warn">Due</span>{/if}
                                    {#if item.critical}<span class="tag">Critical</span>{/if}
                                    {#if item.method === 'garage'}<span class="tag">Workshop</span>{/if}
                                    {#if item.unknown}<span class="tag faint">No reading</span>{/if}
                                </div>
                            </div>

                            <ConditionBar value={item.health} band={item.band} label={item.bandLabel} />

                            <div class="actions">
                                {#each actions(item) as action}
                                    <button
                                        class={action.kind}
                                        title={action.hint || ''}
                                        onclick={() => repair(item, action.mode)}
                                    >{action.label}</button>
                                {/each}
                                {#if !actions(item).length}
                                    <span class="faint small">
                                        {item.unknown ? 'diagnose again' : item.method === 'garage' ? 'mechanic + lift' : 'mechanic'}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </section>
            {/each}
        </div>

        <footer>
            {#if isMechanic}
                <button class="primary" onclick={service}>Work through the job list</button>
            {/if}
            <span class="spacer"></span>
            <button class="ghost" onclick={close}>Close</button>
        </footer>
    </div>
</div>

<style>
    .sheet { width: 880px; max-height: 84vh; display: flex; flex-direction: column; padding: 22px 24px 14px; }

    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    h1 { margin: 4px 0 6px; font-size: 21px; font-weight: 600; }
    .plate {
        font-size: 13px;
        border: 1px solid var(--line-strong);
        border-radius: 4px;
        padding: 2px 7px;
        margin-left: 8px;
        vertical-align: 3px;
        color: var(--text-dim);
    }
    .sub { font-size: 12px; }
    .sub .ok { color: var(--ok); }
    .sub .warn { color: var(--warn); }
    .sub .bad { color: var(--danger); }

    .overall { text-align: right; flex: none; }
    .overall-value { font-size: 32px; font-weight: 600; line-height: 1; }

    .summary {
        margin: 16px 0 0;
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        background: var(--bg-panel);
        border-left: 3px solid var(--line-strong);
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .summary.tow { border-left-color: var(--warn); }
    .summary .dim { font-size: 12px; }

    .symptoms { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .chip {
        font-size: 11px;
        background: var(--bg-panel);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 3px 10px;
        color: var(--text-dim);
    }

    .filters { display: flex; gap: 6px; margin: 18px 0 8px; }
    .filters button {
        font-size: 11px; padding: 6px 13px; background: transparent; border-color: transparent;
        color: var(--text-dim); letter-spacing: 0.05em; text-transform: uppercase; box-shadow: none;
    }
    .filters button:hover { box-shadow: none; }
    .filters button.active {
        background: var(--accent-soft); border-color: var(--accent); color: var(--accent);
        box-shadow: var(--glow);
    }
    .count { font-family: var(--mono); font-size: 11px; opacity: 0.7; margin-left: 4px; }

    .scroll { overflow-y: auto; flex: 1; padding-right: 6px; min-height: 180px; }
    section { margin-bottom: 16px; }
    h2 { margin: 0 0 6px; }

    .part {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 16px;
        padding: 9px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
    }
    .part:hover { background: var(--bg-panel); border-color: var(--line); }
    .part.dead { background: var(--danger-bg); }

    .part-name { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; }
    .tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag {
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border: 1px solid var(--line-strong);
        border-radius: 3px;
        padding: 1px 5px;
        color: var(--text-faint);
    }
    .tag.warn { border-color: var(--warn); color: var(--warn); }
    .tag.bad { border-color: var(--danger); color: var(--danger); }
    .tag.faint { opacity: 0.6; }

    .actions { display: flex; gap: 6px; justify-content: flex-end; min-width: 220px; }
    .actions button { font-size: 12px; padding: 5px 10px; }
    /* The improvised option is secondary, but it still has to read as a button. */
    .actions button.ghost { border-color: var(--line); color: var(--text-dim); }
    .actions button.ghost:hover { border-color: var(--line-strong); color: var(--text); }
    .small { font-size: 11px; }

    footer { display: flex; align-items: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 8px; }
</style>
