import type { KosherType } from "@/lib/types";

export const RECIPE_CATEGORIES = [
  "Breakfast",
  "Appetizers",
  "Soups",
  "Salads",
  "Pasta",
  "Mains",
  "Sides",
  "Sauces & Condiments",
  "Baking",
  "Desserts",
  "Snacks",
  "Drinks",
  "Meal Prep",
] as const;

export const KOSHER_TYPES: { value: KosherType; label: string; badge: string }[] = [
  { value: "meat", label: "Meat", badge: "bg-red-100 text-red-800" },
  { value: "dairy", label: "Dairy", badge: "bg-sky-100 text-sky-800" },
  { value: "parve", label: "Parve / Fish", badge: "bg-emerald-100 text-emerald-800" },
];

export function kosherMeta(type: KosherType | null | undefined) {
  return KOSHER_TYPES.find((k) => k.value === type) ?? null;
}
