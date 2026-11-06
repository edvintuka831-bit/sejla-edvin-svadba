import { createClient } from '@supabase/supabase-js'
import { IS_CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from './config.js'

// Publishable (anon) ključ je javan po dizajnu – sva zaštita je u RLS-u i serverskim funkcijama.
export const supabase = IS_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'se-memories-admin' },
    })
  : null
