"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KOSHER_TYPES, RECIPE_CATEGORIES, kosherMeta } from "@/lib/recipe-meta";
import type { KosherType, Recipe } from "@/lib/types";

export type RecipeListItem = Pick<
  Recipe,
  "id" | "title" | "description" | "servings" | "category" | "kosher_type"
>;

interface RecipeBrowserProps {
  recipes: RecipeListItem[];
  // recipe id -> all ingredient text lowercased, for searching by ingredient.
  // May still be loading (undefined) — search then matches title/category only.
  ingredientText?: Record<string, string>;
}

const STORAGE_KEY = "recipes-filters-v1";

function chipClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
    active
      ? "border-accent-600 bg-accent-600 text-white"
      : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
  }`;
}

export function RecipeBrowser({ recipes, ingredientText }: RecipeBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [kosher, setKosher] = useState<KosherType | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        setQuery(saved.query ?? "");
        setCategory(saved.category ?? null);
        setKosher(saved.kosher ?? null);
      }
    } catch {
      // no stored filters, or storage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query, category, kosher }));
    } catch {
      // storage unavailable
    }
  }, [query, category, kosher]);

  const tokens = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const searchable = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes) {
      map.set(
        r.id,
        `${r.title} ${r.category ?? ""} ${ingredientText?.[r.id] ?? ""}`.toLowerCase()
      );
    }
    return map;
  }, [recipes, ingredientText]);

  const matchesQuery = (r: RecipeListItem) => {
    if (tokens.length === 0) return true;
    const hay = searchable.get(r.id) ?? "";
    return tokens.every((t) => hay.includes(t));
  };

  // Counts on each chip reflect the other active filters, so a chip never
  // promises results the grid can't show.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      if (kosher && r.kosher_type !== kosher) continue;
      if (!matchesQuery(r)) continue;
      const key = r.category ?? "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, kosher, tokens, searchable]);

  const kosherCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      if (category && (r.category ?? "Other") !== category) continue;
      if (!matchesQuery(r)) continue;
      const key = r.kosher_type ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, category, tokens, searchable]);

  const filtered = useMemo(
    () =>
      recipes.filter((r) => {
        if (category && (r.category ?? "Other") !== category) return false;
        if (kosher && r.kosher_type !== kosher) return false;
        return matchesQuery(r);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipes, category, kosher, tokens, searchable]
  );

  const categories = useMemo(() => {
    const known: string[] = [...RECIPE_CATEGORIES];
    const extra = Array.from(new Set(recipes.map((r) => r.category ?? "Other"))).filter(
      (c) => !known.includes(c)
    );
    return [...known, ...extra].filter(
      (c) => recipes.some((r) => (r.category ?? "Other") === c)
    );
  }, [recipes]);

  const hasFilters = query !== "" || category !== null || kosher !== null;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 space-y-2 border-b border-accent-100 bg-[var(--background)] px-4 py-2 md:-mx-8 md:px-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${recipes.length} recipes by name or ingredient`}
          aria-label="Search recipes"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by meat, dairy or parve">
          <button type="button" onClick={() => setKosher(null)} className={chipClass(kosher === null)}>
            All
          </button>
          {KOSHER_TYPES.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKosher(kosher === k.value ? null : k.value)}
              className={chipClass(kosher === k.value)}
            >
              {k.label}{" "}
              <span className={kosher === k.value ? "text-white/80" : "text-neutral-400"}>
                {kosherCounts.get(k.value) ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0"
          role="group"
          aria-label="Filter by dish type"
        >
          <button type="button" onClick={() => setCategory(null)} className={chipClass(category === null)}>
            All dishes
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={chipClass(category === c)}
            >
              {c}{" "}
              <span className={category === c ? "text-white/80" : "text-neutral-400"}>
                {categoryCounts.get(c) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-accent-900/55">
        <span>
          {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
          {tokens.length > 0 && !ingredientText ? " (ingredient search still loading…)" : ""}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
              setKosher(null);
            }}
            className="hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-accent-900/55">No recipes match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => {
            const kosherInfo = kosherMeta(recipe.kosher_type);
            return (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <section className="h-full rounded-xl border border-accent-100 p-4 hover:bg-neutral-50">
                  <h2 className="font-medium text-[var(--foreground)]">{recipe.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {recipe.category && (
                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs text-accent-900/70">
                        {recipe.category}
                      </span>
                    )}
                    {kosherInfo && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${kosherInfo.badge}`}>
                        {kosherInfo.label}
                      </span>
                    )}
                  </div>
                  {recipe.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-accent-900/55">{recipe.description}</p>
                  )}
                  {recipe.servings && (
                    <p className="mt-1 text-sm text-accent-900/55">Servings: {recipe.servings}</p>
                  )}
                </section>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
