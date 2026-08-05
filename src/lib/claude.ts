import Anthropic from "@anthropic-ai/sdk";

// Server-only. Never import this into a "use client" component — the API
// key must never reach the browser.
export function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Both AI-assisted features in this app (recipe-import LLM fallback, and
// photo-to-event extraction) are simple structured-extraction tasks well
// within a small/cheap model's ability, which keeps the household's
// per-use API cost negligible.
export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";
