"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMember } from "@/lib/types";

// Resolves the logged-in auth user (Jack or Emily) to their family_members
// row, client-side. Used anywhere we need "who is doing this" for
// created_by/completed_by-style columns.
export function useCurrentMember() {
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("family_members")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (mounted) {
        setMember(data as FamilyMember | null);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { member, loading };
}
