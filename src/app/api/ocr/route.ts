import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import { persistReceiptRecord } from "@/lib/receipt-records";
import { CATEGORIES } from "@/lib/types";
import { suggestCategory } from "@/lib/category-suggest";
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
const VERYFI_CLIENT_ID = process.env.VERYFI_CLIENT_ID;
const VERYFI_API_KEY = process.env.VERYFI_API_KEY;
const VERYFI_USERNAME = process.env.VERYFI_USERNAME;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const VERYFI_URL = "https://api.veryfi.com/api/v8/partner/documents";
const APP_URL = getAppUrl();
const HAS_VERYFI_CONFIG = Boolean(VERYFI_CLIENT_ID && VERYFI_API_KEY && VERYFI_USERNAME);
const HAS_GEMINI_CONFIG = Boolean(GEMINI_API_KEY);
const HAS_OPENROUTER_CONFIG = Boolean(OPENROUTER_API_KEY);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedValue(source: unknown, path: string[]): unknown {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return null;
    }

    current = current[key];
  }

  return current;
}

function firstNonEmpty<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (typeof value === "string") {
      if (value.trim()) {
        return value as T;
      }

      continue;
    }

    if (value != null) {
      return value;
    }
  }

  return null;
}

function readFieldValue(value: unknown): unknown {
  if (isRecord(value) && "value" in value) {
    return value.value;
  }

  return value;
}

function coerceString(value: unknown): string | null {
  const candidate = readFieldValue(value);

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return String(candidate);
  }

  return null;
}

function coerceNumber(value: unknown): number | null {
  const candidate = readFieldValue(value);

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate !== "string") {
    return null;
  }

  let normalized = candidate.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(/,/g, ".");
  }

  normalized = normalized.replace(/[^0-9.-]/g, "");

  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatCalendarDate(year: number, month: number, day: number) {
  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function coerceDate(value: unknown): string | null {
  const candidate = coerceString(value);

  if (!candidate) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return candidate;
  }

  const isoDateTimeMatch = candidate.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoDateTimeMatch) {
    return isoDateTimeMatch[1];
  }

  const normalized = candidate.replace(/[.]/g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 3) {
    const [first, second, third] = parts;

    if (first.length === 4) {
      const year = Number(first);
      const month = Number(second);
      const day = Number(third);
      return formatCalendarDate(year, month, day);
    }

    if (third.length === 4) {
      const year = Number(third);
      const firstPart = Number(first);
      const secondPart = Number(second);

      if (firstPart > 12) {
        return formatCalendarDate(year, secondPart, firstPart);
      }

      if (secondPart > 12) {
        return formatCalendarDate(year, firstPart, secondPart);
      }

      return formatCalendarDate(year, firstPart, secondPart);
    }
  }

  const timestamp = Date.parse(candidate);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function coerceConfidence(value: unknown): number | null {
  const candidate = coerceNumber(value);

  if (candidate == null) {
    return null;
  }

  const normalized = candidate > 1 && candidate <= 100 ? candidate / 100 : candidate;
  return Math.max(0, Math.min(1, normalized));
}

function averageConfidence(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value != null);

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function coerceLineItems(value: unknown): { description: string; amount: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const description = firstNonEmpty(
        coerceString(item.description),
        coerceString(item.name),
        coerceString(item.text),
        coerceString(item.item),
        coerceString(item.product)
      );
      const amount = firstNonEmpty(
        coerceNumber(item.amount),
        coerceNumber(item.total),
        coerceNumber(item.price),
        coerceNumber(item.cost),
        coerceNumber(item.line_total)
      );

      if (!description || amount == null) {
        return null;
      }

      return { description, amount };
    })
    .filter((item): item is { description: string; amount: number } => Boolean(item))
    .slice(0, 50);
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (isRecord(part)) {
        return coerceString(part.text);
      }

      return null;
    })
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim();

  return text || null;
}

function extractJsonObjectCandidate(content: string): string | null {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fencedMatch?.[1] ?? content).trim();

  if (source.startsWith("{") && source.endsWith("}")) {
    return source;
  }

  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;

      if (depth === 0 && startIndex >= 0) {
        return source.slice(startIndex, index + 1).trim();
      }
    }
  }

  return null;
}

