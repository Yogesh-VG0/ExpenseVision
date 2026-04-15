import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistReceiptRecord } from "@/lib/receipt-records";
import {
  buildReceiptStoragePath,
  validateReceiptFile,
  validateReceiptFileBytes,
} from "@/lib/receipts";
import {
  buildReceiptShareFingerprint,
  RECEIPT_SHARE_COOKIE_MAX_AGE_SECONDS,
  RECEIPT_SHARE_COOKIE_NAME,
  RECEIPT_SHARE_FORM_FIELD_NAME,
  serializeReceiptShareDraft,
} from "@/lib/receipt-share";
import { buildLoginRedirectPath } from "@/lib/utils";

function createCaptureUrl(request: NextRequest, shareState?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/receipts/capture";
  url.search = "";

  if (shareState) {
    url.searchParams.set("share", shareState);
  }

  return url;
}

function createLoginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  const redirectUrl = buildLoginRedirectPath("/receipts/capture?share=login-required");
  const redirectTarget = new URL(redirectUrl, request.nextUrl.origin);
  url.search = redirectTarget.search;
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(createLoginUrl(request), 303);
    }

    const formData = await request.formData();
    const sharedFile = formData
      .getAll(RECEIPT_SHARE_FORM_FIELD_NAME)
      .find((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!sharedFile) {
      return NextResponse.redirect(createCaptureUrl(request, "no-file"), 303);
    }

    const validationError = validateReceiptFile(sharedFile);
    if (validationError) {
      return NextResponse.redirect(createCaptureUrl(request, "unsupported-file"), 303);
    }

    const bytes = await sharedFile.arrayBuffer();
    const byteValidationError = validateReceiptFileBytes(bytes, sharedFile.type);

    if (byteValidationError) {
      return NextResponse.redirect(createCaptureUrl(request, "unsupported-file"), 303);
    }

    const receiptPath = buildReceiptStoragePath(user.id, sharedFile.name);
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(receiptPath, sharedFile, { contentType: sharedFile.type, upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    await persistReceiptRecord(supabase, user.id, receiptPath, null);

    const response = NextResponse.redirect(createCaptureUrl(request), 303);
    response.cookies.set(
      RECEIPT_SHARE_COOKIE_NAME,
      serializeReceiptShareDraft({
        draftId: crypto.randomUUID(),
        receiptPath,
        fileName: sharedFile.name,
        fileType: sharedFile.type,
        fileSize: sharedFile.size,
        previewUrl: null,
        createdAt: new Date().toISOString(),
        fingerprint: buildReceiptShareFingerprint(sharedFile),
      }),
      {
        maxAge: RECEIPT_SHARE_COOKIE_MAX_AGE_SECONDS,
        path: "/receipts/capture",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      }
    );

    return response;
  } catch (error) {
    console.error("POST /receipts/share-target error:", error);
    return NextResponse.redirect(createCaptureUrl(request, "import-failed"), 303);
  }
}
