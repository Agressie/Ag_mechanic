import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/*
 * Builds into ../html, which is what fxmanifest.lua serves. Relative asset
 * paths are required: NUI loads the page from nui://ag_mechanic/html/index.html,
 * so an absolute /assets/... path would resolve to the wrong root.
 */
export default defineConfig({
    plugins: [svelte()],
    base: './',
    build: {
        outDir: '../html',
        emptyOutDir: true,
        target: 'chrome108',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
            },
        },
    },
});
