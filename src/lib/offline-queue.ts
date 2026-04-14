/**
 * Offline pending-upload queue backed by IndexedDB.
 *
 * Each queue entry preserves enough state to retry expense saves when the
 * network comes back — including form values, receipt blob data, and an
 * idempotency key that prevents the server from creating duplicate rows on
 * repeated attempts.
 */

export type PendingUploadStatus =
  | "queued"
  | "retrying"
  | "succeeded"
  | "failed";

export interface PendingUploadEntry {
  id: string;
  status: PendingUploadStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError: string | null;
  formValues: {
    amount: string;
    vendor: string;
    category: string;
    description: string;
    date: string;
  };
  /** Storage path already uploaded to Supabase, if available */
  receiptPath: string | null;
  /** Base64 data URL of the receipt image for preview */
  receiptPreview: string | null;
}

const DB_NAME = "expensevision_offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_uploads";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export function isOfflineQueueAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueuePendingUpload(
  entry: Omit<PendingUploadEntry, "id" | "status" | "createdAt" | "updatedAt" | "retryCount" | "lastError" | "idempotencyKey">
): Promise<PendingUploadEntry> {
  const now = new Date().toISOString();
  const record: PendingUploadEntry = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    lastError: null,
    ...entry,
  };

  await withStore("readwrite", (store) => store.put(record));
  return record;
}

export async function getAllPendingUploads(): Promise<PendingUploadEntry[]> {
  const all = await withStore<PendingUploadEntry[]>(
    "readonly",
    (store) => store.index("createdAt").getAll()
  );
  return all.filter((e) => e.status !== "succeeded");
}

export async function getPendingUploadById(
  id: string
): Promise<PendingUploadEntry | null> {
  const result = await withStore<PendingUploadEntry | undefined>(
    "readonly",
    (store) => store.get(id)
  );
  return result ?? null;
}

export async function updatePendingUpload(
  id: string,
  updates: Partial<Pick<PendingUploadEntry, "status" | "retryCount" | "lastError" | "formValues" | "receiptPath">>
): Promise<void> {
  const existing = await getPendingUploadById(id);
  if (!existing) return;

  const updated: PendingUploadEntry = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await withStore("readwrite", (store) => store.put(updated));
}

export async function removePendingUpload(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function clearSucceededUploads(): Promise<void> {
  const all = await withStore<PendingUploadEntry[]>(
    "readonly",
    (store) => store.getAll()
  );

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  for (const entry of all) {
    if (entry.status === "succeeded") {
      store.delete(entry.id);
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const MAX_RETRY_COUNT = 5;