function normalizeOCRPayload(parsed: Record<string, unknown>, rawContentFallback = ""): OCRResult | null {
  const amount = firstNonEmpty(coerceNumber(parsed.amount), coerceNumber(parsed.total));
  const vendor = firstNonEmpty(
    coerceString(parsed.vendor),
    coerceString(parsed.merchant),
    coerceString(parsed.store),
    coerceString(parsed.vendor_name)
  );
  const date = firstNonEmpty(
    coerceDate(parsed.date),
    coerceDate(parsed.transaction_date),
    coerceDate(parsed.purchase_date)
  );
  const category = sanitizeCategory(
    firstNonEmpty(coerceString(parsed.category), coerceString(parsed.default_category))
  );
  const description = firstNonEmpty(
    coerceString(parsed.description),
    coerceString(parsed.summary),
    coerceString(parsed.notes)
  );
  const line_items = coerceLineItems(parsed.line_items);
  const raw_text = firstNonEmpty(
    coerceString(parsed.raw_text),
    coerceString(parsed.ocr_text),
    rawContentFallback.trim()
  )?.slice(0, 5000) ?? "";
  const confidence =
    coerceConfidence(parsed.confidence) ??
    (amount != null || vendor || date || line_items.length > 0 || raw_text ? 0.6 : 0.25);

  if (!amount && !vendor && !date && !description && line_items.length === 0 && !raw_text) {
    return null;
  }

  return {
    amount,
    vendor,
    date,
    category,
    description,
    line_items,
    confidence,
    raw_text,
    receipt_path: null,
  };
}

function coerceVendor(value: unknown): string | null {
  if (!isRecord(value)) {
    return coerceString(value);
  }

  return firstNonEmpty(
    coerceString(value.name),
    coerceString(value.vendor),
    coerceString(value.display_name),
    coerceString(value.value),
    coerceString(value.raw_value)
  );
}

function parseVeryfiResponse(payload: unknown): OCRResult | null {
  if (!isRecord(payload)) {
    return null;
  }

  const meta = getNestedValue(payload, ["meta"]);
  const amount = firstNonEmpty(
    coerceNumber(getNestedValue(meta, ["total"])),
    coerceNumber(getNestedValue(payload, ["total"])),
    coerceNumber(getNestedValue(meta, ["final_balance"])),
    coerceNumber(getNestedValue(meta, ["subtotal"]))
  );
  const vendor = firstNonEmpty(
    coerceVendor(getNestedValue(meta, ["vendor"])),
    coerceVendor(getNestedValue(payload, ["vendor"])),
    Array.isArray(payload.vendors) ? coerceVendor(payload.vendors[0]) : null
  );
  const date = firstNonEmpty(
    coerceDate(getNestedValue(meta, ["date"])),
    coerceDate(getNestedValue(payload, ["date"])),
    coerceDate(getNestedValue(meta, ["order_date"])),
    coerceDate(getNestedValue(payload, ["created_date"]))
  );
  const category = sanitizeCategory(
    firstNonEmpty(
      coerceString(getNestedValue(meta, ["default_category"])),
      coerceString(getNestedValue(meta, ["category"])),
      coerceString(getNestedValue(payload, ["category"]))
    )
  );
  const description = firstNonEmpty(
    coerceString(getNestedValue(meta, ["document_title"])),
    coerceString(getNestedValue(payload, ["notes"])),
    vendor ? `Receipt from ${vendor}` : null
  );
  const line_items = coerceLineItems(getNestedValue(payload, ["line_items"]));
  const raw_text =
    firstNonEmpty(
      coerceString(getNestedValue(payload, ["ocr_text"])),
      coerceString(getNestedValue(meta, ["ocr_text"]))
    )?.slice(0, 5000) ?? "";
  const confidence =
    averageConfidence([
      coerceConfidence(getNestedValue(meta, ["total", "score"])),
      coerceConfidence(getNestedValue(meta, ["vendor", "score"])),
      coerceConfidence(getNestedValue(meta, ["date", "score"])),
    ]) ?? (amount != null || vendor || date ? 0.85 : 0.55);

  if (!amount && !vendor && !date && !description && line_items.length === 0 && !raw_text) {
    return null;
  }

  return {
    amount,
    vendor,
    date,
    category,
    description,
    line_items,
    confidence,
    raw_text,
    receipt_path: null,
  };
}

function parseOCRResponse(content: string): OCRResult | null {
  const jsonCandidate = extractJsonObjectCandidate(content);

  if (!jsonCandidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonCandidate);

    if (!isRecord(parsed)) {
      return null;
    }

    return normalizeOCRPayload(parsed, content);
  } catch {
    return null;
  }
}

function joinWarnings(...messages: Array<string | null | undefined>) {
  const parts = messages
    .map((message) => message?.trim())
    .filter((message): message is string => Boolean(message));

  return parts.length > 0 ? parts.join(" ") : null;
}

