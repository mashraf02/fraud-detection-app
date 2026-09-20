import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server proxies /api to the backend so the browser talks to a single
// origin, matching the production nginx setup. Override the target with
// VITE_API_PROXY_TARGET when the API is not on the default port.
//
// `globalThis.process` rather than bare `process`: this file is linted with the
// browser globals from the app config, where a bare `process` is flagged.
const API_PROXY_TARGET =
  globalThis.process?.env?.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
