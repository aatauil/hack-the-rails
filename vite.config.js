import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api goes to the Express server (server/index.js), which talks to Stripe.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` } },
})