function vendorLooksSuspicious(vendor: string | null) {
  if (!vendor) {
    return false;
  }

  const normalized = vendor.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const hasDigit = /\d/.test(normalized);
  const letters = (normalized.match(/[A-Za-z]/g) ?? []).length;
  const digits = (normalized.match(/\d/g) ?? []).length;
  const uppercaseCodeLike = /^[A-Z0-9\s-]+$/.test(normalized);

  return (
    (normalized.length <= 10 && hasDigit && words.length <= 2) ||
    (uppercaseCodeLike && digits > 0 && letters > 0 && letters <= 5) ||
    (words.length === 1 && normalized.length <= 8 && hasDigit)
  );
}

function receiptIncludesAdjustments(rawText: string) {
  return /(offer|discount|coupon|deduction|promotion|savings)/i.test(rawText);
}

function applyCategoryAndNotesInference(result: OCRResult): OCRResult {
  let category = result.category;
  if (!category) {
    category = suggestCategory(result.vendor?.trim() ?? "", result.raw_text ?? "").category;
  }

  let description = result.description;
  if (!description?.trim() && result.vendor?.trim()) {
    description = `Receipt from ${result.vendor.trim()}`;
  }

  return {
    ...result,
    category,
    description,
  };
}

function refineOCRResult(result: OCRResult) {
  const warnings: string[] = [];
  let confidence = result.confidence;

  if (!result.vendor) {
    warnings.push("Merchant could not be extracted confidently. Please enter or confirm it before saving.");
    confidence = Math.min(confidence, 0.45);
  } else if (vendorLooksSuspicious(result.vendor)) {
    warnings.push("Merchant may be partially obscured or misread from the receipt image. Please confirm it before saving.");
    confidence = Math.min(confidence, 0.58);
  }

  if (result.amount == null) {
    warnings.push("Amount could not be extracted confidently. Please verify it against the receipt image.");
    confidence = Math.min(confidence, 0.45);
  }

  if (!result.date) {
    warnings.push("Purchase date could not be extracted confidently. Please verify the date before saving.");
    confidence = Math.min(confidence, 0.45);
  }

  if (receiptIncludesAdjustments(result.raw_text)) {
    warnings.push("This receipt appears to include an offer or deduction. Confirm the final charged amount before saving.");
    confidence = Math.min(confidence, 0.64);
  }

  return {
    result: {
      ...result,
      confidence: Math.max(0, Math.min(1, confidence)),
    },
    warning: warnings.length > 0 ? warnings.join(" ") : null,
  };
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
  if (!HAS_GEMINI_CONFIG || !GEMINI_API_KEY) return { result: null, error: "No Gemini API key" };

  const errors: string[] = [];

  for (const model of GEMINI_MODELS) {
    try {
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
        const message =
          res.status === 429
            ? `Gemini rate limited: ${model}`
            : `Gemini ${model}: ${res.status} ${err.slice(0, 200)}`;
        console.warn(message);
        errors.push(message);
        continue;
      }

      const data = await res.json();
      const content = extractTextContent(data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text));
      if (!content) {
        errors.push(`Gemini ${model}: empty response`);
        continue;
      }

      const result = parseOCRResponse(content);
      if (result) {
        return { result, error: null };
      }

      errors.push(`Gemini ${model}: invalid JSON response`);
    } catch (e) {
      const message = `Gemini ${model}: ${e instanceof Error ? e.message : "Unknown"}`;
      console.warn(message);
      errors.push(message);
    }
  }

  return { result: null, error: errors.at(-1) ?? "All Gemini models failed" };
}

async function tryOpenRouter(dataUrl: string): Promise<{ result: OCRResult | null; error: string | null }> {
  if (!HAS_OPENROUTER_CONFIG || !OPENROUTER_API_KEY) return { result: null, error: "No OpenRouter API key" };

  const errors: string[] = [];

  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": APP_URL,
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
        const message =
          res.status === 429
            ? `OpenRouter rate limited: ${model}`
            : `OpenRouter ${model}: ${res.status} ${err.slice(0, 200)}`;
        console.warn(message);
        errors.push(message);
        continue;
      }

      const data = await res.json();
      const content = extractTextContent(data.choices?.[0]?.message?.content);
      if (!content) {
        errors.push(`OpenRouter ${model}: empty response`);
        continue;
      }

      const result = parseOCRResponse(content);
      if (result) {
        return { result, error: null };
      }

      errors.push(`OpenRouter ${model}: invalid JSON response`);
    } catch (e) {
      const message = `OpenRouter ${model}: ${e instanceof Error ? e.message : "Unknown"}`;
      console.warn(message);
      errors.push(message);
    }
  }

  return { result: null, error: errors.at(-1) ?? "All OpenRouter models failed" };
}

