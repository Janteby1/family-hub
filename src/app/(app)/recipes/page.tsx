"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMarkModuleSeen } from "@/hooks/useMarkModuleSeen";
import type { Recipe } from "@/lib/types";

export default function RecipesPage() {
  useMarkModuleSeen("recipes");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("recipes")
        .select("*")
        .order("title");
      if (mounted) {
        setRecipes((data ?? []) as Recipe[]);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
              <section className="rounded-xl border border-accent-100 p-4 hover:bg-neutral-50">
                <h2 className="font-medium text-[var(--foreground)]">{recipe.title}</h2>
                {recipe.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-accent-900/55">{recipe.description}</p>
                )}
                {recipe.servings && (
                  <p className="mt-1 text-sm text-accent-900/55">Servings: {recipe.servings}</p>
                )}
              </section>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
