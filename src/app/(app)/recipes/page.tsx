"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import { RecipeBrowser, type RecipeListItem } from "@/components/recipes/RecipeBrowser";

export default function RecipesPage() {
  useMarkModuleSeen("recipes");
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [ingredientText, setIngredientText] = useState<Record<string, string> | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("recipes")
        .select("id,title,description,servings,category,kosher_type")
        .order("title")
        .limit(5000);
      if (!mounted) return;
      setRecipes((data ?? []) as RecipeListItem[]);
      setLoading(false);

      // Loaded after the list renders so the page isn't blocked on it; the
      // API caps each response at 1000 rows, so page through.
      const byRecipe: Record<string, string> = {};
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data: rows, error } = await supabase
          .from("recipe_ingredients")
          .select("recipe_id,raw_text")
          .order("recipe_id")
          .order("id")
          .range(from, from + pageSize - 1);
        if (error || !rows) break;
        for (const row of rows as { recipe_id: string; raw_text: string }[]) {
          byRecipe[row.recipe_id] = `${byRecipe[row.recipe_id] ?? ""} ${row.raw_text}`;
        }
        if (rows.length < pageSize) break;
      }
      if (mounted) setIngredientText(byRecipe);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Recipes</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/recipes/import"
            className="text-sm text-accent-900/55 hover:underline"
          >
            Import from link
          </Link>
          <Link
            href="/recipes/new"
            className="rounded-md bg-accent-600 hover:bg-accent-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            + Add recipe
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-accent-900/55">Loading...</p>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-accent-900/55">No recipes yet.</p>
      ) : (
        <RecipeBrowser recipes={recipes} ingredientText={ingredientText} />
      )}
    </div>
  );
}
