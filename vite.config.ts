import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createGroqMiddleware } from './server/groqProxy.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'local-groq-api',
    configureServer(server) {
      server.middlewares.use(createGroqMiddleware({ rootDir: fileURLToPath(new URL('.', import.meta.url)) }))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createGroqMiddleware({ rootDir: fileURLToPath(new URL('.', import.meta.url)) }))
    },
  }],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
