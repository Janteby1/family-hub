"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import type { Recipe, RecipeIngredient } from "@/lib/types";

export function RecipeDetailClient({ recipeId }: { recipeId: string }) {
  const { member } = useCurrentMember();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToList, setAddingToList] = useState(false);
  const [addResultMessage, setAddResultMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const [{ data: recipeRow }, { data: ingredientRows }] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle(),
        supabase
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("sort_order")
          .order("id"),
      ]);
      if (mounted) {
        setRecipe((recipeRow ?? null) as Recipe | null);
        setIngredients((ingredientRows ?? []) as RecipeIngredient[]);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [recipeId]);

  async function handleAddToGroceryList() {
    setAddingToList(true);
    setAddResultMessage(null);
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
        setAddResultMessage(createListError?.message ?? "Failed to create grocery list.");
        setAddingToList(false);
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
    for (const ingredient of ingredients) {
      const normalized = ingredient.raw_text.trim().toLowerCase();
      if (existingLabels.has(normalized)) continue;
      existingLabels.add(normalized);
      rowsToInsert.push({
        list_id: groceryList.id,
        label: ingredient.raw_text,
        normalized_label: normalized,
        added_by_member_id: member?.id ?? null,
        source: "recipe_import" as const,
        source_recipe_id: recipeId,
      });
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("list_items").insert(rowsToInsert);
      if (insertError) {
        setAddResultMessage(insertError.message);
        setAddingToList(false);
        return;
      }
    }

    setAddResultMessage(
      rowsToInsert.length > 0
        ? `Added ${rowsToInsert.length} ingredient${rowsToInsert.length === 1 ? "" : "s"} to Grocery List`
        : "All ingredients were already on the list"
    );
    setAddingToList(false);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-accent-900/55">Loading...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-accent-900/55">Recipe not found.</p>
        <Link href="/recipes" className="mt-2 inline-block text-sm text-accent-900/55 hover:underline">
          Back to recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <Link href="/recipes" className="mb-4 inline-block text-sm text-accent-900/55 hover:underline">
        Back to recipes
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-[var(--foreground)]">{recipe.title}</h1>
      {recipe.servings && (
        <p className="mb-6 text-sm text-accent-900/55">Servings: {recipe.servings}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-accent-100 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium text-[var(--foreground)]">Ingredients</h2>
          </div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-neutral-400">No ingredients listed.</p>
          ) : (
            <ul className="space-y-1 text-sm text-neutral-700">
              {ingredients.map((ingredient) => (
                <li key={ingredient.id}>{ingredient.raw_text}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={handleAddToGroceryList}
              disabled={addingToList || ingredients.length === 0}
              className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {addingToList ? "Adding..." : "Add ingredients to grocery list"}
            </button>
            {addResultMessage && (
              <p className="mt-2 text-sm text-accent-900/55">{addResultMessage}</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <h2 className="mb-2 font-medium text-[var(--foreground)]">Steps</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-sm text-neutral-400">No steps listed.</p>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-neutral-700">
              {recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
