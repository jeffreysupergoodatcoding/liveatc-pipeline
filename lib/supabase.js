import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

// Lazy initialization - only create client when accessed at runtime
function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Export as getter to ensure lazy initialization
export const supabase = new Proxy({}, {
  get(target, prop) {
    return getSupabase()[prop];
  }
});
