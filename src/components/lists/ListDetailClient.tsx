"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { cleanupExpiredCheckedItems } from "@/lib/list-cleanup";
import type { List, ListItem } from "@/lib/types";

interface ListDetailClientProps {
  listId: string;
}

export function ListDetailClient({ listId }: ListDetailClientProps) {
  const { member } = useCurrentMember();

  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [allLists, setAllLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    await cleanupExpiredCheckedItems(supabase);

    const [
      { data: listData, error: listError },
      { data: itemsData, error: itemsError },
      { data: allListsData },
    ] = await Promise.all([
      supabase.from("lists").select("*").eq("id", listId).single(),
      supabase
        .from("list_items")
        .select("*")
        .eq("list_id", listId)
        .order("checked", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("lists").select("*").order("created_at"),
    ]);

    if (listError) {
      setError(listError.message);
    } else {
      setList(listData as List);
    }

    if (itemsError) {
      setError(itemsError.message);
    } else {
      setItems((itemsData ?? []) as ListItem[]);
    }

    setAllLists((allListsData ?? []) as List[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // Live sync: items added/checked/removed on another device show up here
  // without a manual refresh. Scoped to this list via an equality filter.
  useRealtimeTable(
    "list_items",
    () => load(),
    `list_id=eq.${listId}`
  );

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label || !member) return;
    setAdding(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("list_items").insert({
      list_id: listId,
      label,
      normalized_label: label.toLowerCase(),
      quantity: newQuantity.trim() || null,
      added_by_member_id: member.id,
      source: "manual",
    });

    setAdding(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewLabel("");
    setNewQuantity("");
    load();
  }

  async function handleToggle(item: ListItem) {
    const nowChecked = !item.checked;
    const patch = { checked: nowChecked, checked_at: nowChecked ? new Date().toISOString() : null };

    const supabase = createClient();
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const { error: updateError } = await supabase
      .from("list_items")
      .update(patch)
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      load();
    }
  }

  async function handleDelete(item: ListItem) {
    const supabase = createClient();
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error: deleteError } = await supabase.from("list_items").delete().eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      load();
    }
  }

  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);

  const currentIndex = allLists.findIndex((l) => l.id === listId);
  const prevList = currentIndex > 0 ? allLists[currentIndex - 1] : null;
  const nextList =
    currentIndex >= 0 && currentIndex < allLists.length - 1 ? allLists[currentIndex + 1] : null;

  return (
    <div className="p-4 md:p-8">
      <Link href="/lists" className="mb-4 inline-block text-sm text-accent-900/55 hover:underline">
        ← Back to lists
      </Link>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          {loading ? "Loading..." : list?.name ?? "List not found"}
        </h1>
        {allLists.length > 1 && (
          <div className="flex shrink-0 items-center gap-3 text-sm">
            {prevList ? (
              <Link
                href={`/lists/${prevList.id}`}
                className="text-accent-900/55 hover:underline"
                title={prevList.name}
              >
                ← Prev
              </Link>
            ) : (
              <span className="text-neutral-300">← Prev</span>
            )}
            {nextList ? (
              <Link
                href={`/lists/${nextList.id}`}
                className="text-accent-900/55 hover:underline"
                title={nextList.name}
              >
                Next →
              </Link>
            ) : (
              <span className="text-neutral-300">Next →</span>
            )}
          </div>
        )}
      </div>

      <section className="mb-6 rounded-xl border border-accent-100 p-4">
        <h2 className="mb-3 font-medium text-[var(--foreground)]">Add item</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Item name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <input
            type="text"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Qty"
            className="w-24 shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newLabel.trim() || !member}
            className="shrink-0 rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-accent-900/55">Loading items...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-accent-900/55">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {uncheckedItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-accent-100 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="flex-1 text-sm text-[var(--foreground)]">{item.label}</span>
              {item.quantity && <span className="text-xs text-accent-900/55">{item.quantity}</span>}
              <button
                type="button"
                onClick={() => handleDelete(item)}
                className="text-xs text-neutral-400 hover:text-red-600"
                aria-label={`Remove ${item.label}`}
              >
                Remove
              </button>
            </li>
          ))}

          {checkedItems.length > 0 && (
            <>
              <li className="my-2 border-t border-accent-100" />
              {checkedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border border-accent-100 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggle(item)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span className="flex-1 text-sm line-through text-neutral-400">{item.label}</span>
                  {item.quantity && (
                    <span className="text-xs line-through text-neutral-400">{item.quantity}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-xs text-neutral-400 hover:text-red-600"
                    aria-label={`Remove ${item.label}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
