import type { Expense, ReceiptAccessState, ReceiptHistoryItem } from "@/lib/types";

export const RECEIPT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const RECEIPT_ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf",
] as const;

export const RECEIPT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Magic byte signatures for supported receipt file types.
 * Used for server-side validation to prevent MIME spoofing.
 */
const FILE_SIGNATURES: Array<{
  mime: string;
  bytes: number[];
  offset?: number;
}> = [
  // JPEG: FF D8 FF
  { mime: "image/jpeg", bytes: [0xFF, 0xD8, 0xFF] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png", bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // WebP: RIFF....WEBP
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  // GIF87a / GIF89a
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // PDF: %PDF
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
];

// HEIC/HEIF brand codes that appear after the `ftyp` box marker at offset 4
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

export function buildReceiptHistoryItem(
  expense: Expense,
  options?: {
    signedUrl?: string | null;
    accessState?: ReceiptAccessState;
  }
): ReceiptHistoryItem {
  const storagePath = isReceiptStoragePath(expense.receipt_url)
    ? expense.receipt_url
    : null;
  const accessUrl = options?.signedUrl ?? (storagePath ? null : expense.receipt_url);

  return {
    ...expense,
    receipt_url: accessUrl,
    receipt_storage_path: storagePath,
    receipt_access_url: accessUrl,
    receipt_access_state: options?.accessState ?? (storagePath ? "available" : "unavailable"),
  };
}

export function isReceiptStoragePath(value: string | null | undefined): boolean {
  return Boolean(value) && !String(value).startsWith("http");
}

/**
 * Validates a receipt file by MIME type, extension, and size.
 * Returns a user-facing error string or null if valid.
 */
export function validateReceiptFile(file: File) {
  if (!RECEIPT_ALLOWED_TYPES.includes(file.type as (typeof RECEIPT_ALLOWED_TYPES)[number])) {
    return "Unsupported file type. Accepted: JPEG, PNG, WebP, GIF, PDF.";
  }

  // Extension check
  const ext = getFileExtension(file.name);
  if (!ext || !RECEIPT_ALLOWED_EXTENSIONS.includes(ext as (typeof RECEIPT_ALLOWED_EXTENSIONS)[number])) {
    return "Unsupported file extension. Accepted: .jpg, .jpeg, .png, .webp, .gif, .pdf.";
  }

  if (file.size > RECEIPT_MAX_FILE_BYTES) {
    return "File must be under 10 MB";
  }

  return null;
}

/**
 * Validates file content against magic bytes.
 * Call this server-side after reading the file's ArrayBuffer.
 * Returns a user-facing error string or null if valid.
 */
export function validateReceiptFileBytes(
  bytes: ArrayBuffer,
  claimedType: string
): string | null {
  const header = new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength));

  if (header.length < 4) {
    return "File is too small to be a valid receipt image or PDF.";
  }

  // HEIC/HEIF: ISO BMFF `ftyp` box — bytes 4-7 are "ftyp", bytes 8-11 are brand
  if (header.length >= 12 &&
      header[4] === 0x66 && header[5] === 0x74 && // ft
      header[6] === 0x79 && header[7] === 0x70) {  // yp
    const brand = String.fromCharCode(header[8], header[9], header[10], header[11]);
    if (HEIC_BRANDS.includes(brand)) {
      if (claimedType !== "image/heic" && claimedType !== "image/heif") {
        return `File content (HEIC/HEIF) does not match claimed type (${claimedType}).`;
      }
      return null;
    }
  }

  // Find matching signature
  const detectedSignature = FILE_SIGNATURES.find((sig) => {
    const offset = sig.offset ?? 0;
    if (header.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => header[offset + i] === b);
  });

  if (!detectedSignature) {
    return "File content does not match any supported image or PDF format.";
  }

  // WebP needs additional check: bytes 8-11 should be "WEBP"
  if (detectedSignature.mime === "image/webp") {
    if (
      header.length < 12 ||
      header[8] !== 0x57 || // W
      header[9] !== 0x45 || // E
      header[10] !== 0x42 || // B
      header[11] !== 0x50    // P
    ) {
      // RIFF header but not WebP — likely a different RIFF format
      if (claimedType === "image/webp") {
        return "File claims to be WebP but content does not match.";
      }
    }
  }

  // Check for mismatch between claimed MIME and detected signature
  if (claimedType !== detectedSignature.mime) {
    // Allow jpeg type variations
    if (
      (claimedType === "image/jpeg" && detectedSignature.mime === "image/jpeg") ||
      (claimedType === "image/jpg" && detectedSignature.mime === "image/jpeg")
    ) {
      return null;
    }
    return `File content (${detectedSignature.mime}) does not match claimed type (${claimedType}).`;
  }

  return null;
}

function getFileExtension(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return null;
  return fileName.slice(lastDot).toLowerCase();
}

export function buildReceiptStoragePath(userId: string, fileName: string) {
  const rawExt = fileName.split(".").pop() || "jpg";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "jpg";
  return `${userId}/${Date.now()}.${ext}`;
}

export function inferReceiptMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "pdf":
      return "application/pdf";
    default:
      return "image/jpeg";
  }
}
