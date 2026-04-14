import { createClient } from "@/lib/supabase/server";
import type { OCRResult } from "@/lib/types";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function persistReceiptRecord(
  supabase: ServerSupabaseClient,
  userId: string,
  receiptPath: string,
  ocrResult: OCRResult | null
) {
  const payload = {
    ocr_data: ocrResult
      ? {
          amount: ocrResult.amount,
          vendor: ocrResult.vendor,
          date: ocrResult.date,
          category: ocrResult.category,
          description: ocrResult.description,
          line_items: ocrResult.line_items,
          raw_text: ocrResult.raw_text,
        }
      : null,
    confidence: ocrResult?.confidence ?? null,
  };

  const { data: existingReceipt, error: existingReceiptError } = await supabase
    .from("receipts")
    .select("id")
    .eq("user_id", userId)
    .eq("file_url", receiptPath)
    .maybeSingle();

  if (existingReceiptError) {
    throw existingReceiptError;
  }

  if (existingReceipt?.id) {
    const { error: updateError } = await supabase
      .from("receipts")
      .update(payload)
      .eq("id", existingReceipt.id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabase.from("receipts").insert({
    user_id: userId,
    file_url: receiptPath,
    ...payload,
  });

  if (insertError) {
    throw insertError;
  }
}
