import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Netlify postavlja URL tokom builda – za apsolutne linkove pregleda (Viber/WhatsApp).
const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || process.env.URL || '').replace(/\/$/, '')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    },
  ],
  server: {
    host: true,
    // Lokalno: npm run dev:api pokreće iste serverske funkcije na portu 8788
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  preview: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  build: { target: 'es2020' },
})
