import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const hermesPort = process.env.HERMES_PORT ?? '31847'
const hermesOrigin = `http://localhost:${hermesPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': hermesOrigin,
      '/a': hermesOrigin,
      '/apps': hermesOrigin,
      '/auth': hermesOrigin,
      '/metrics': hermesOrigin,
      '/healthz': hermesOrigin,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
