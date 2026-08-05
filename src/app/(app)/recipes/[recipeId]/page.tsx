import { RecipeDetailClient } from "@/components/recipes/RecipeDetailClient";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await params;
  return <RecipeDetailClient recipeId={recipeId} />;
}