async function tryVeryfi(file: File, dataUrl: string): Promise<{ result: OCRResult | null; error: string | null }> {
  if (!HAS_VERYFI_CONFIG || !VERYFI_CLIENT_ID || !VERYFI_API_KEY || !VERYFI_USERNAME) {
    return { result: null, error: "Veryfi not configured" };
  }

  try {
    const res = await fetch(VERYFI_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "CLIENT-ID": VERYFI_CLIENT_ID,
        AUTHORIZATION: `apikey ${VERYFI_USERNAME}:${VERYFI_API_KEY}`,
      },
      body: JSON.stringify({
        file_data: dataUrl,
        file_name: file.name,
        document_type: "receipt",
        boost_mode: false,
        compute: true,
        confidence_details: true,
        auto_delete: true,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text();
      const message =
        res.status === 429
          ? "Veryfi rate limited"
          : `Veryfi: ${res.status} ${err.slice(0, 200)}`;
      console.warn(message);
      return { result: null, error: message };
    }

    const data = await res.json();
    const result = parseVeryfiResponse(data);

    if (!result) {
      return { result: null, error: "Veryfi returned an unreadable OCR payload" };
    }

    return { result, error: null };
  } catch (error) {
    const message = `Veryfi: ${error instanceof Error ? error.message : "Unknown"}`;
    console.warn(message);
    return { result: null, error: message };
  }
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

    if (!HAS_VERYFI_CONFIG && !HAS_GEMINI_CONFIG && !HAS_OPENROUTER_CONFIG) {
      return NextResponse.json(
        { error: "OCR service not configured. Set Veryfi credentials or GEMINI_API_KEY / OPENROUTER_API_KEY." },
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

    const bytes = await file.arrayBuffer();

    // Server-side magic-byte validation — reject mismatched file content
    const byteValidationError = validateReceiptFileBytes(bytes, file.type);
    if (byteValidationError) {
      return NextResponse.json({ error: byteValidationError }, { status: 400 });
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

    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    let ocrResult: OCRResult | null = null;
    const providerErrors: string[] = [];

    const veryfiAttempt = await tryVeryfi(file, dataUrl);
    if (veryfiAttempt.result) {
      ocrResult = veryfiAttempt.result;
    } else if (veryfiAttempt.error && veryfiAttempt.error !== "Veryfi not configured") {
      providerErrors.push(veryfiAttempt.error);
    }

    if (!ocrResult) {
      const geminiAttempt = await tryGemini(base64, file.type);

      if (geminiAttempt.result) {
        ocrResult = geminiAttempt.result;
      } else if (geminiAttempt.error && geminiAttempt.error !== "No Gemini API key") {
        providerErrors.push(geminiAttempt.error);
      }
    }

    if (!ocrResult) {
      const openRouterAttempt = await tryOpenRouter(dataUrl);

      if (openRouterAttempt.result) {
        ocrResult = openRouterAttempt.result;
      } else if (openRouterAttempt.error && openRouterAttempt.error !== "No OpenRouter API key") {
        providerErrors.push(openRouterAttempt.error);
      }
    }

    const lastError = providerErrors.at(-1) ?? null;

    if (!ocrResult) {
      const isRateLimit = lastError?.includes("rate") || lastError?.includes("429");
      const failureMessage = receiptStoragePath
        ? isRateLimit
          ? "Receipt is attached successfully, but OCR is temporarily rate-limited. Please wait a minute and retry OCR."
          : "Receipt is attached successfully, but OCR extraction failed. Please retry OCR, review the fields manually, or try a clearer image."
        : isRateLimit
          ? "OCR service is temporarily rate-limited. Please wait a minute and try again."
          : "OCR extraction failed after trying all configured providers. Please try a clearer image or upload again later.";

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

    const refinedOCR = refineOCRResult(ocrResult);
    ocrResult = applyCategoryAndNotesInference(refinedOCR.result);

    if (receiptStoragePath) {
      try {
        await persistReceiptRecord(supabase, user.id, receiptStoragePath, ocrResult);
      } catch {
        uploadWarning = uploadWarning ?? "Receipt uploaded, but receipt metadata could not be saved yet.";
      }
    }

    const successWarning = joinWarnings(uploadWarning, refinedOCR.warning);

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
          warning: successWarning,
          recoveryActions: uploadStatus === "failed" ? ["retry_upload", "save_manually"] : [],
          status: uploadStatus === "failed" || Boolean(successWarning) ? "partial" : "success",
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
