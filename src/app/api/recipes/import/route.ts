import { NextRequest, NextResponse } from "next/server";
import { parseRecipeFromJsonLd, fetchReadableText } from "@/lib/recipe-parser/jsonld";
import { parseRecipeWithLlm } from "@/lib/recipe-parser/llm-fallback";

// Extracts a recipe from a URL and returns it for the user to review/edit —
// this route never writes to the database. JSON-LD is tried first (no AI
// cost, covers most recipe sites); the LLM fallback only runs if that fails
// or comes back incomplete.
export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const fromJsonLd = await parseRecipeFromJsonLd(url);
    if (fromJsonLd) {
      return NextResponse.json({ recipe: fromJsonLd, method: "jsonld" });
    }

    const pageText = await fetchReadableText(url);
    const fromLlm = await parseRecipeWithLlm(pageText);
    if (fromLlm) {
      return NextResponse.json({ recipe: fromLlm, method: "llm" });
    }

    return NextResponse.json({ recipe: null, method: "none" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
