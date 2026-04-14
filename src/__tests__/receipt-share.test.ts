import { describe, expect, it } from "vitest";
import {
  buildReceiptShareFingerprint,
  coerceReceiptShareDraft,
  isFreshReceiptShareDraft,
  parseReceiptShareDraft,
  serializeReceiptShareDraft,
} from "@/lib/receipt-share";

describe("receipt share helpers", () => {
  it("builds a stable file fingerprint", () => {
    expect(
      buildReceiptShareFingerprint({
        name: " Receipt.JPG ",
        type: "IMAGE/JPEG",
        size: 12345,
      })
    ).toBe("receipt.jpg::image/jpeg::12345");
  });

  it("accepts fresh serialized drafts", () => {
    const draft = {
      draftId: "draft-1",
      receiptPath: "user-1/receipt.jpg",
      fileName: "receipt.jpg",
      fileType: "image/jpeg",
      fileSize: 512000,
      previewUrl: null,
      createdAt: new Date().toISOString(),
      fingerprint: "receipt.jpg::image/jpeg::512000",
    };

    expect(parseReceiptShareDraft(serializeReceiptShareDraft(draft))).toEqual(draft);
    expect(coerceReceiptShareDraft(draft)).toEqual(draft);
  });

  it("rejects stale or malformed drafts", () => {
    expect(
      coerceReceiptShareDraft({
        draftId: "draft-2",
        receiptPath: "user-1/receipt.jpg",
        fileName: "receipt.jpg",
        fileType: "image/jpeg",
        fileSize: 100,
        previewUrl: null,
        createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        fingerprint: "receipt.jpg::image/jpeg::100",
      })
    ).toBeNull();

    expect(parseReceiptShareDraft("not-json")).toBeNull();
    expect(coerceReceiptShareDraft({ draftId: "missing-fields" })).toBeNull();
  });

  it("checks draft freshness against the TTL window", () => {
    const now = Date.now();

    expect(
      isFreshReceiptShareDraft({ createdAt: new Date(now - 5 * 60 * 1000).toISOString() }, now)
    ).toBe(true);

    expect(
      isFreshReceiptShareDraft({ createdAt: new Date(now - 31 * 60 * 1000).toISOString() }, now)
    ).toBe(false);
    expect(isFreshReceiptShareDraft({ createdAt: "invalid-date" }, now)).toBe(false);
  });
});
