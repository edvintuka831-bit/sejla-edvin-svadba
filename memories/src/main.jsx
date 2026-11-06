import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/great-vibes/latin-400.css'
import '@fontsource/great-vibes/latin-ext-400.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-ext-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-ext-400-italic.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-ext-600.css'
import '@fontsource/cinzel/latin-400.css'
import '@fontsource/cinzel/latin-ext-400.css'
import '@fontsource/cinzel/latin-600.css'
import '@fontsource/cinzel/latin-ext-600.css'
import './styles.css'
import GuestApp from './guest/GuestApp.jsx'

// Administracija se učitava samo na /admin (gosti ne preuzimaju njen kod)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const isAdmin = window.location.pathname.replace(/\/+$/, '').startsWith('/admin')
if (isAdmin) {
  const meta = document.createElement('meta')
  meta.name = 'robots'
  meta.content = 'noindex, nofollow'
  document.head.append(meta)
  document.title = 'Administracija · Šejla & Edvin'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div className="boot"><span className="spinner dark" /></div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <GuestApp />
    )}
  </StrictMode>,
)
