import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const hermesPort = process.env.HERMES_PORT ?? '31847'
const hermesOrigin = process.env.HERMES_ORIGIN ?? `http://localhost:${hermesPort}`

const proxyTarget = {
  target: hermesOrigin,
  changeOrigin: true,
  secure: false,
}

const proxyRoutes = {
  '/api': proxyTarget,
  '/a/': proxyTarget,
  '/auth': proxyTarget,
  '/metrics': proxyTarget,
  '/healthz': proxyTarget,
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: proxyRoutes,
  },
  preview: {
    port: 4173,
    proxy: proxyRoutes,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
