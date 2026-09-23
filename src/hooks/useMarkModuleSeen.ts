"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BadgeModule } from "@/lib/types";

// Records that the current user just looked at a module, so the nav badge
// counters (computed server-side via the get_badge_counts RPC) clear for it.
export function useMarkModuleSeen(module: BadgeModule) {
  useEffect(() => {
    const supabase = createClient();

    async function markSeen() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;
      await supabase
        .from("module_last_seen")
        .upsert(
          { auth_user_id: user.id, module, last_seen_at: new Date().toISOString() },
          { onConflict: "auth_user_id,module" }
        );
    }

    markSeen();
  }, [module]);
}
