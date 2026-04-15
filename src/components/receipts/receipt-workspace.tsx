"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_FORMATTER } from "@/lib/constants";
import { useCurrency } from "@/components/currency-provider";
import {
  coerceReceiptShareDraft,
  RECEIPT_SHARE_COOKIE_NAME,
  RECEIPT_SHARE_HINT_STORAGE_KEY,
  RECEIPT_SHARE_REVIEW_STORAGE_KEY,
} from "@/lib/receipt-share";
import type { ReceiptShareDraft } from "@/lib/receipt-share";
import {
  compressReceiptImage,
  formatReceiptFileSize,
} from "@/lib/receipt-capture";
import { buildReceiptHistoryItem, validateReceiptFile } from "@/lib/receipts";
import { trackEvent } from "@/lib/telemetry";
import { expenseSchema } from "@/lib/validations";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  enqueuePendingUpload,
  isOfflineQueueAvailable,
} from "@/lib/offline-queue";
import {
  registerRetryListeners,
  registerBackgroundSync,
  processQueue,
} from "@/lib/offline-retry";
import { PendingQueuePanel } from "@/components/receipts/pending-queue";
import type { ReceiptHistoryItem, ReceiptProcessingResult, Expense } from "@/lib/types";

interface ReceiptWorkspaceProps {
  initialReceipts: ReceiptHistoryItem[];
  mode?: "workspace" | "capture";
  initialShareDraft?: ReceiptShareDraft | null;
}

interface ReceiptFormValues {
  amount: string;
  vendor: string;
  category: string;
  description: string;
  date: string;
}

interface SelectedReceiptFile {
  name: string;
  type: string;
  size: number;
  originalSize: number;
  wasCompressed: boolean;
}

interface StoredReceiptShareReviewState {
  draft: ReceiptShareDraft;
  preview: string | null;
  selectedFile: SelectedReceiptFile | null;
  processingResult: ReceiptProcessingResult | null;
  formValues: ReceiptFormValues;
}

type ReceiptShareFeedbackState = "no-file" | "unsupported-file" | "import-failed" | "login-required";

const EMPTY_RESULT: ReceiptProcessingResult = {
  amount: null,
  vendor: null,
  date: null,
  category: null,
  description: null,
  line_items: [],
  confidence: 0,
  raw_text: "",
  receipt_path: null,
  status: "error",
  upload_status: "failed",
  ocr_status: "failed",
  warning: null,
  error: null,
  recovery_actions: ["retry_ocr", "retry_upload", "save_manually"],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyFormValues(): ReceiptFormValues {
  return {
    amount: "",
    vendor: "",
    category: "Other",
    description: "",
    date: today(),
  };
}

function isReceiptProcessingResult(value: unknown): value is ReceiptProcessingResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "status" in value &&
      "ocr_status" in value &&
      "upload_status" in value
  );
}

function isSelectedReceiptFile(value: unknown): value is SelectedReceiptFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      typeof value.name === "string" &&
      "type" in value &&
      typeof value.type === "string" &&
      "size" in value &&
      typeof value.size === "number" &&
      "originalSize" in value &&
      typeof value.originalSize === "number" &&
      "wasCompressed" in value &&
      typeof value.wasCompressed === "boolean"
  );
}

function isReceiptFormValues(value: unknown): value is ReceiptFormValues {
  return Boolean(
    value &&
      typeof value === "object" &&
      "amount" in value &&
      typeof value.amount === "string" &&
      "vendor" in value &&
      typeof value.vendor === "string" &&
      "category" in value &&
      typeof value.category === "string" &&
      "description" in value &&
      typeof value.description === "string" &&
      "date" in value &&
      typeof value.date === "string"
  );
}

function isReceiptShareFeedbackState(value: string | null): value is ReceiptShareFeedbackState {
  return (
    value === "no-file" ||
    value === "unsupported-file" ||
    value === "import-failed" ||
    value === "login-required"
  );
}

function buildSelectedReceiptFileFromShareDraft(draft: ReceiptShareDraft): SelectedReceiptFile {
  return {
    name: draft.fileName,
    type: draft.fileType,
    size: draft.fileSize,
    originalSize: draft.fileSize,
    wasCompressed: false,
  };
}

function clearReceiptShareDraftCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${RECEIPT_SHARE_COOKIE_NAME}=; Max-Age=0; Path=/receipts/capture; SameSite=Lax`;
}

function clearStoredReceiptShareReviewState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(RECEIPT_SHARE_REVIEW_STORAGE_KEY);
}

function readStoredReceiptShareReviewState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(RECEIPT_SHARE_REVIEW_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const draft = coerceReceiptShareDraft(parsed.draft);

    if (!draft) {
      throw new Error("Stale share draft");
    }

    return {
      draft,
      preview: typeof parsed.preview === "string" && parsed.preview.length > 0 ? parsed.preview : null,
      selectedFile: isSelectedReceiptFile(parsed.selectedFile) ? parsed.selectedFile : null,
      processingResult: isReceiptProcessingResult(parsed.processingResult) ? parsed.processingResult : null,
      formValues: isReceiptFormValues(parsed.formValues)
        ? parsed.formValues
        : createEmptyFormValues(),
    } satisfies StoredReceiptShareReviewState;
  } catch {
    clearStoredReceiptShareReviewState();
    return null;
  }
}

function persistStoredReceiptShareReviewState(state: StoredReceiptShareReviewState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECEIPT_SHARE_REVIEW_STORAGE_KEY, JSON.stringify(state));
}

async function buildImagePreview(file: File) {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to load preview"));
    reader.readAsDataURL(file);
  });
}

/**
 * Registers offline-retry event listeners and listens for Background Sync
 * postMessage from the service worker. Renders nothing visible.
 */
function OfflineRetryBootstrap() {
  useEffect(() => {
    const cleanup = registerRetryListeners();

    // Listen for Background Sync postMessage from SW
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PROCESS_OFFLINE_QUEUE") {
        void processQueue();
      }
    };

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
    }

    return () => {
      cleanup();
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handler);
      }
    };
  }, []);

  return null;
}

export function ReceiptWorkspace({
  initialReceipts,
  mode = "workspace",
  initialShareDraft = null,
}: ReceiptWorkspaceProps) {
  const searchParams = useSearchParams();
  const { format: formatCurrency } = useCurrency();
  const isCaptureMode = mode === "capture";
  const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>(initialReceipts);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ReceiptProcessingResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedReceiptFile | null>(null);
  const [formValues, setFormValues] = useState<ReceiptFormValues>(createEmptyFormValues());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<ReceiptHistoryItem | null>(null);
  const [refreshingReceiptId, setRefreshingReceiptId] = useState<string | null>(null);
  const [removingReceiptId, setRemovingReceiptId] = useState<string | null>(null);
  const [activeShareDraft, setActiveShareDraft] = useState<ReceiptShareDraft | null>(initialShareDraft);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [shareHintDismissed, setShareHintDismissed] = useState(true);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const reviewCardRef = useRef<HTMLDivElement>(null);
  const shareDraftInitializedRef = useRef(false);
  const shareDraftOCRStartedRef = useRef<string | null>(null);

  const shareFeedbackState = useMemo(() => {
    const value = searchParams.get("share");
    return isReceiptShareFeedbackState(value) ? value : null;
  }, [searchParams]);

  const shareFeedback = useMemo(() => {
    switch (shareFeedbackState) {
      case "no-file":
        return {
          title: "No shared receipt was received",
          description: "Use the capture actions below to import a receipt image or PDF directly into ExpenseVision.",
        };
      case "unsupported-file":
        return {
          title: "That shared file couldn’t be imported",
          description: "ExpenseVision currently accepts receipt images and PDFs up to 10 MB. Use the capture flow below to choose another file.",
        };
      case "import-failed":
        return {
          title: "We couldn’t import that shared receipt",
          description: "The share handoff failed before review started. You can still use the camera or upload flow below as a fallback.",
        };
      case "login-required":
        return {
          title: "Sign in to finish importing shared receipts",
          description: "Your session expired before ExpenseVision could resume the shared file. After signing in, use the capture flow below if the share sheet doesn’t reopen automatically.",
        };
      default:
        return null;
    }
  }, [shareFeedbackState]);

  const showShareHint = isCaptureMode && isStandaloneApp && !shareHintDismissed && !activeShareDraft;

  const hasWeakConfidence = useMemo(() => {
    if (!processingResult || processingResult.ocr_status !== "succeeded") {
      return false;
    }

    return (
      processingResult.confidence < 0.65 ||
      processingResult.amount == null ||
      !processingResult.vendor ||
      !processingResult.date
    );
  }, [processingResult]);

  const canSave = Boolean(preview || processingResult);
  const hasActiveReceipt = Boolean(selectedFile || preview || processingResult);

  const applyReceiptUpdate = useCallback(
    (expenseId: string, updater: (receipt: ReceiptHistoryItem) => ReceiptHistoryItem | null) => {
      setReceipts((current) => current.flatMap((receipt) => {
        if (receipt.id !== expenseId) {
          return [receipt];
        }

        const updated = updater(receipt);
        return updated ? [updated] : [];
      }));

      setViewReceipt((current) => {
        if (!current || current.id !== expenseId) {
          return current;
        }

        const updated = updater(current);
        return updated;
      });
    },
    []
  );

  const hydrateForm = useCallback((result: ReceiptProcessingResult | null) => {
    setFormValues({
      amount: result?.amount != null ? String(result.amount) : "",
      vendor: result?.vendor ?? "",
      category: result?.category ?? "Other",
      description: result?.description ?? "",
      date: result?.date ?? today(),
    });
  }, []);

  const clearScan = useCallback(() => {
    setProcessingResult(null);
    setPreview(null);
    setSelectedFile(null);
    setFormValues(createEmptyFormValues());
    setFormErrors({});
    setActiveShareDraft(null);
    lastFileRef.current = null;
    clearStoredReceiptShareReviewState();
    clearReceiptShareDraftCookie();
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (libraryInputRef.current) {
      libraryInputRef.current.value = "";
    }
  }, []);

  const dismissShareHint = useCallback(() => {
    setShareHintDismissed(true);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECEIPT_SHARE_HINT_STORAGE_KEY, "1");
    }
  }, []);

  const refreshSharedDraftPreview = useCallback(async (draft: ReceiptShareDraft) => {
    if (!draft.fileType.startsWith("image/")) {
      setPreview(null);
      return;
    }

    try {
      const res = await fetch("/api/receipts/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptPath: draft.receiptPath }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && typeof data?.access_url === "string") {
        setPreview(data.access_url);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!isCaptureMode || typeof window === "undefined") {
      return;
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandaloneApp(standalone);
    setShareHintDismissed(window.localStorage.getItem(RECEIPT_SHARE_HINT_STORAGE_KEY) === "1");
  }, [isCaptureMode]);

  useEffect(() => {
    if (!isCaptureMode || shareDraftInitializedRef.current) {
      return;
    }

    shareDraftInitializedRef.current = true;

    const storedState = readStoredReceiptShareReviewState();

    if (initialShareDraft) {
      clearReceiptShareDraftCookie();

      if (storedState?.draft.draftId === initialShareDraft.draftId) {
        setActiveShareDraft(storedState.draft);
        setPreview(storedState.preview);
        setSelectedFile(storedState.selectedFile);
        setProcessingResult(storedState.processingResult);
        setFormValues(storedState.formValues);
        return;
      }

      setActiveShareDraft(initialShareDraft);
      setPreview(null);
      setSelectedFile(buildSelectedReceiptFileFromShareDraft(initialShareDraft));
      setProcessingResult(null);
      setFormErrors({});
      setFormValues(createEmptyFormValues());
      return;
    }

    if (storedState) {
      setActiveShareDraft(storedState.draft);
      setPreview(storedState.preview);
      setSelectedFile(storedState.selectedFile);
      setProcessingResult(storedState.processingResult);
      setFormValues(storedState.formValues);
    }
  }, [initialShareDraft, isCaptureMode]);

  useEffect(() => {
    if (!isCaptureMode || !activeShareDraft) {
      return;
    }

    persistStoredReceiptShareReviewState({
      draft: activeShareDraft,
      preview,
      selectedFile,
      processingResult,
      formValues,
    });
  }, [activeShareDraft, formValues, isCaptureMode, preview, processingResult, selectedFile]);

  useEffect(() => {
    if (!activeShareDraft) {
      shareDraftOCRStartedRef.current = null;
      return;
    }

    void refreshSharedDraftPreview(activeShareDraft);
  }, [activeShareDraft, refreshSharedDraftPreview]);

  const refreshReceiptAccess = useCallback(
    async (expenseId: string, silent = false) => {
      setRefreshingReceiptId(expenseId);

      try {
        const res = await fetch("/api/receipts/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenseId }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to refresh receipt access");
        }

        applyReceiptUpdate(expenseId, (receipt) => ({
          ...receipt,
          receipt_url: data?.access_url ?? null,
          receipt_access_url: data?.access_url ?? null,
          receipt_access_state: data?.access_state ?? "unavailable",
          receipt_storage_path: data?.receipt_storage_path ?? receipt.receipt_storage_path,
        }));

        if (!silent) {
          if (data?.access_state === "available") {
            toast.success("Receipt access refreshed");
          } else {
            toast.error("Receipt file is unavailable. You can remove the broken reference.");
          }
        }
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Failed to refresh receipt access");
        }
      } finally {
        setRefreshingReceiptId(null);
      }
    },
    [applyReceiptUpdate]
  );

  const removeBrokenReceiptReference = useCallback(
    async (expenseId: string) => {
      setRemovingReceiptId(expenseId);

      try {
        const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to remove receipt reference");
        }

        applyReceiptUpdate(expenseId, () => null);
        setViewReceipt((current) => (current?.id === expenseId ? null : current));
        toast.success("Receipt reference removed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove receipt reference");
      } finally {
        setRemovingReceiptId(null);
      }
    },
    [applyReceiptUpdate]
  );

  const runOCR = useCallback(
    async (formData: FormData, source: string) => {
      setProcessing(true);
      setFormErrors({});
      await trackEvent("ocr_start", { source });

      try {
        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => null);

        if (isReceiptProcessingResult(data)) {
          setProcessingResult(data);
          hydrateForm(data);

          if (data.ocr_status === "succeeded") {
            await trackEvent("ocr_success", {
              source,
              status: data.status,
              upload_status: data.upload_status,
            });
            if (source === "share_target") {
              await trackEvent("share_import_success", {
                status: data.status,
                upload_status: data.upload_status,
              });
            }
            if (data.status === "success") {
              toast.success("Receipt scanned successfully");
            } else if (data.warning) {
              toast.error(data.warning);
            }
          } else {
            await trackEvent("ocr_failure", {
              source,
              error: data.error ?? "OCR failed",
              upload_status: data.upload_status,
            });
            if (source === "share_target") {
              await trackEvent("share_import_failure", {
                error: data.error ?? "OCR failed",
                upload_status: data.upload_status,
              });
            }
            if (data.error) {
              toast.error(data.error);
            }
          }

          return;
        }

        const message = data?.error || "Failed to process receipt";
        throw new Error(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process receipt";
        const fallback = {
          ...EMPTY_RESULT,
          error: message,
        };
        setProcessingResult(fallback);
        hydrateForm(fallback);
        await trackEvent("ocr_failure", { source, error: message });
        if (source === "share_target") {
          await trackEvent("share_import_failure", { error: message });
        }
        toast.error(message);
      } finally {
        setProcessing(false);
      }
    },
    [hydrateForm]
  );

  const handleFile = useCallback(
    async (incomingFile: File, source: "camera" | "file_picker" | "drop") => {
      setActiveShareDraft(null);
      clearStoredReceiptShareReviewState();
      clearReceiptShareDraftCookie();
      lastFileRef.current = null;
      setProcessingResult(null);
      setFormErrors({});
      setPreview(null);
      setSelectedFile({
        name: incomingFile.name,
        type: incomingFile.type,
        size: incomingFile.size,
        originalSize: incomingFile.size,
        wasCompressed: false,
      });

      try {
        setPreview(await buildImagePreview(incomingFile));
      } catch {
        setPreview(null);
      }

      let file = incomingFile;

      try {
        const optimizedFile = await compressReceiptImage(incomingFile);
        if (optimizedFile !== incomingFile) {
          file = optimizedFile;
          setSelectedFile({
            name: optimizedFile.name,
            type: optimizedFile.type,
            size: optimizedFile.size,
            originalSize: incomingFile.size,
            wasCompressed: true,
          });
          toast.success("Large photo optimized for faster upload");
        }
      } catch {
      }

      const validationError = validateReceiptFile(file);

      if (validationError) {
        setPreview(null);
        setSelectedFile(null);
        toast.error(validationError);
        return;
      }

      lastFileRef.current = file;

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          reviewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      const formData = new FormData();
      formData.append("file", file);
      await runOCR(formData, source);
    },
    [runOCR]
  );

  // ── launchQueue file consumption (file_handlers progressive enhancement) ──
  useEffect(() => {
    if (!isCaptureMode || typeof window === "undefined") {
      return;
    }

    try {
      const raw = sessionStorage.getItem("ev_launch_file");
      if (!raw) return;

      sessionStorage.removeItem("ev_launch_file");
      const parsed = JSON.parse(raw) as {
        name: string;
        type: string;
        dataUrl: string;
        timestamp: number;
      };

      // Only consume files stored within the last 60 seconds
      if (Date.now() - parsed.timestamp > 60_000) return;

      // Convert data URL back to File
      const byteString = atob(parsed.dataUrl.split(",")[1]);
      const mimeString = parsed.dataUrl.split(",")[0].split(":")[1].split(";")[0];
      const ab = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        ab[i] = byteString.charCodeAt(i);
      }
      const file = new File([ab], parsed.name, { type: mimeString || parsed.type });
      void handleFile(file, "file_picker");
    } catch {
      // Ignore corrupted or stale launch file data
    }
  }, [isCaptureMode, handleFile]);

  useEffect(() => {
    if (
      !isCaptureMode ||
      !activeShareDraft ||
      processing ||
      processingResult ||
      shareDraftOCRStartedRef.current === activeShareDraft.draftId
    ) {
      return;
    }

    shareDraftOCRStartedRef.current = activeShareDraft.draftId;

    void (async () => {
      setSelectedFile((current) => current ?? buildSelectedReceiptFileFromShareDraft(activeShareDraft));
      setFormErrors({});
      await trackEvent("share_import_start", { source: "share_target" });

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          reviewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      const formData = new FormData();
      formData.append("receipt_path", activeShareDraft.receiptPath);
      await runOCR(formData, "share_target");
    })();
  }, [activeShareDraft, isCaptureMode, processing, processingResult, runOCR]);

  const retryOCR = useCallback(async () => {
    if (!processingResult?.receipt_path) {
      toast.error("No stored receipt is available for OCR retry");
      return;
    }

    const formData = new FormData();
    formData.append("receipt_path", processingResult.receipt_path);
    await runOCR(formData, "stored_receipt");
  }, [processingResult?.receipt_path, runOCR]);

  const retryUpload = useCallback(async () => {
    if (!lastFileRef.current) {
      toast.error("Original file is no longer available. Please choose it again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", lastFileRef.current);
    await runOCR(formData, "retry_upload");
  }, [runOCR]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) {
        void handleFile(file, "drop");
      }
    },
    [handleFile]
  );

  const handleCameraInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file, "camera");
      }
    },
    [handleFile]
  );

  const handleLibraryInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file, "file_picker");
      }
    },
    [handleFile]
  );

  const handleSaveExpense = useCallback(async () => {
    const raw = {
      amount: Number.parseFloat(formValues.amount),
      vendor: formValues.vendor || undefined,
      category: formValues.category,
      description: formValues.description || "",
      date: formValues.date,
      is_recurring: false,
      receipt_url: processingResult?.receipt_path ?? null,
    };

    const parsed = expenseSchema.safeParse(raw);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      });
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save expense");
      }

      const expense = data?.expense as Expense;
      const receiptItem = buildReceiptHistoryItem(expense, {
        accessState: expense.receipt_url ? "missing" : "unavailable",
      });

      setReceipts((current) => [receiptItem, ...current]);
      if (receiptItem.receipt_storage_path) {
        void refreshReceiptAccess(receiptItem.id, true);
      }

      await trackEvent("expense_save_success", {
        source: processingResult?.ocr_status === "succeeded" ? "ocr_review" : "manual_review",
        has_receipt: Boolean(processingResult?.receipt_path),
        share_draft_id: activeShareDraft?.draftId,
      });

      clearScan();
      toast.success(isCaptureMode ? "Expense saved. Ready to scan the next receipt." : "Expense saved from receipt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save expense";

      // If the save failed due to a network error and IDB is available,
      // enqueue the expense locally so the user doesn't lose their work.
      const isNetworkError =
        error instanceof TypeError ||
        (typeof navigator !== "undefined" && !navigator.onLine);

      if (isNetworkError && isOfflineQueueAvailable()) {
        try {
          await enqueuePendingUpload({
            formValues,
            receiptPath: processingResult?.receipt_path ?? null,
            receiptPreview: preview,
          });
          await registerBackgroundSync();
          await trackEvent("offline_queue_enqueue", {
            source: processingResult?.ocr_status === "succeeded" ? "ocr_review" : "manual_review",
          });
          clearScan();
          toast.success(
            "Saved to queue — will upload automatically when you're back online."
          );
          return;
        } catch {
          // IDB enqueue failed, fall through to original error
        }
      }

      await trackEvent("expense_save_failure", {
        source: processingResult?.ocr_status === "succeeded" ? "ocr_review" : "manual_review",
        error: message,
        share_draft_id: activeShareDraft?.draftId,
      });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [activeShareDraft?.draftId, clearScan, formValues, isCaptureMode, preview, processingResult, refreshReceiptAccess]);

  const recoveryActions = processingResult?.recovery_actions ?? [];
  const receiptStatusTone =
    processingResult?.status === "success"
      ? "default"
      : processingResult?.status === "partial"
        ? "secondary"
        : "destructive";
  const selectedFileSummary = selectedFile
    ? `${selectedFile.type === "application/pdf" ? "PDF" : "Image"} • ${formatReceiptFileSize(selectedFile.size)}`
    : null;

  return (
    <div
      className={cn(
        isCaptureMode
          ? "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-32 sm:px-6 lg:px-8"
          : "space-y-6 pb-28 md:pb-10"
      )}
      style={isCaptureMode ? { paddingTop: "calc(env(safe-area-inset-top) + 1rem)" } : undefined}
    >
      {/* ── Offline queue retry listeners ── */}
      <OfflineRetryBootstrap />
      {isCaptureMode ? (
        <div className="sticky top-0 z-30 -mx-4 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <Button variant="ghost" render={<Link href="/receipts" />}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to receipts
            </Button>
            <Badge variant="secondary">{activeShareDraft ? "Shared receipt" : "Camera-first capture"}</Badge>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <Camera className="mr-2 inline-block h-6 w-6 text-primary" />
            Receipt Scanner
          </h1>
          <p className="mt-1 text-muted-foreground">
            Capture or upload a receipt, review the extracted fields, and save with confidence.
          </p>
        </div>
      )}

      {isCaptureMode && shareFeedback && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15">
              <Share2 className="h-5 w-5 text-amber-200" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-amber-50">{shareFeedback.title}</p>
              <p className="text-sm text-amber-100/90">{shareFeedback.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {showShareHint && (
        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Share receipts straight into ExpenseVision</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  On supported installed browsers, you can share receipt photos or PDFs from your gallery or files app directly into this review flow. If ExpenseVision doesn’t appear in your share sheet, use the camera or upload actions below instead.
                </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={dismissShareHint}>
              Got it
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardContent className={cn("p-4 sm:p-6", isCaptureMode && !hasActiveReceipt && "flex min-h-[70dvh] flex-col justify-center") }>
          <div
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/10"
            }`}
          >
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraInputChange}
              className="hidden"
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleLibraryInputChange}
              className="hidden"
            />
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20">
              <Upload className="hidden h-9 w-9 text-primary md:block md:h-10 md:w-10" />
              <Camera className="h-9 w-9 text-primary md:hidden sm:h-10 sm:w-10" />
            </div>
            <p className="mt-4 text-xl font-semibold sm:text-2xl">
              {isCaptureMode
                ? activeShareDraft
                  ? "Review a shared receipt"
                  : "Capture a receipt"
                : "Upload a receipt"}
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base md:hidden">
              {isCaptureMode
                ? activeShareDraft
                  ? "We’ll continue from the file you shared. Switch to camera or upload a different file below."
                  : "Open your camera or import a photo or PDF."
                : "Take a photo or choose a file from your device."}
            </p>
            <p className="mt-2 hidden max-w-md text-sm text-muted-foreground sm:text-base md:block">
              {isCaptureMode
                ? activeShareDraft
                  ? "We’ll continue from the file you shared. Upload a different photo or PDF below if needed."
                  : "Upload a receipt photo or PDF. Drag and drop also works."
                : "Drop a receipt image or PDF here, or click to browse your files."}
            </p>
            <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-2 md:grid-cols-1 md:max-w-sm">
              <Button
                type="button"
                size="lg"
                className="h-14 text-base sm:h-16 md:hidden"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="mr-2 h-5 w-5" />
                Take photo
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-14 text-base sm:h-16"
                onClick={() => libraryInputRef.current?.click()}
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload photo or PDF
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground sm:text-sm md:hidden">
              {isCaptureMode
                ? "If ExpenseVision doesn’t appear in your share sheet, use the actions here instead."
                : "You can also drag and drop files."}
            </p>
            <p className="mt-3 hidden text-xs text-muted-foreground sm:text-sm md:block">
              Drag and drop supported. JPG, PNG, WebP, GIF, and PDF up to 10 MB.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 md:hidden">
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                JPG, PNG, WebP, GIF
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                PDF up to 10 MB
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {(processing || canSave || selectedFile) && (
        <div ref={reviewCardRef}>
        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{processing ? "Processing receipt" : "Review receipt"}</CardTitle>
              <CardDescription>
                {processing
                  ? "Uploading securely and extracting fields from your receipt."
                  : "Confirm the extracted details before saving."}
              </CardDescription>
            </div>
            {!processing && (
              <Button variant="ghost" size="icon" onClick={clearScan} aria-label="Clear receipt review">
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {processing ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Receipt preview"
                        width={720}
                        height={960}
                        className="h-full max-h-[28rem] w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Preparing your file</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedFile?.type === "application/pdf"
                              ? "PDF selected. OCR is running now."
                              : "Generating a preview and extracting details."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{selectedFile.name}</p>
                          <p className="text-muted-foreground">{selectedFileSummary}</p>
                        </div>
                        {selectedFile.wasCompressed && (
                          <Badge variant="secondary">
                            Optimized from {formatReceiptFileSize(selectedFile.originalSize)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">Uploading securely and running OCR</p>
                        <p className="text-sm text-muted-foreground">
                          You can start checking the preview while we extract the merchant, amount, date, and notes.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Receipt upload and OCR</span>
                        <span>Please wait</span>
                      </div>
                      <Progress value={72} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-28 sm:col-span-2" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Receipt preview"
                        width={720}
                        height={960}
                        className="h-full max-h-[28rem] w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Preview unavailable</p>
                          <p className="text-sm text-muted-foreground">
                            PDF receipts and some files can still be reviewed and saved normally.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{selectedFile.name}</p>
                          <p className="text-muted-foreground">{selectedFileSummary}</p>
                        </div>
                        {selectedFile.wasCompressed && (
                          <Badge variant="secondary">
                            Optimized from {formatReceiptFileSize(selectedFile.originalSize)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {processingResult && (
                    <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={receiptStatusTone === "destructive" ? "destructive" : receiptStatusTone}>
                          {processingResult.status === "success"
                            ? "Ready to save"
                            : processingResult.status === "partial"
                              ? "Needs attention"
                              : "Review manually"}
                        </Badge>
                        <Badge variant="secondary">
                          OCR {processingResult.ocr_status}
                        </Badge>
                        <Badge variant="secondary">
                          Upload {processingResult.upload_status}
                        </Badge>
                        {processingResult.ocr_status === "succeeded" && (
                          <Badge variant="secondary">
                            {Math.round(processingResult.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>

                      {(processingResult.warning || processingResult.error || hasWeakConfidence) && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="space-y-1">
                              {processingResult.warning && <p>{processingResult.warning}</p>}
                              {processingResult.error && <p>{processingResult.error}</p>}
                              {hasWeakConfidence && (
                                <p>Some important fields look uncertain. Double-check the values before saving.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {recoveryActions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {recoveryActions.includes("retry_ocr") && (
                            <Button type="button" variant="outline" onClick={retryOCR} disabled={processing}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Retry OCR
                            </Button>
                          )}
                          {recoveryActions.includes("retry_upload") && (
                            <Button type="button" variant="outline" onClick={retryUpload} disabled={processing}>
                              <Upload className="mr-2 h-4 w-4" />
                              Retry upload
                            </Button>
                          )}
                          {recoveryActions.includes("save_manually") && (
                            <Button type="button" variant="ghost" onClick={() => setFormErrors({})}>
                              Save manually without OCR
                            </Button>
                          )}
                        </div>
                      )}

                      {processingResult.raw_text && (
                        <details className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                          <summary className="cursor-pointer font-medium">Raw OCR text</summary>
                          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                            {processingResult.raw_text}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="receipt-vendor">Merchant</Label>
                      <Input
                        id="receipt-vendor"
                        value={formValues.vendor}
                        onChange={(event) => setFormValues((current) => ({ ...current, vendor: event.target.value }))}
                        className="border-border bg-muted/30"
                        placeholder="e.g. Amazon, Uber, Starbucks"
                      />
                      {formErrors.vendor && <p className="text-xs text-destructive">{formErrors.vendor}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt-amount">Amount</Label>
                      <Input
                        id="receipt-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formValues.amount}
                        onChange={(event) => setFormValues((current) => ({ ...current, amount: event.target.value }))}
                        className="border-border bg-muted/30"
                        placeholder="0.00"
                      />
                      {formErrors.amount && <p className="text-xs text-destructive">{formErrors.amount}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={formValues.category}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }

                          setFormValues((current) => ({ ...current, category: value }));
                        }}
                      >
                        <SelectTrigger className="border-border bg-muted/30">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category.name} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt-date">Date</Label>
                      <Input
                        id="receipt-date"
                        type="date"
                        value={formValues.date}
                        onChange={(event) => setFormValues((current) => ({ ...current, date: event.target.value }))}
                        className="border-border bg-muted/30"
                      />
                      {formErrors.date && <p className="text-xs text-destructive">{formErrors.date}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receipt-description">Notes</Label>
                    <Textarea
                      id="receipt-description"
                      rows={4}
                      value={formValues.description}
                      onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
                      className="resize-none border-border bg-muted/30"
                      placeholder="Optional notes about this expense"
                    />
                    {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Receipt attachment</span>
                      <Badge variant="secondary">
                        {processingResult?.receipt_path ? "Attached" : "Manual-only"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Previewed total</span>
                      <span className="font-semibold">
                        {formValues.amount ? formatCurrency(Number(formValues.amount)) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {!isCaptureMode && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Saved Receipts</h2>
          {receipts.length === 0 ? (
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-lg font-medium">No saved receipts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload your first receipt to create a linked expense entry.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {receipts.map((receipt) => (
                <Card
                  key={receipt.id}
                  onClick={() => setViewReceipt(receipt)}
                  className="cursor-pointer border-border bg-card/80 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                      {receipt.receipt_access_url ? (
                        <Image
                          src={receipt.receipt_access_url}
                          alt="Receipt"
                          width={300}
                          height={128}
                          className="h-full w-full object-cover"
                          unoptimized
                          onError={() => {
                            applyReceiptUpdate(receipt.id, (current) => ({
                              ...current,
                              receipt_url: null,
                              receipt_access_url: null,
                              receipt_access_state: "missing",
                            }));
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 px-3 text-center text-muted-foreground">
                          <FileText className="h-10 w-10" />
                          <p className="text-xs">
                            {receipt.receipt_access_state === "missing"
                              ? "Receipt needs attention"
                              : "Receipt preview unavailable"}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="truncate font-medium">{receipt.vendor ?? "Unknown"}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(receipt.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {DATE_FORMATTER.format(new Date(receipt.date))}
                      </span>
                    </div>
                    {receipt.receipt_access_state === "missing" && (
                      <p className="mt-2 text-xs text-amber-400">Tap to refresh or remove the broken reference.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pending offline uploads ── */}
      <PendingQueuePanel />

      <Dialog open={!!viewReceipt} onOpenChange={(open) => !open && setViewReceipt(null)}>
        <DialogContent className="border-border bg-card/95 backdrop-blur-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewReceipt?.vendor ?? "Receipt"}</DialogTitle>
            <DialogDescription>
              {viewReceipt && `${formatCurrency(viewReceipt.amount)} • ${DATE_FORMATTER.format(new Date(viewReceipt.date))}`}
            </DialogDescription>
          </DialogHeader>

          {viewReceipt && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                {viewReceipt.receipt_access_url ? (
                  <Image
                    src={viewReceipt.receipt_access_url}
                    alt="Full receipt"
                    width={480}
                    height={640}
                    className="w-full object-contain"
                    unoptimized
                    onError={() => {
                      applyReceiptUpdate(viewReceipt.id, (receipt) => ({
                        ...receipt,
                        receipt_url: null,
                        receipt_access_url: null,
                        receipt_access_state: "missing",
                      }));
                    }}
                  />
                ) : (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Receipt preview unavailable</p>
                      <p className="text-sm text-muted-foreground">
                        Refresh access or remove the broken reference if the file is gone.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{viewReceipt.category}</Badge>
                {viewReceipt.description && <span className="truncate">{viewReceipt.description}</span>}
              </div>

              <Separator className="bg-muted/50" />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refreshReceiptAccess(viewReceipt.id)}
                  disabled={refreshingReceiptId === viewReceipt.id}
                >
                  {refreshingReceiptId === viewReceipt.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh access
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeBrokenReceiptReference(viewReceipt.id)}
                  disabled={removingReceiptId === viewReceipt.id}
                >
                  {removingReceiptId === viewReceipt.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Remove reference
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {canSave && !processing && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border"
          style={isCaptureMode ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" } : undefined}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {processingResult?.receipt_path
                ? "Your receipt will be attached to this expense."
                : "You can still save manually even without an attached receipt file."}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={clearScan} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveExpense()} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save expense
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
