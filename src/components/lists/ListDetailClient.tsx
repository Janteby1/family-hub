"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import type { List, ListItem } from "@/lib/types";

interface ListDetailClientProps {
  listId: string;
}

export function ListDetailClient({ listId }: ListDetailClientProps) {
  const { member } = useCurrentMember();

  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const [{ data: listData, error: listError }, { data: itemsData, error: itemsError }] = await Promise.all([
      supabase.from("lists").select("*").eq("id", listId).single(),
      supabase
        .from("list_items")
        .select("*")
        .eq("list_id", listId)
        .order("checked", { ascending: true })
        .order("created_at", { ascending: true }),
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

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

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
    const supabase = createClient();
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !item.checked } : i))
    );
    const { error: updateError } = await supabase
      .from("list_items")
      .update({ checked: !item.checked })
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

  return (
    <div className="p-4 md:p-8">
      <Link href="/lists" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        ← Back to lists
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        {loading ? "Loading..." : list?.name ?? "List not found"}
      </h1>

      <section className="mb-6 rounded-xl border border-neutral-200 p-4">
        <h2 className="mb-3 font-medium text-neutral-900">Add item</h2>
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
            className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading items...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {uncheckedItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="flex-1 text-sm text-neutral-900">{item.label}</span>
              {item.quantity && <span className="text-xs text-neutral-500">{item.quantity}</span>}
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
              <li className="my-2 border-t border-neutral-200" />
              {checkedItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2"
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
