import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistReceiptRecord } from "@/lib/receipt-records";
import { CATEGORIES } from "@/lib/types";
import { aiRateLimit } from "@/lib/redis";
import {
  buildReceiptStoragePath,
  inferReceiptMimeType,
  isReceiptStoragePath,
  validateReceiptFile,
  validateReceiptFileBytes,
} from "@/lib/receipts";
import type {
  OCRResult,
  Category,
  ReceiptLifecycleStatus,
  ReceiptProcessingResult,
  ReceiptRecoveryAction,
} from "@/lib/types";

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

const EMPTY_OCR_RESULT: OCRResult = {
  amount: null,
  vendor: null,
  date: null,
  category: null,
  description: null,
  line_items: [],
  confidence: 0,
  raw_text: "",
  receipt_path: null,
};

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
      receipt_path: null,
    };
  } catch {
    return null;
  }
}

function buildProcessingResult(
  ocrResult: OCRResult | null,
  {
    receiptPath,
    uploadStatus,
    ocrStatus,
    warning,
    error,
    recoveryActions = [],
    status,
  }: {
    receiptPath: string | null;
    uploadStatus: ReceiptLifecycleStatus;
    ocrStatus: ReceiptLifecycleStatus;
    warning?: string | null;
    error?: string | null;
    recoveryActions?: ReceiptRecoveryAction[];
    status?: ReceiptProcessingResult["status"];
  }
): ReceiptProcessingResult {
  return {
    ...(ocrResult ?? EMPTY_OCR_RESULT),
    receipt_path: receiptPath,
    status:
      status ??
      (error && uploadStatus === "failed" && ocrStatus === "failed"
        ? "error"
        : warning || error || uploadStatus === "failed" || ocrStatus === "failed"
          ? "partial"
          : "success"),
    upload_status: uploadStatus,
    ocr_status: ocrStatus,
    warning: warning ?? null,
    error: error ?? null,
    recovery_actions: recoveryActions,
  };
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
    const fileEntry = formData.get("file");
    const storedReceiptPathEntry = formData.get("receipt_path");
    const providedReceiptPath =
      typeof storedReceiptPathEntry === "string" && storedReceiptPathEntry.length > 0
        ? storedReceiptPathEntry
        : null;
    const incomingFile = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    if (!incomingFile && !providedReceiptPath) {
      return NextResponse.json({ error: "No file or stored receipt provided" }, { status: 400 });
    }

    if (providedReceiptPath && !isReceiptStoragePath(providedReceiptPath)) {
      return NextResponse.json(
        { error: "Invalid stored receipt path" },
        { status: 400 }
      );
    }

    if (incomingFile) {
      const validationError = validateReceiptFile(incomingFile);

      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    let file = incomingFile;

    if (!file && providedReceiptPath) {
      const { data: storedFile, error: downloadError } = await supabase.storage
        .from("receipts")
        .download(providedReceiptPath);

      if (downloadError || !storedFile) {
        return NextResponse.json(
          { error: "Stored receipt could not be loaded. Please upload it again." },
          { status: 404 }
        );
      }

      const storedFileName = providedReceiptPath.split("/").pop() ?? "receipt.jpg";
      file = new File([await storedFile.arrayBuffer()], storedFileName, {
        type: storedFile.type || inferReceiptMimeType(storedFileName),
      });
    }

    if (!file) {
      return NextResponse.json({ error: "No file available for OCR" }, { status: 400 });
    }

    let receiptStoragePath = providedReceiptPath;
    let uploadStatus: ReceiptLifecycleStatus = providedReceiptPath ? "skipped" : "failed";
    let uploadWarning: string | null = null;

    if (!receiptStoragePath && incomingFile) {
      try {
        const filePath = buildReceiptStoragePath(user.id, incomingFile.name);
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(filePath, incomingFile, { contentType: incomingFile.type, upsert: false });

        if (uploadError) {
          uploadWarning = "Receipt file could not be uploaded. You can retry upload or save without attaching the receipt.";
          uploadStatus = "failed";
        } else {
          receiptStoragePath = filePath;
          uploadStatus = "succeeded";
          await persistReceiptRecord(supabase, user.id, filePath, null);
        }
      } catch {
        if (receiptStoragePath) {
          uploadWarning = "Receipt uploaded, but receipt metadata could not be saved yet.";
          uploadStatus = "succeeded";
        } else {
          uploadWarning = "Receipt file could not be uploaded. You can retry upload or save without attaching the receipt.";
          uploadStatus = "failed";
        }
      }
    }

    const bytes = await file.arrayBuffer();

    // Server-side magic-byte validation — reject mismatched file content
    const byteValidationError = validateReceiptFileBytes(bytes, file.type);
    if (byteValidationError) {
      return NextResponse.json({ error: byteValidationError }, { status: 400 });
    }

    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

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
      const isRateLimit = lastError?.includes("rate") || lastError?.includes("429");
      const failureMessage = isRateLimit
        ? "OCR service is temporarily rate-limited. Please wait a minute and try again."
        : "OCR processing failed after multiple attempts. Please try a clearer image or try again later.";

      if (receiptStoragePath) {
        try {
          await persistReceiptRecord(supabase, user.id, receiptStoragePath, null);
        } catch {
        }

        return NextResponse.json(
          buildProcessingResult(null, {
            receiptPath: receiptStoragePath,
            uploadStatus,
            ocrStatus: "failed",
            warning: uploadWarning,
            error: failureMessage,
            recoveryActions: ["retry_ocr", "save_manually"],
            status: "partial",
          })
        );
      }

      console.error("OCR failed with all providers:", lastError);

      return NextResponse.json(
        buildProcessingResult(null, {
          receiptPath: null,
          uploadStatus,
          ocrStatus: "failed",
          warning: uploadWarning,
          error: failureMessage,
          recoveryActions: ["retry_ocr", "retry_upload", "save_manually"],
          status: "error",
        }),
        { status: 502 }
      );
    }

    if (receiptStoragePath) {
      try {
        await persistReceiptRecord(supabase, user.id, receiptStoragePath, ocrResult);
      } catch {
        uploadWarning = uploadWarning ?? "Receipt uploaded, but receipt metadata could not be saved yet.";
      }
    }

    return NextResponse.json(
      buildProcessingResult(
        {
          ...ocrResult,
          receipt_path: receiptStoragePath,
        },
        {
          receiptPath: receiptStoragePath,
          uploadStatus,
          ocrStatus: "succeeded",
          warning: uploadStatus === "failed" ? uploadWarning : uploadWarning,
          recoveryActions: uploadStatus === "failed" ? ["retry_upload", "save_manually"] : [],
          status: uploadStatus === "failed" || uploadWarning ? "partial" : "success",
        }
      )
    );
  } catch (error) {
    console.error("POST /api/ocr error:", error);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    );
  }
}
