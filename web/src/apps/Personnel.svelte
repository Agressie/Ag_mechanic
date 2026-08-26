<script>
    /*
     * Roster, hiring, firing and grades. Every button here is a request the
     * server is free to refuse - the disabled states are a courtesy, not a lock.
     */
    import { rpc } from '../lib/nui.js';
    import { date } from '../lib/format.js';

    let data = $state(null);
    let loading = $state(true);
    let error = $state('');
    let hiring = $state(false);
    let manualId = $state('');

    async function load() {
        loading = true;
        const result = await rpc('personnel:roster');
        if (result && result.ok) {
            data = result;
            error = '';
        } else {
            error = 'The roster is not available to you.';
        }
        loading = false;
    }

    $effect(() => { load(); });

    async function act(name, args, failure) {
        error = '';
        const result = await rpc(name, args);
        if (result && result.ok) {
            data = { ...data, roster: result.roster };
        } else {
            error = REASONS[result && result.reason] || failure;
        }
    }

    const REASONS = {
        noPermission: 'Your grade does not allow that.',
        gradeTooHigh: 'You cannot touch somebody at or above your own grade.',
        notYourself: 'You cannot do that to yourself.',
        alreadyEmployed: 'They already work here.',
        tooFar: 'They need to be standing next to you.',
        noTarget: 'The framework cannot reach that character right now.',
        notEmployed: 'They do not work here.',
        coreRefused: 'The framework refused the change.',
    };

    const hireGrade = $state({ value: 0 });

    const assignable = $derived(
        (data?.grades || []).filter((g) => !data?.me || g.level < data.me.grade),
    );
</script>

{#if loading && !data}
    <div class="empty">Loading…</div>
{:else if !data}
    <div class="empty">{error || 'Unavailable.'}</div>
{:else}
    {#if error}<div class="error">{error}</div>{/if}

    <div class="bar">
        <span class="dim">{data.roster.length} on the books</span>
        <span class="spacer"></span>
        {#if data.can.hire}
            <button class="primary" onclick={() => (hiring = !hiring)}>{hiring ? 'Cancel' : 'Take somebody on'}</button>
        {/if}
    </div>

    {#if hiring}
        <div class="hire card">
            <div class="row head">
                <span class="eyebrow">Nearby</span>
                <span class="spacer"></span>
                <label class="grade-pick">
                    Start at
                    <select bind:value={hireGrade.value}>
                        {#each assignable as grade}
                            <option value={grade.level}>{grade.label}</option>
                        {/each}
                    </select>
                </label>
            </div>

            {#if !data.nearby.length}
                <div class="empty small">Nobody standing close enough. Use a citizen id instead.</div>
            {:else}
                {#each data.nearby as person}
                    <div class="line">
                        <span>{person.name}</span>
                        <span class="dim small">{person.currentJob}</span>
                        <span class="spacer"></span>
                        <button
                            disabled={person.alreadyHere}
                            onclick={() => act('personnel:hire', { src: person.src, grade: hireGrade.value }, 'Could not hire them.')}
                        >{person.alreadyHere ? 'Already here' : 'Hire'}</button>
                    </div>
                {/each}
            {/if}

            <div class="line manual">
                <input placeholder="…or a citizen id" bind:value={manualId} />
                <button
                    disabled={!manualId.trim()}
                    onclick={() => act('personnel:hire', { citizenid: manualId.trim(), grade: hireGrade.value }, 'Could not hire them.')}
                >Hire by id</button>
            </div>
        </div>
    {/if}

    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Grade</th>
                <th>Hired</th>
                <th>Status</th>
                <th class="right">Actions</th>
            </tr>
        </thead>
        <tbody>
            {#each data.roster as member}
                <tr>
                    <td>
                        {member.name}
                        {#if member.citizenid === data.me.citizenid}<span class="you">you</span>{/if}
                    </td>
                    <td>
                        {#if data.can.promote && member.citizenid !== data.me.citizenid && member.grade < data.me.grade}
                            <select
                                value={member.grade}
                                onchange={(e) => act('personnel:grade', { citizenid: member.citizenid, grade: Number(e.currentTarget.value) }, 'Could not change their grade.')}
                            >
                                {#each assignable as grade}
                                    <option value={grade.level}>{grade.label}</option>
                                {/each}
                            </select>
                        {:else}
                            {member.gradeLabel}
                        {/if}
                    </td>
                    <td class="dim small">{member.hiredAt ? date(member.hiredAt) : '—'}{member.hiredBy ? ` · ${member.hiredBy}` : ''}</td>
                    <td>
                        <span class="dot" class:on={member.online}></span>
                        {member.online ? (member.onDuty ? 'On shift' : 'Online') : 'Offline'}
                    </td>
                    <td class="right">
                        {#if data.can.fire && member.citizenid !== data.me.citizenid && member.grade < data.me.grade}
                            <button class="danger" onclick={() => act('personnel:fire', { citizenid: member.citizenid }, 'Could not let them go.')}>Let go</button>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
{/if}

<style>
    .error {
        background: var(--danger-bg); border: 1px solid var(--danger-line);
        color: var(--danger-text); font-size: 12px; padding: 9px 12px;
        border-radius: var(--radius-sm); margin-bottom: 12px;
    }
    .bar { display: flex; align-items: center; margin-bottom: 12px; font-size: 13px; }

    .hire { padding: 14px; margin-bottom: 16px; }
    .hire .head { margin-bottom: 8px; }
    .grade-pick { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); }
    .grade-pick select { width: auto; }

    .line { display: flex; align-items: center; gap: 12px; padding: 7px 4px; font-size: 13px; }
    .line.manual { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 12px; }
    .line.manual input { max-width: 260px; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
        text-align: left; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--text-faint); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--line);
    }
    td { padding: 9px 10px; border-bottom: 1px solid var(--bg-raised); vertical-align: middle; }
    tr:hover td { background: var(--bg-raised); }
    .right { text-align: right; }
    td select { width: auto; padding: 4px 8px; font-size: 12px; }

    .you {
        font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
        color: var(--accent); margin-left: 6px;
    }
    .tag {
        font-size: 10px; border: 1px solid var(--line-strong); border-radius: 3px;
        padding: 1px 5px; margin-left: 6px; color: var(--text-faint);
    }
    .dot {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: var(--line-strong); margin-right: 6px;
    }
    .dot.on { background: var(--ok); }
    .small { font-size: 11px; }
    .empty.small { padding: 14px; text-align: left; }
</style>
