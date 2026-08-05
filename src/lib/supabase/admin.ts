import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for trusted server-only code paths (cron jobs, AI
// extraction routes) that must bypass RLS. Never import this into anything
// that runs in the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
