import { RECEIPT_MAX_FILE_BYTES } from "@/lib/receipts";

export const RECEIPT_COMPRESSION_TRIGGER_BYTES = 4 * 1024 * 1024;
export const RECEIPT_MAX_IMAGE_DIMENSION = 2200;
export const RECEIPT_COMPRESSIBLE_IMAGE_TYPES = ["image/jpeg", "image/webp"] as const;

export function shouldCompressReceiptImage(file: { type: string; size: number }) {
  return (
    file.size >= RECEIPT_COMPRESSION_TRIGGER_BYTES &&
    RECEIPT_COMPRESSIBLE_IMAGE_TYPES.includes(
      file.type as (typeof RECEIPT_COMPRESSIBLE_IMAGE_TYPES)[number]
    )
  );
}

export function getReceiptCompressionDimensions(
  width: number,
  height: number,
  maxDimension = RECEIPT_MAX_IMAGE_DIMENSION
) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scale: 1 };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function formatReceiptFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function loadImageElement(file: File) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    image.src = objectUrl;
  });
}

function cleanupImageSource(source: ImageBitmap | HTMLImageElement) {
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
}

export async function compressReceiptImage(file: File) {
  if (!shouldCompressReceiptImage(file) || typeof document === "undefined") {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement;

  try {
    source = typeof createImageBitmap === "function"
      ? await createImageBitmap(file)
      : await loadImageElement(file);
  } catch {
    return file;
  }

  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const { width, height } = getReceiptCompressionDimensions(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    cleanupImageSource(source);
    return file;
  }

  context.drawImage(source, 0, 0, width, height);
  cleanupImageSource(source);

  let bestBlob: Blob | null = null;

  for (const quality of [0.84, 0.76, 0.68, 0.6]) {
    const blob = await canvasToBlob(canvas, file.type, quality);
    if (!blob) {
      continue;
    }

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= RECEIPT_MAX_FILE_BYTES) {
      break;
    }
  }

  if (!bestBlob || bestBlob.size >= file.size) {
    return file;
  }

  return new File([bestBlob], file.name, {
    type: bestBlob.type || file.type,
    lastModified: file.lastModified,
  });
}
