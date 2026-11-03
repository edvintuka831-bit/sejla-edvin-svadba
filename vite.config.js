import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Netlify postavlja URL tokom builda – Viber/WhatsApp trebaju apsolutni link na sliku za dijeljenje.
// Za ručni build (ZIP) može se zadati SITE_URL=https://vas-link.netlify.app npm run build
const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'og-absolute-url',
      transformIndexHtml(html) {
        return html.replaceAll('%SITE_URL%', siteUrl)
      },
    },
  ],
  server: {
    // Lokalni test: node scripts/dev-api.mjs pokreće iste serverske funkcije na portu 8788
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
})
