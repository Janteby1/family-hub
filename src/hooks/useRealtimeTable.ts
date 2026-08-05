"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// Every caller in this app only uses the payload as a "something changed,
// go refetch" signal rather than reading payload.new/old directly, so a
// loose row shape avoids fighting the library's `{ [key: string]: any }`
// generic constraint against our plain (non-index-signature) interfaces.
type AnyRow = Record<string, unknown>;

// Subscribes to Postgres change events for one table via Supabase Realtime,
// so edits made on another device show up here without a manual refresh.
// `filter` uses Supabase's postgres_changes filter syntax (e.g.
// "list_id=eq.<uuid>") for equality filters the DB can apply server-side;
// for range-style filtering (e.g. "within this week"), subscribe unfiltered
// and narrow client-side inside onChange instead.
export function useRealtimeTable(
  table: string,
  onChange: (payload: RealtimePostgresChangesPayload<AnyRow>) => void,
  filter?: string
) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        (payload: RealtimePostgresChangesPayload<AnyRow>) => onChangeRef.current(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
