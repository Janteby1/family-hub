"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import type { FamilyMember, StarLedgerEntry } from "@/lib/types";

export default function RewardsPage() {
  const { member: currentMember } = useCurrentMember();
  const [kids, setKids] = useState<FamilyMember[]>([]);
  const [ledger, setLedger] = useState<StarLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState<Record<string, string>>({});
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const [{ data: memberRows }, { data: ledgerRows }] = await Promise.all([
      supabase.from("family_members").select("*").eq("role", "child").order("sort_order"),
      supabase
        .from("star_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    setKids((memberRows ?? []) as FamilyMember[]);
    setLedger((ledgerRows ?? []) as StarLedgerEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live sync: a chore completion elsewhere (which auto-awards stars via a DB
  // trigger) or a redemption logged by the other parent shows up here too.
  useRealtimeTable("star_ledger", () => loadAll());

  const balanceByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of ledger) {
      map.set(entry.member_id, (map.get(entry.member_id) ?? 0) + entry.delta);
    }
    return map;
  }, [ledger]);

  const historyByMember = useMemo(() => {
    const map = new Map<string, StarLedgerEntry[]>();
    for (const entry of ledger) {
      const list = map.get(entry.member_id) ?? [];
      if (list.length < 5) list.push(entry);
      map.set(entry.member_id, list);
    }
    return map;
  }, [ledger]);

  async function handleRedeem(kid: FamilyMember) {
    const raw = redeemAmount[kid.id];
    const amount = Math.floor(Number(raw));
    if (!amount || amount <= 0) return;

    setRedeeming(kid.id);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("star_ledger").insert({
      member_id: kid.id,
      delta: -amount,
      reason: "redeemed",
      created_by: currentMember?.id ?? null,
    });
    setRedeeming(null);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRedeemAmount((prev) => ({ ...prev, [kid.id]: "" }));
    loadAll();
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Rewards</h1>
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Rewards</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kids.map((kid) => {
          const balance = balanceByMember.get(kid.id) ?? 0;
          const history = historyByMember.get(kid.id) ?? [];

          return (
            <section key={kid.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kid.color }} />
                <h2 className="font-medium text-neutral-900">{kid.display_name}</h2>
              </div>

              <p className="mb-4 text-3xl font-semibold text-neutral-900">
                {balance} <span className="text-base font-normal text-neutral-500">★ stars</span>
              </p>

              <div className="mb-4 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={redeemAmount[kid.id] ?? ""}
                  onChange={(e) =>
                    setRedeemAmount((prev) => ({ ...prev, [kid.id]: e.target.value }))
                  }
                  placeholder="Stars"
                  className="w-20 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
                <button
                  type="button"
                  onClick={() => handleRedeem(kid)}
                  disabled={redeeming === kid.id || !redeemAmount[kid.id]}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {redeeming === kid.id ? "Redeeming…" : "Mark redeemed"}
                </button>
              </div>

              {history.length > 0 && (
                <ul className="space-y-1 border-t border-neutral-100 pt-3">
                  {history.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{entry.reason === "redeemed" ? "Redeemed" : "Chore completed"}</span>
                      <span className={entry.delta < 0 ? "text-red-600" : "text-green-600"}>
                        {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
