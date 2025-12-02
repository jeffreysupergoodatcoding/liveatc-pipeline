import { createClient } from '@supabase/supabase-js';

let supabaseServerInstance = null;

// Lazy initialization - only create client when accessed at runtime
export function getSupabaseServer() {
  if (supabaseServerInstance) {
    return supabaseServerInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  // Server-side client with service role key - bypasses RLS
  supabaseServerInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseServerInstance;
}

// Legacy export for backwards compatibility (deprecated)
export const supabaseServer = getSupabaseServer;
