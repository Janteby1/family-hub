"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentMember } from "@/hooks/useCurrentMember";

export default function ImportRecipePage() {
  const router = useRouter();
  const { member } = useCurrentMember();

  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchMethod, setFetchMethod] = useState<"jsonld" | "llm" | "none" | null>(null);

  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [imported, setImported] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setFetching(true);
    setFetchError(null);
    setImported(false);

    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error ?? "Import failed.");
        return;
      }

      setFetchMethod(data.method);

      if (!data.recipe) {
        setFetchError(
          "Couldn't find a recipe on that page. You can still fill this in manually below, or try a different link."
        );
        return;
      }

      setTitle(data.recipe.title ?? "");
      setServings(data.recipe.servings ?? "");
      setIngredientsText((data.recipe.ingredients ?? []).join("\n"));
      setStepsText((data.recipe.steps ?? []).join("\n"));
      setImported(true);
    } catch {
      setFetchError("Import failed. Check the link and try again.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const steps = stepsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const ingredientLines = ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        title: title.trim(),
        servings: servings.trim() || null,
        source_url: url.trim() || null,
        steps,
        created_by: member?.id ?? null,
      })
      .select()
      .single();

    if (recipeError || !recipe) {
      setSaveError(recipeError?.message ?? "Failed to create recipe.");
      setSaving(false);
      return;
    }

    if (ingredientLines.length > 0) {
      const rows = ingredientLines.map((raw_text, index) => ({
        recipe_id: recipe.id,
        raw_text,
        sort_order: index,
      }));
      const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(rows);
      if (ingredientsError) {
        setSaveError(ingredientsError.message);
        setSaving(false);
        return;
      }
    }

    router.push(`/recipes/${recipe.id}`);
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Import Recipe</h1>

      <form onSubmit={handleFetch} className="mb-6 max-w-2xl rounded-xl border border-neutral-200 p-4">
        <label className="mb-1 block text-sm font-medium text-neutral-900">Recipe URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some-recipe"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={fetching || !url.trim()}
            className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {fetching ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {fetchError && <p className="mt-2 text-sm text-red-600">{fetchError}</p>}
        {imported && (
          <p className="mt-2 text-sm text-green-700">
            Extracted from the page{fetchMethod === "llm" ? " (AI-assisted, please double-check)" : ""}
            — review and edit below before saving.
          </p>
        )}
      </form>

      <form onSubmit={handleSave} className="max-w-2xl space-y-4">
        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder="e.g. Sunday Roast Chicken"
          />
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">
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

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Ingredients</label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder={"One ingredient per line, e.g.\n2 cups flour\n1 tsp salt\n3 eggs"}
          />
        </section>

        <section className="rounded-xl border border-neutral-200 p-4">
          <label className="mb-1 block text-sm font-medium text-neutral-900">Steps</label>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            placeholder={"One step per line, e.g.\nPreheat oven to 400F\nSeason the chicken\nRoast for 1 hour"}
          />
        </section>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save recipe"}
          </button>
        </div>
      </form>
    </div>
  );
}
