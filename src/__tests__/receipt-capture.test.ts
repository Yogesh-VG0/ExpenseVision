import { describe, expect, it } from "vitest";
import {
  RECEIPT_COMPRESSION_TRIGGER_BYTES,
  RECEIPT_MAX_IMAGE_DIMENSION,
  formatReceiptFileSize,
  getReceiptCompressionDimensions,
  shouldCompressReceiptImage,
} from "@/lib/receipt-capture";

describe("receipt capture helpers", () => {
  it("compresses only supported large image types", () => {
    expect(
      shouldCompressReceiptImage({
        type: "image/jpeg",
        size: RECEIPT_COMPRESSION_TRIGGER_BYTES,
      })
    ).toBe(true);

    expect(
      shouldCompressReceiptImage({
        type: "image/webp",
        size: RECEIPT_COMPRESSION_TRIGGER_BYTES + 1,
      })
    ).toBe(true);

    expect(
      shouldCompressReceiptImage({
        type: "image/png",
        size: RECEIPT_COMPRESSION_TRIGGER_BYTES + 1,
      })
    ).toBe(false);

    expect(
      shouldCompressReceiptImage({
        type: "application/pdf",
        size: RECEIPT_COMPRESSION_TRIGGER_BYTES + 1,
      })
    ).toBe(false);
  });

  it("keeps smaller images at their original dimensions", () => {
    expect(getReceiptCompressionDimensions(1200, 900)).toEqual({
      width: 1200,
      height: 900,
      scale: 1,
    });
  });

  it("scales oversized images to the configured max dimension", () => {
    const result = getReceiptCompressionDimensions(4000, 3000);

    expect(result.width).toBe(RECEIPT_MAX_IMAGE_DIMENSION);
    expect(result.height).toBe(1650);
    expect(result.scale).toBeCloseTo(0.55);
  });

  it("formats file sizes for capture feedback", () => {
    expect(formatReceiptFileSize(900)).toBe("900 B");
    expect(formatReceiptFileSize(24 * 1024)).toBe("24 KB");
    expect(formatReceiptFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
