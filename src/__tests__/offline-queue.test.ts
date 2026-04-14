import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IndexedDB with a simple in-memory store
const store = new Map<string, unknown>();

const mockIDBRequest = (result: unknown) => ({
  result,
  onsuccess: null as null | (() => void),
  onerror: null as null | (() => void),
  error: null,
});

const mockObjectStore = {
  put: vi.fn((val) => {
    const req = mockIDBRequest(undefined);
    store.set(val.id, val);
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  get: vi.fn((id) => {
    const req = mockIDBRequest(store.get(id));
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  getAll: vi.fn(() => {
    const req = mockIDBRequest(Array.from(store.values()));
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  delete: vi.fn((id) => {
    store.delete(id);
    const req = mockIDBRequest(undefined);
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  createIndex: vi.fn(),
  index: vi.fn(() => ({ getAll: mockObjectStore.getAll })),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
  oncomplete: null as null | (() => void),
  onerror: null as null | (() => void),
  error: null,
};

const mockDB = {
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(() => mockObjectStore),
  transaction: vi.fn(() => {
    const tx = { ...mockTransaction };
    setTimeout(() => tx.oncomplete?.(), 0);
    return tx;
  }),
  close: vi.fn(),
};

vi.stubGlobal("indexedDB", {
  open: vi.fn(() => {
    const req = mockIDBRequest(mockDB);
    setTimeout(() => {
      (req as unknown as { onupgradeneeded: null | (() => void) }).onupgradeneeded = null;
      req.onsuccess?.();
    }, 0);
    return req;
  }),
});

vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2, 8),
});

import {
  isOfflineQueueAvailable,
  MAX_RETRY_COUNT,
} from "@/lib/offline-queue";

describe("offline-queue", () => {
  beforeEach(() => {
    store.clear();
  });

  it("reports queue as available when IndexedDB exists", () => {
    expect(isOfflineQueueAvailable()).toBe(true);
  });

  it("MAX_RETRY_COUNT is a reasonable number", () => {
    expect(MAX_RETRY_COUNT).toBeGreaterThanOrEqual(3);
    expect(MAX_RETRY_COUNT).toBeLessThanOrEqual(10);
  });
});
