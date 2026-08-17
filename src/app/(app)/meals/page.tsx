"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import type { MealPlanEntry, MealSlot, Recipe } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Breakfast/lunch/snack are intentionally excluded from the planner grid
// (still valid meal_slot values in the DB, just not surfaced here) — the
// grid is just two dinner rows, split by who it's for.
const MEAL_SLOTS: MealSlot[] = ["dinner_kids", "dinner_adults"];
const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dinner_kids: "Kids Dinner",
  dinner_adults: "Adults Dinner",
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function cellKey(planDate: string, slot: MealSlot): string {
  return `${planDate}__${slot}`;
}

export default function MealsPage() {
  useMarkModuleSeen("meals");
  const { member } = useCurrentMember();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ planDate: string; slot: MealSlot } | null>(
    null
  );
  const [editFreeText, setEditFreeText] = useState("");
  const [editRecipeId, setEditRecipeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [ingredientsText, setIngredientsText] = useState("");
  const [addingIngredients, setAddingIngredients] = useState(false);
  const [ingredientsMessage, setIngredientsMessage] = useState<string | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const rangeStart = dateKey(weekStart);
    const rangeEnd = dateKey(addDays(weekStart, 6));

    const [{ data: entryRows }, { data: recipeRows }] = await Promise.all([
      supabase
        .from("meal_plan_entries")
        .select("*")
        .gte("plan_date", rangeStart)
        .lte("plan_date", rangeEnd),
      supabase.from("recipes").select("id, title").order("title"),
    ]);

    setEntries((entryRows ?? []) as MealPlanEntry[]);
    setRecipes((recipeRows ?? []) as Recipe[]);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live sync: meal plan edits from another device refresh the visible week.
  // Unfiltered because postgres_changes only supports equality filters, not
  // the date-range this view needs.
  useRealtimeTable("meal_plan_entries", () => {
    fetchData();
  });

  const entryByCell = useMemo(() => {
    const map = new Map<string, MealPlanEntry>();
    for (const entry of entries) {
      map.set(cellKey(entry.plan_date, entry.meal_slot), entry);
    }
    return map;
  }, [entries]);

  function openCellEditor(planDate: string, slot: MealSlot) {
    const existing = entryByCell.get(cellKey(planDate, slot));
    setEditFreeText(existing?.free_text ?? "");
    setEditRecipeId(existing?.recipe_id ?? "");
    setIngredientsText("");
    setIngredientsMessage(null);
    setEditingCell({ planDate, slot });
  }

  function closeEditor() {
    setEditingCell(null);
    setEditFreeText("");
    setEditRecipeId("");
    setIngredientsText("");
    setIngredientsMessage(null);
  }

  async function addIngredientsToGroceryList() {
    // Split on newlines AND commas — this is a quick shopping-list-style
    // box, not structured recipe ingredients, so "Lemons, Capers, Wine" on
    // one line should become three items, not one.
    const lines = ingredientsText
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setAddingIngredients(true);
    setIngredientsMessage(null);
    const supabase = createClient();

    let { data: groceryList } = await supabase
      .from("lists")
      .select("*")
      .eq("list_type", "grocery")
      .maybeSingle();

    if (!groceryList) {
      const { data: newList, error: createListError } = await supabase
        .from("lists")
        .insert({ name: "Grocery List", list_type: "grocery" })
        .select()
        .single();
      if (createListError || !newList) {
        setIngredientsMessage(createListError?.message ?? "Failed to create grocery list.");
        setAddingIngredients(false);
        return;
      }
      groceryList = newList;
    }

    const { data: existingItems } = await supabase
      .from("list_items")
      .select("normalized_label")
      .eq("list_id", groceryList.id);

    const existingLabels = new Set(
      (existingItems ?? [])
        .map((item) => item.normalized_label)
        .filter((label): label is string => !!label)
    );

    const rowsToInsert = [];
    for (const line of lines) {
      const normalized = line.toLowerCase();
      if (existingLabels.has(normalized)) continue;
      existingLabels.add(normalized);
      rowsToInsert.push({
        list_id: groceryList.id,
        label: line,
        normalized_label: normalized,
        added_by_member_id: member?.id ?? null,
        source: "manual" as const,
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("list_items").insert(rowsToInsert);
      if (insertError) {
        setIngredientsMessage(insertError.message);
        setAddingIngredients(false);
        return;
      }
    }

    setIngredientsMessage(
      rowsToInsert.length > 0
        ? `Added ${rowsToInsert.length} ingredient${rowsToInsert.length === 1 ? "" : "s"} to Grocery List`
        : "Already on the list"
    );
    setIngredientsText("");
    setAddingIngredients(false);
  }

  async function saveCell() {
    if (!editingCell) return;
    setSaving(true);
    const supabase = createClient();
    const { planDate, slot } = editingCell;

    const recipe_id = editRecipeId || null;
    const free_text = recipe_id ? null : editFreeText.trim() || null;

    await supabase.from("meal_plan_entries").upsert(
      { plan_date: planDate, meal_slot: slot, recipe_id, free_text },
      { onConflict: "plan_date,meal_slot" }
    );

    setSaving(false);
    closeEditor();
    fetchData();
  }

  const today = new Date();

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Meal Planner</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Next
          </button>
        </div>
        <span className="text-sm font-medium text-neutral-700">{formatWeekRange(weekStart)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-accent-900/55">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="w-24 p-2 text-left text-xs font-medium text-accent-900/55"> </th>
                {weekDays.map((day) => {
                  const isToday = dateKey(day) === dateKey(today);
                  return (
                    <th key={dateKey(day)} className="p-2 text-left text-xs font-medium">
                      <span className={isToday ? "text-[var(--foreground)]" : "text-accent-900/55"}>
                        {DAY_LABELS[day.getDay()]} {day.getDate()}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {MEAL_SLOTS.map((slot) => (
                <tr key={slot}>
                  <td className="p-2 align-top text-xs font-medium text-accent-900/55">
                    {SLOT_LABELS[slot]}
                  </td>
                  {weekDays.map((day) => {
                    const planDate = dateKey(day);
                    const entry = entryByCell.get(cellKey(planDate, slot));
                    const recipeTitle = entry?.recipe_id
                      ? recipeById.get(entry.recipe_id)?.title
                      : null;
                    const displayText = recipeTitle ?? entry?.free_text ?? "";
                    const isEditing =
                      editingCell?.planDate === planDate && editingCell?.slot === slot;

                    return (
                      <td key={planDate} className="p-1 align-top">
                        {isEditing ? (
                          <div className="w-56 rounded-md border border-neutral-300 bg-white p-2 shadow-sm">
                            <label className="mb-1 block text-xs font-medium text-accent-900/55">
                              Recipe
                            </label>
                            <select
                              value={editRecipeId}
                              onChange={(e) => {
                                setEditRecipeId(e.target.value);
                                if (e.target.value) setEditFreeText("");
                              }}
                              className="mb-2 w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500"
                            >
                              <option value="">None</option>
                              {recipes.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.title}
                                </option>
                              ))}
                            </select>
                            <label className="mb-1 block text-xs font-medium text-accent-900/55">
                              Or free text
                            </label>
                            <input
                              type="text"
                              value={editFreeText}
                              onChange={(e) => {
                                setEditFreeText(e.target.value);
                                if (e.target.value) setEditRecipeId("");
                              }}
                              placeholder="e.g. Leftovers"
                              className="mb-2 w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={closeEditor}
                                className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={saveCell}
                                className="rounded-md bg-accent-600 hover:bg-accent-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>

                            <div className="mt-3 border-t border-neutral-100 pt-2">
                              <label className="mb-1 block text-xs font-medium text-accent-900/55">
                                Add ingredients to grocery list
                              </label>
                              <textarea
                                value={ingredientsText}
                                onChange={(e) => setIngredientsText(e.target.value)}
                                rows={3}
                                placeholder={"One per line, e.g.\nGround beef\nTaco shells"}
                                className="mb-2 w-full rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-500"
                              />
                              <button
                                type="button"
                                onClick={addIngredientsToGroceryList}
                                disabled={addingIngredients || !ingredientsText.trim()}
                                className="w-full rounded-md border border-accent-200 px-2 py-1 text-xs font-medium text-accent-900/80 hover:bg-accent-50 disabled:opacity-50"
                              >
                                {addingIngredients ? "Adding..." : "+ Add to grocery list"}
                              </button>
                              {ingredientsMessage && (
                                <p className="mt-1 text-xs text-accent-900/55">{ingredientsMessage}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCellEditor(planDate, slot)}
                            className={`h-16 w-full rounded-md border border-accent-100 p-2 text-left text-xs hover:bg-neutral-50 ${
                              displayText ? "text-[var(--foreground)]" : "text-neutral-400"
                            }`}
                          >
                            {displayText || "+ Add"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
