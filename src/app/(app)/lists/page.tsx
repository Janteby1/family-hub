"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import { cleanupExpiredCheckedItems } from "@/lib/list-cleanup";
import type { List, ListItem } from "@/lib/types";

export default function ListsPage() {
  useMarkModuleSeen("lists");
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, ListItem[]>>({});
  const [checkedCounts, setCheckedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    await cleanupExpiredCheckedItems(supabase);

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

    const unchecked: Record<string, ListItem[]> = {};
    const checkedCounts: Record<string, number> = {};
    if (allLists.length > 0) {
      const { data: items } = await supabase
        .from("list_items")
        .select("*")
        .in("list_id", allLists.map((l) => l.id))
        .order("created_at");

      for (const item of (items ?? []) as ListItem[]) {
        if (item.checked) {
          checkedCounts[item.list_id] = (checkedCounts[item.list_id] ?? 0) + 1;
        } else {
          (unchecked[item.list_id] ??= []).push(item);
        }
      }
    }
    setItemsByList(unchecked);
    setCheckedCounts(checkedCounts);
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

  async function handleDeleteList(e: React.MouseEvent, list: List) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${list.name}"? This will remove all items on it.`)) return;

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("lists").delete().eq("id", list.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setLists((prev) => prev.filter((l) => l.id !== list.id));
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
          {lists.map((list) => {
            const items = itemsByList[list.id] ?? [];
            const checkedCount = checkedCounts[list.id] ?? 0;
            return (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="rounded-xl border border-accent-100 p-4 hover:bg-neutral-50"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--foreground)]">{list.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-accent-900/55">{items.length} left</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteList(e, list)}
                      className="text-xs text-neutral-400 hover:text-red-600"
                      aria-label={`Delete ${list.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-neutral-400">Nothing on this list.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.id} className="truncate text-sm text-neutral-700">
                        {item.label}
                        {item.quantity && (
                          <span className="text-accent-900/55"> — {item.quantity}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {checkedCount > 0 && (
                  <p className="mt-2 text-xs text-accent-900/55">
                    {checkedCount} checked off
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
