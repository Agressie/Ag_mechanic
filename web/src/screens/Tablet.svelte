<script>
    /*
     * The tablet shell.
     *
     * Apps are declared in config/config.js on the Lua side and arrive in the
     * payload, so adding one later is: add a config entry, write the component,
     * add a line to APPS below. Nothing else in the shell needs to change.
     */
    import { untrack } from 'svelte';
    import { close } from '../lib/nui.js';
    import Icon from '../lib/Icon.svelte';
    import Home from '../apps/Home.svelte';
    import Personnel from '../apps/Personnel.svelte';
    import Inventory from '../apps/Inventory.svelte';
    import Shop from '../apps/Shop.svelte';

    let { payload = {} } = $props();

    /* App registry: id -> component. */
    const APPS = { home: Home, personnel: Personnel, inventory: Inventory, shop: Shop };

    const apps = $derived((payload.apps || []).filter((app) => APPS[app.id]));
    /* The app to land on is decided once, when the tablet is opened. */
    const startApp = untrack(() => payload.startApp);
    let activeId = $state(startApp && APPS[startApp] ? startApp : 'home');

    const ActiveApp = $derived(APPS[activeId] || Home);
    const activeMeta = $derived(apps.find((a) => a.id === activeId) || { label: '' });

    let clock = $state(new Date());
    $effect(() => {
        const handle = setInterval(() => { clock = new Date(); }, 15000);
        return () => clearInterval(handle);
    });

    const time = $derived(clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

    /* Lets an app hand the user off to another one, e.g. Home -> Shop. */
    function navigate(id) {
        if (APPS[id]) activeId = id;
    }
</script>

<div class="overlay">
    <div class="tablet">
        <div class="bezel">
            <div class="screen">
                <aside>
                    <div class="brand">
                        <Icon name="wrench" size={20} />
                        <div class="col">
                            <span class="shop-name">{payload.shop?.label || 'Workshop'}</span>
                            <span class="eyebrow">{payload.user?.gradeLabel || ''}</span>
                        </div>
                    </div>

                    <nav>
                        {#each apps as app}
                            <button class:active={app.id === activeId} onclick={() => (activeId = app.id)}>
                                <Icon name={app.icon} />
                                <span>{app.label}</span>
                            </button>
                        {/each}
                    </nav>

                    <div class="spacer"></div>

                    <div class="user">
                        <div class="avatar">{(payload.user?.name || '?').slice(0, 1).toUpperCase()}</div>
                        <div class="col">
                            <span class="user-name">{payload.user?.name || 'Unknown'}</span>
                            <span class="eyebrow">Grade {payload.user?.grade ?? 0}</span>
                        </div>
                    </div>
                </aside>

                <main>
                    <div class="topbar">
                        <span class="title">{activeMeta.label}</span>
                        <span class="spacer"></span>
                        <span class="mono time">{time}</span>
                        <button class="ghost close" onclick={close} aria-label="Close">✕</button>
                    </div>

                    <div class="content">
                        <ActiveApp {payload} {navigate} />
                    </div>
                </main>
            </div>
        </div>
    </div>
</div>

<style>
    .tablet { width: 1120px; max-width: 94vw; }
    .bezel {
        background: linear-gradient(160deg, #071427 0%, #02060d 100%);
        border: 1px solid var(--line-strong);
        border-radius: 22px;
        padding: 14px;
        box-shadow: var(--shadow), var(--glow), inset 0 0 0 1px rgba(30, 166, 240, 0.10);
    }
    .screen {
        display: grid;
        grid-template-columns: 216px 1fr;
        height: 660px;
        max-height: 78vh;
        background: var(--bg);
        border-radius: 12px;
        overflow: hidden;
    }

    aside {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 18px 12px;
        background: linear-gradient(180deg, var(--bg-raised) 0%, var(--bg-deep) 100%);
        border-right: 1px solid var(--line);
    }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 16px; color: var(--accent); filter: drop-shadow(0 0 6px rgba(30, 166, 240, 0.5)); }
    .shop-name { font-size: 13px; font-weight: 600; color: var(--text); }

    nav { display: flex; flex-direction: column; gap: 3px; }
    nav button {
        position: relative;
        display: flex; align-items: center; gap: 11px;
        background: transparent; border-color: transparent;
        justify-content: flex-start; padding: 9px 11px 9px 13px;
        font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--text-dim); box-shadow: none;
    }
    nav button:hover { color: var(--text); background: var(--bg-hover); box-shadow: none; }
    nav button.active {
        background: var(--accent-soft);
        color: var(--accent);
        border-color: var(--line);
        box-shadow: inset 0 0 18px rgba(30, 166, 240, 0.10);
    }
    /* Lit edge on the active app, like a selected slot. */
    nav button.active::before {
        content: '';
        position: absolute; left: 0; top: 6px; bottom: 6px;
        width: 2px; border-radius: 2px;
        background: var(--accent);
        box-shadow: 0 0 10px var(--accent);
    }

    .user { display: flex; align-items: center; gap: 10px; padding: 12px 6px 0; border-top: 1px solid var(--line); }
    .avatar {
        width: 32px; height: 32px; flex: none;
        display: grid; place-items: center;
        border-radius: 50%; background: var(--bg-panel); border: 1px solid var(--line-strong);
        font-size: 13px; font-weight: 600; color: var(--accent);
        box-shadow: 0 0 12px rgba(30, 166, 240, 0.25);
    }
    .user-name { font-size: 12px; }

    main { display: flex; flex-direction: column; min-width: 0; }
    .topbar {
        display: flex; align-items: center; gap: 12px;
        padding: 14px 18px; border-bottom: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(30, 166, 240, 0.05) 0%, transparent 100%);
    }
    .title { font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    .time { font-size: 12px; color: var(--text-faint); }
    /* Red outline square, the one control that is not cyan. */
    .close {
        padding: 3px 9px; font-size: 13px; line-height: 1.4;
        background: var(--danger-bg);
        border: 1px solid var(--danger-line);
        color: var(--danger-text);
    }
    .close:hover { background: rgba(255, 107, 107, 0.18); border-color: var(--danger); box-shadow: 0 0 14px rgba(255, 107, 107, 0.3); }

    .content { flex: 1; overflow-y: auto; padding: 18px; min-height: 0; }
</style>
