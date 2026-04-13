import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/types";
import { aiRateLimit } from "@/lib/redis";
import type { OCRResult, Category } from "@/lib/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini direct models (current GA stable — 2.5-flash is Google's recommended workhorse)
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

// OpenRouter free vision-capable models (fallback)
const OPENROUTER_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-4-26b-a4b-it:free",
];

const VALID_CATEGORIES = CATEGORIES.map((c) => c.name);

function sanitizeCategory(raw: string | null | undefined): Category | null {
  if (!raw) return null;
  const match = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );
  return (match as Category) ?? null;
}

function parseOCRResponse(content: string): OCRResult | null {
  try {
    const jsonStr = content.replace(/```json?\n?|```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      date:
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
          ? parsed.date
          : null,
      category: sanitizeCategory(parsed.category),
      description: typeof parsed.description === "string" ? parsed.description : null,
      line_items: Array.isArray(parsed.line_items)
        ? parsed.line_items
            .filter(
              (li: { description?: string; amount?: number }) =>
                typeof li.description === "string" && typeof li.amount === "number"
            )
            .slice(0, 50)
        : [],
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      raw_text: typeof parsed.raw_text === "string" ? parsed.raw_text.slice(0, 5000) : "",
    };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a receipt OCR assistant. Extract structured data from receipt images.
Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "amount": <number or null>,
  "vendor": "<string or null>",
  "date": "<YYYY-MM-DD or null>",
  "category": "<one of: ${VALID_CATEGORIES.join(", ")} or null>",
  "description": "<brief description or null>",
  "line_items": [{"description": "<string>", "amount": <number>}],
  "confidence": <0.0 to 1.0>,
  "raw_text": "<all readable text from receipt>"
}
If the image is not a receipt, set confidence to 0.1 and fill what you can.`;

async function tryGemini(base64: string, mimeType: string): Promise<{ result: OCRResult | null; error: string | null }> {
  if (!GEMINI_API_KEY) return { result: null, error: "No Gemini API key" };

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

        const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `${SYSTEM_PROMPT}\n\nExtract all receipt data from this image.` },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) {
          const err = await res.text();
          if (res.status === 429) return { result: null, error: `Gemini rate limited: ${model}` };
          console.warn(`Gemini ${model} attempt ${attempt}: ${res.status} ${err.slice(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) continue;

        const result = parseOCRResponse(content);
        if (result) return { result, error: null };
      } catch (e) {
        console.warn(`Gemini ${model} attempt ${attempt}: ${e instanceof Error ? e.message : "Unknown"}`);
        continue;
      }
    }
  }
  return { result: null, error: "All Gemini models failed" };
}

async function tryOpenRouter(dataUrl: string): Promise<{ result: OCRResult | null; error: string | null }> {
  if (!OPENROUTER_API_KEY) return { result: null, error: "No OpenRouter API key" };

  for (const model of OPENROUTER_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

        const res = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "ExpenseVision OCR",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: dataUrl } },
                  { type: "text", text: "Extract all receipt data from this image." },
                ],
              },
            ],
            max_tokens: 1024,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) {
          const err = await res.text();
          if (res.status === 429) continue;
          console.warn(`OpenRouter ${model} attempt ${attempt}: ${res.status} ${err.slice(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) continue;

        const result = parseOCRResponse(content);
        if (result) return { result, error: null };
      } catch (e) {
        console.warn(`OpenRouter ${model} attempt ${attempt}: ${e instanceof Error ? e.message : "Unknown"}`);
        continue;
      }
    }
  }
  return { result: null, error: "All OpenRouter models failed" };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (skipped if Upstash not configured)
    if (aiRateLimit) {
      const { success } = await aiRateLimit.limit(user.id);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 }
        );
      }
    }

    if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OCR service not configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type and size
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 10 MB" },
        { status: 400 }
      );
    }

    // Convert to base64 for vision APIs
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Try Gemini first (direct API — best quality + structured JSON output)
    let ocrResult: OCRResult | null = null;
    let lastError: string | null = null;

    const geminiAttempt = await tryGemini(base64, file.type);
    if (geminiAttempt.result) {
      ocrResult = geminiAttempt.result;
    } else {
      lastError = geminiAttempt.error;
      // Fallback to OpenRouter
      const openRouterAttempt = await tryOpenRouter(dataUrl);
      if (openRouterAttempt.result) {
        ocrResult = openRouterAttempt.result;
      } else {
        lastError = openRouterAttempt.error;
      }
    }

    if (!ocrResult) {
      console.error("OCR failed with all providers:", lastError);
      const isRateLimit = lastError?.includes("rate") || lastError?.includes("429");
      return NextResponse.json(
        {
          error: isRateLimit
            ? "OCR service is temporarily rate-limited. Please wait a minute and try again."
            : "OCR processing failed after multiple attempts. Please try a clearer image or try again later.",
        },
        { status: 502 }
      );
    }

    // Optionally store receipt in Supabase Storage
    try {
      const rawExt = file.name.split(".").pop() || "jpg";
      const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      await supabase.storage
        .from("receipts")
        .upload(filePath, file, { contentType: file.type, upsert: false });
    } catch {
      // Storage upload is optional — don't fail the OCR response
    }

    return NextResponse.json(ocrResult);
  } catch (error) {
    console.error("POST /api/ocr error:", error);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    );
  }
}
