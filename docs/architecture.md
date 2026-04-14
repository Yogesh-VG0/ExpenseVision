# ExpenseVision Architecture

## Core Runtime

ExpenseVision uses the Next.js App Router for authenticated pages and API routes.
Supabase provides:

- authentication
- PostgreSQL tables for profiles, expenses, budgets, AI insights, and receipts
- storage for uploaded receipt files

The client UI is built with React, Tailwind CSS, and shared UI primitives in `src/components/ui`.

## Main Domains

### Expenses

- authoritative records live in the `expenses` table
- `receipt_url` stores either a Supabase Storage path or a direct URL
- the expenses API validates writes through Zod

### Receipts

The receipt flow spans:

- `src/app/api/ocr/route.ts`
- `src/app/api/expenses/route.ts`
- `src/app/api/receipts/access/route.ts`
- `src/app/api/expenses/[id]/receipt/route.ts`
- `src/app/receipts/capture/page.tsx`
- `src/app/receipts/share-target/route.ts`
- `src/components/receipts/receipt-workspace.tsx`
- `src/lib/receipt-capture.ts`
- `src/lib/receipt-share.ts`
- `src/lib/receipt-records.ts`
- `src/app/receipts/page.tsx`

Receipt ingestion now treats upload and OCR as separate lifecycle steps.
That allows:

- upload success with OCR failure
- OCR success with upload failure
- manual expense save with or without an attached receipt
- retry OCR from a stored receipt path
- retry upload from the original in-memory file
- refresh signed access URLs for already-saved receipts
- remove broken saved receipt references

Phase B builds on that flow with a dedicated mobile-first route.
The `/receipts/capture` page reuses the same OCR and review state machine while changing presentation:

- immersive authenticated layout inside the app shell
- camera-first CTA plus upload/PDF fallback
- early local preview when possible
- client-side optimization for large supported photo types before upload
- hidden saved-history grid so the route stays focused on capture and review

Phase C builds on the same route by adding a share-target handoff instead of a second receipt editor.
The share flow works like this:

- `manifest.ts` advertises a Web Share Target for image and PDF files
- `/receipts/share-target` receives the shared `POST`, validates the file, uploads it once, persists a receipt row, and redirects to `/receipts/capture`
- `ReceiptWorkspace` resumes from a short-lived shared draft, refreshes signed preview access for the stored receipt path, then runs OCR using the existing `receipt_path` retry path
- local resume state preserves review context across refresh/reopen for a limited time
- `/api/expenses` now rejects saving a second expense when the same stored receipt path is already linked to an existing expense

### AI Insights

AI insights are generated server-side from user data fetched directly from Supabase.
Provider order is:

1. Gemini
2. OpenRouter fallback

## Service Worker and PWA Layer

The PWA layer currently includes:

- install prompt handling in `src/components/pwa-provider.tsx`
- manifest shortcuts in `src/app/manifest.ts`
- runtime caching in `public/sw.js`

The primary receipt shortcut now points to `/receipts/capture`, which makes the installed app open directly into the focused scanner flow.
The manifest also advertises a share target that points into `/receipts/share-target`, which then redirects into the same capture route.

The current service worker avoids caching JS and CSS with a long-lived cache-first strategy, which reduces stale asset risk across redeploys.

## Telemetry

Telemetry is intentionally lightweight:

- shared client abstraction in `src/lib/telemetry.ts`
- server sink in `src/app/api/telemetry/route.ts`

Today it primarily records receipt and install-prompt lifecycle events, but the adapter model keeps future provider integration low-friction.

## Verification Strategy

Current automated verification includes:

- Zod schema tests
- type/helper tests
- receipt helper tests
- receipt capture helper tests
- receipt share helper tests
- lint
- TypeScript no-emit compile check

Later phases should expand this with route-level tests, browser-level happy paths, share/import flows, offline queue tests, and notification/budget alert coverage.
