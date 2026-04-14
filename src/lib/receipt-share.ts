export const RECEIPT_SHARE_COOKIE_NAME = "expensevision_receipt_share_draft";
export const RECEIPT_SHARE_REVIEW_STORAGE_KEY = "expensevision.receiptShareDraft";
export const RECEIPT_SHARE_HINT_STORAGE_KEY = "expensevision.receiptShareHintDismissed";
export const RECEIPT_SHARE_FORM_FIELD_NAME = "receipt";
export const RECEIPT_SHARE_DRAFT_TTL_MS = 30 * 60 * 1000;
export const RECEIPT_SHARE_COOKIE_MAX_AGE_SECONDS = RECEIPT_SHARE_DRAFT_TTL_MS / 1000;

export interface ReceiptShareDraft {
  draftId: string;
  receiptPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string | null;
  createdAt: string;
  fingerprint: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildReceiptShareFingerprint(file: { name: string; type: string; size: number }) {
  return `${file.name.trim().toLowerCase()}::${file.type.trim().toLowerCase()}::${file.size}`;
}

export function isFreshReceiptShareDraft(
  draft: Pick<ReceiptShareDraft, "createdAt">,
  now = Date.now()
) {
  const createdAt = Date.parse(draft.createdAt);

  return Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt <= RECEIPT_SHARE_DRAFT_TTL_MS;
}

export function coerceReceiptShareDraft(value: unknown): ReceiptShareDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const draft = value as Record<string, unknown>;

  if (
    !isNonEmptyString(draft.draftId) ||
    !isNonEmptyString(draft.receiptPath) ||
    !isNonEmptyString(draft.fileName) ||
    !isNonEmptyString(draft.fileType) ||
    typeof draft.fileSize !== "number" ||
    !Number.isFinite(draft.fileSize) ||
    draft.fileSize < 0 ||
    !isNonEmptyString(draft.createdAt) ||
    !isNonEmptyString(draft.fingerprint)
  ) {
    return null;
  }

  const normalized: ReceiptShareDraft = {
    draftId: draft.draftId,
    receiptPath: draft.receiptPath,
    fileName: draft.fileName,
    fileType: draft.fileType,
    fileSize: draft.fileSize,
    previewUrl: typeof draft.previewUrl === "string" && draft.previewUrl.length > 0 ? draft.previewUrl : null,
    createdAt: draft.createdAt,
    fingerprint: draft.fingerprint,
  };

  return isFreshReceiptShareDraft(normalized) ? normalized : null;
}

export function serializeReceiptShareDraft(draft: ReceiptShareDraft) {
  return encodeURIComponent(JSON.stringify(draft));
}

export function parseReceiptShareDraft(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return coerceReceiptShareDraft(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}
