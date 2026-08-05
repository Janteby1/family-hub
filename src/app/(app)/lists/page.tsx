"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import type { List } from "@/lib/types";

export default function ListsPage() {
  useMarkModuleSeen("lists");
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [uncheckedCounts, setUncheckedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const { data: listsData, error: listsError } = await supabase
      .from("lists")
      .select("*")
      .order("created_at");

    if (listsError) {
      setError(listsError.message);
      setLoading(false);
      return;
    }

    const allLists = (listsData ?? []) as List[];
    setLists(allLists);

    const counts: Record<string, number> = {};
    if (allLists.length > 0) {
      const { data: items } = await supabase
        .from("list_items")
        .select("list_id")
        .eq("checked", false)
        .in("list_id", allLists.map((l) => l.id));

      for (const item of (items ?? []) as { list_id: string }[]) {
        counts[item.list_id] = (counts[item.list_id] ?? 0) + 1;
      }
    }
    setUncheckedCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("lists")
      .insert({ name, list_type: "general" })
      .select()
      .single();

    setCreating(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewListName("");
    if (data) {
      router.push(`/lists/${data.id}`);
    } else {
      load();
    }
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Lists</h1>

      <section className="mb-6 rounded-xl border border-accent-100 p-4">
        <h2 className="mb-3 font-medium text-[var(--foreground)]">New list</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="List name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newListName.trim()}
            className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ New list"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-accent-900/55">Loading...</p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-accent-900/55">No lists yet. Create one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="rounded-xl border border-accent-100 p-4 hover:bg-neutral-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--foreground)]">{list.name}</span>
                <span className="text-xs text-accent-900/55">{uncheckedCounts[list.id] ?? 0} left</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
