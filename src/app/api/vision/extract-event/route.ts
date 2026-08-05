import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, EXTRACTION_MODEL } from "@/lib/claude";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

const EXTRACT_EVENT_TOOL = {
  name: "extract_event",
  description: "Extract calendar event details from a photo of a flyer, invite, or notice.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      date: { type: "string" as const, description: "ISO 8601 date, YYYY-MM-DD, if stated" },
      time: { type: "string" as const, description: "24-hour HH:MM, if stated" },
      location: { type: "string" as const },
      confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
      notes: { type: "string" as const, description: "Anything else useful, e.g. 'bring $5'" },
    },
    required: ["title", "confidence"],
  },
};

// This route only ever extracts and returns data — it has no database
// access at all, so there is no code path where a bad OCR read becomes a
// real calendar event without a human reviewing and saving it themselves.
export async function POST(request: NextRequest) {
  const { imageBase64, mediaType } = await request.json();

  if (typeof imageBase64 !== "string" || !imageBase64) {
    return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      tools: [EXTRACT_EVENT_TOOL],
      tool_choice: { type: "tool", name: "extract_event" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as AllowedMediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: "Extract the event details from this photo." },
          ],
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Couldn't read an event from that photo." }, { status: 422 });
    }

    return NextResponse.json({ event: toolUse.input });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
