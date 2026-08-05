import { getAnthropicClient, EXTRACTION_MODEL } from "@/lib/claude";
import type { ParsedRecipe } from "@/lib/recipe-parser/jsonld";

const EXTRACT_RECIPE_TOOL = {
  name: "extract_recipe",
  description: "Extract a structured recipe from raw page text.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      servings: { type: "string" as const, description: "e.g. '4 servings', or omit if not stated" },
      ingredients: { type: "array" as const, items: { type: "string" as const } },
      steps: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["title", "ingredients", "steps"],
  },
};

export async function parseRecipeWithLlm(pageText: string): Promise<ParsedRecipe | null> {
  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1536,
    tools: [EXTRACT_RECIPE_TOOL],
    tool_choice: { type: "tool", name: "extract_recipe" },
    messages: [
      {
        role: "user",
        content: `Extract the recipe (title, servings if stated, ingredients, and steps) from this page text. Ignore ads, comments, and unrelated navigation text.\n\n${pageText}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const input = toolUse.input as {
    title?: string;
    servings?: string;
    ingredients?: string[];
    steps?: string[];
  };

  if (!input.title || !input.ingredients?.length) return null;

  return {
    title: input.title,
    servings: input.servings ?? null,
    imageUrl: null,
    ingredients: input.ingredients,
    steps: input.steps ?? [],
  };
}
