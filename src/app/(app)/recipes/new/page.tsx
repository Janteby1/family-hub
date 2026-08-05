"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";

export default function NewRecipePage() {
  const router = useRouter();
  const { member } = useCurrentMember();
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const steps = stepsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const ingredientLines = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        title: title.trim(),
        servings: servings.trim() || null,
        steps,
        created_by: member?.id ?? null,
      })
      .select()
      .single();

    if (recipeError || !recipe) {
      setError(recipeError?.message ?? "Failed to create recipe.");
      setSaving(false);
      return;
    }

    if (ingredientLines.length > 0) {
      const rows = ingredientLines.map((raw_text, index) => ({
        recipe_id: recipe.id,
        raw_text,
        sort_order: index,
      }));
      const { error: ingredientsError } = await supabase
        .from("recipe_ingredients")
        .insert(rows);
      if (ingredientsError) {
        setError(ingredientsError.message);
        setSaving(false);
        return;
      }
    }

    router.push(`/recipes/${recipe.id}`);
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--foreground)]">Add Recipe</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <section className="rounded-xl border border-accent-100 p-4">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="e.g. Sunday Roast Chicken"
          />
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            Servings (optional)
          </label>
          <input
            type="text"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="e.g. 4"
          />
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Ingredients</label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder={"One ingredient per line, e.g.\n2 cups flour\n1 tsp salt\n3 eggs"}
          />
        </section>

        <section className="rounded-xl border border-accent-100 p-4">
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Steps</label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder={"One step per line, e.g.\nPreheat oven to 400F\nSeason the chicken\nRoast for 1 hour"}
          />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save recipe"}
          </button>
        </div>
      </form>
    </div>
  );
}
