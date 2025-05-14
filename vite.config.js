import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // other: resolve(__dirname, 'faustlive-wasm.html'),
      },
    },
    sourcemap: false
  },
  optimizeDeps: {
    exclude: ['@grame/faustwasm'],
  },
  assetsInclude: ['**/*.wasm'],
})
