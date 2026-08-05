import * as cheerio from "cheerio";

export interface ParsedRecipe {
  title: string;
  servings: string | null;
  imageUrl: string | null;
  ingredients: string[];
  steps: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonAny = any;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function flattenType(type: JsonAny): string[] {
  return asArray(type).map((t) => String(t));
}

// Recursively find every node that declares itself a schema.org Recipe,
// handling the three shapes sites actually use: a bare object, an array of
// objects, or a `@graph` wrapper (JSON-LD's way of bundling multiple
// entities in one <script> block).
function findRecipeNodes(node: JsonAny): JsonAny[] {
  if (!node || typeof node !== "object") return [];

  if (Array.isArray(node)) {
    return node.flatMap(findRecipeNodes);
  }

  const found: JsonAny[] = [];
  if (flattenType(node["@type"]).includes("Recipe")) {
    found.push(node);
  }
  if (node["@graph"]) {
    found.push(...findRecipeNodes(node["@graph"]));
  }
  return found;
}

function extractImageUrl(image: JsonAny): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractImageUrl(image[0]);
  if (typeof image === "object" && typeof image.url === "string") return image.url;
  return null;
}

function extractServings(recipeYield: JsonAny): string | null {
  if (!recipeYield) return null;
  if (Array.isArray(recipeYield)) return String(recipeYield[0] ?? "") || null;
  return String(recipeYield);
}

function extractIngredients(recipeIngredient: JsonAny): string[] {
  return asArray(recipeIngredient)
    .map((i) => (typeof i === "string" ? i.trim() : String(i ?? "").trim()))
    .filter(Boolean);
}

// recipeInstructions is the messiest field in the schema — sites emit a
// single string, an array of strings, an array of HowToStep objects, or
// HowToSection objects that nest their own itemListElement array of steps.
function extractSteps(recipeInstructions: JsonAny): string[] {
  if (!recipeInstructions) return [];

  if (typeof recipeInstructions === "string") {
    return recipeInstructions
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const items = asArray(recipeInstructions);
  const steps: string[] = [];

  for (const item of items) {
    if (typeof item === "string") {
      steps.push(item.trim());
      continue;
    }
    if (typeof item !== "object" || item === null) continue;

    const types = flattenType(item["@type"]);
    if (types.includes("HowToSection") && item.itemListElement) {
      steps.push(...extractSteps(item.itemListElement));
    } else if (typeof item.text === "string") {
      steps.push(item.text.trim());
    } else if (typeof item.name === "string") {
      steps.push(item.name.trim());
    }
  }

  return steps.filter(Boolean);
}

export async function parseRecipeFromJsonLd(url: string): Promise<ParsedRecipe | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const recipeNodes: JsonAny[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      const parsed = JSON.parse(raw);
      recipeNodes.push(...findRecipeNodes(parsed));
    } catch {
      // Some sites ship malformed/truncated JSON-LD — skip that block only.
    }
  });

  const node = recipeNodes[0];
  if (!node) return null;

  const ingredients = extractIngredients(node.recipeIngredient);
  const steps = extractSteps(node.recipeInstructions);
  const title = typeof node.name === "string" ? node.name.trim() : "";

  if (!title || ingredients.length === 0) {
    // Incomplete JSON-LD isn't useful enough to trust — let the caller fall
    // back to the LLM extraction pass instead of saving a half-empty recipe.
    return null;
  }

  return {
    title,
    servings: extractServings(node.recipeYield),
    imageUrl: extractImageUrl(node.image),
    ingredients,
    steps,
  };
}

// Used by the LLM-fallback path when JSON-LD parsing fails or is incomplete:
// strips the page down to readable text so it can be sent to the model.
export async function fetchReadableText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  // Cap length so we're not shipping an entire page (with ads/comments) to
  // the model — recipe content is almost always near the top of the article.
  return text.slice(0, 12000);
}
