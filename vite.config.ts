import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import footage from './vite-plugin-footage.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), footage()],
  // footage/ is re-read per request; watching it would also lock its folders on Windows
  server: { watch: { ignored: ['**/footage/**'] } },
  // dcm2niix spawns its own worker + WASM; pre-bundling breaks that in dev
  optimizeDeps: { exclude: ['@niivue/dcm2niix'] },
})
