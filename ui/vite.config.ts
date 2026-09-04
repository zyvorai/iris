import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const irisPort = process.env.IRIS_PORT ?? '31847'
const irisOrigin = process.env.IRIS_ORIGIN ?? `http://localhost:${irisPort}`

const proxyTarget = {
  target: irisOrigin,
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
