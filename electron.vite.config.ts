import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const shared = resolve(__dirname, 'src/shared')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: {
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          content: resolve(__dirname, 'src/preload/content.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [svelte()],
    resolve: { alias: { '@shared': shared } },
    build: {
      target: 'chrome140',
      minify: true,
      cssCodeSplit: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          quick: resolve(__dirname, 'src/renderer/quick.html'),
        },
      },
    },
  },
})
