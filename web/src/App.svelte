<script>
    import Tablet from './screens/Tablet.svelte';
    import Report from './screens/Report.svelte';
    import Upgrades from './screens/Upgrades.svelte';
    import Diagnose from './screens/Diagnose.svelte';
    import { isBrowser } from './lib/nui.js';
    import { devTablet, devReport, devUpgrades, devDiagnose } from './lib/dev.js';

    let screen = $state(null);
    let payload = $state({});
    /* Bumped on every show, and used as a key so a screen that is re-opened
       gets a fresh component rather than one holding last time's props. */
    let instance = $state(0);

    function handle(event) {
        const message = event.data;
        if (!message || typeof message !== 'object') return;

        if (message.action === 'show') {
            screen = message.data.screen;
            payload = message.data.payload || {};
            instance += 1;
        } else if (message.action === 'hide') {
            screen = null;
            payload = {};
        }
    }

    $effect(() => {
        window.addEventListener('message', handle);

        /* Running in a plain browser: show a screen so the layout can be
           worked on without launching the game. */
        if (isBrowser && !screen) {
            const wanted = new URLSearchParams(window.location.search).get('screen') || 'tablet';
            const fixtures = { tablet: devTablet, report: devReport, upgrades: devUpgrades, diagnose: devDiagnose };
            screen = wanted;
            payload = (fixtures[wanted] || devTablet)();
        }

        return () => window.removeEventListener('message', handle);
    });
</script>

{#key instance}
    {#if screen === 'tablet'}
        <Tablet {payload} />
    {:else if screen === 'report'}
        <Report {payload} />
    {:else if screen === 'upgrades'}
        <Upgrades {payload} />
    {:else if screen === 'diagnose'}
        <Diagnose {payload} />
    {/if}
{/key}
