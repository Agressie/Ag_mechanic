<script>
    /* Small inline icon set - no icon font, no external requests. */
    let { name = 'grid', size = 18 } = $props();

    const paths = {
        grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
        users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
        box: 'M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8zM3.3 7L12 12l8.7-5M12 22V12',
        cart: 'M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2M20 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
        wrench: 'M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z',
        truck: 'M1 3h13v13H1zM14 8h4l3 3v5h-7M5.5 18.5a2 2 0 1 0 0-.1M17.5 18.5a2 2 0 1 0 0-.1',
        clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2',
        alert: 'M12 2 1 21h22zM12 9v5M12 17.5v.5',
    };
</script>

<svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
>
    <path d={paths[name] || paths.grid} />
</svg>
