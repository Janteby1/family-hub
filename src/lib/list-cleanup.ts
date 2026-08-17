import type { SupabaseClient } from "@supabase/supabase-js";

// Checked-off list items stay visible (struck through) for a day, then get
// swept away automatically — no cron job, just a lazy cleanup run whenever
// a lists page loads, the same pattern this app already uses for backfilling
// today's chore instances.
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function cleanupExpiredCheckedItems(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
  await supabase.from("list_items").delete().eq("checked", true).lt("checked_at", cutoff);
}
