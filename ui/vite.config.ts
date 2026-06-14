import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const hermesPort = process.env.HERMES_PORT ?? '31847'
const hermesOrigin = `http://localhost:${hermesPort}`

const proxyRoutes: Record<string, string> = {
  '/api': hermesOrigin,
  '/a/': hermesOrigin,
  '/auth': hermesOrigin,
  '/metrics': hermesOrigin,
  '/healthz': hermesOrigin,
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
