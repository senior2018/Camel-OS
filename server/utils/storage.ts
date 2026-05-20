import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client scoped to the service-role key. Used exclusively
 * for Storage operations (upload, signed URL, delete) — never exposed to the
 * browser.
 *
 * Manual setup: in the Supabase dashboard, create a private bucket called
 * `opportunity-attachments`. RLS is not required because every request is
 * authenticated via service-role; row-level authorization happens in our
 * endpoints (via `requirePermission` + organization scoping).
 */
let _client: SupabaseClient | null = null

export function useSupabaseStorage(): SupabaseClient {
  if (_client) return _client
  const config = useRuntimeConfig()
  const url = config.supabaseUrl as string
  const key = config.supabaseServiceRoleKey as string
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use file storage.')
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}

export const OPPORTUNITY_ATTACHMENTS_BUCKET = 'opportunity-attachments'

/** Default download-URL TTL: 5 minutes is enough for a click-to-download flow. */
export const SIGNED_URL_TTL_SECONDS = 60 * 5
