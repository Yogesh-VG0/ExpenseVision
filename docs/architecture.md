# ExpenseVision Architecture

## Core Runtime

ExpenseVision uses the Next.js App Router for authenticated pages and API routes.
Supabase provides:

- authentication
- PostgreSQL tables for profiles, expenses, budgets, AI insights, notifications, push subscriptions, and receipts
- storage for uploaded receipt files

The client UI is built with React, Tailwind CSS, and shared UI primitives in `src/components/ui`.

## Main Domains

### Expenses

- authoritative records live in the `expenses` table
- `receipt_url` stores either a Supabase Storage path or a direct URL
- the expenses API validates writes through Zod
- idempotency keys prevent duplicate records during retries or offline sync

### Receipts

The receipt flow spans:

- `src/app/api/ocr/route.ts`
- `src/app/api/expenses/route.ts`
- `src/app/api/receipts/access/route.ts`
- `src/app/expenses/[id]/receipt/route.ts`
- `src/app/receipts/capture/page.tsx`
- `src/app/receipts/share-target/route.ts`
- `src/components/receipts/receipt-workspace.tsx`
- `src/lib/receipt-capture.ts`
- `src/lib/receipt-share.ts`
- `src/lib/receipt-records.ts`
- `src/app/receipts/page.tsx`

Receipt ingestion treats upload and OCR as separate lifecycle steps.
That allows:

- upload success with OCR failure
- OCR success with upload failure
- manual expense save with or without an attached receipt
- retry OCR from a stored receipt path
- retry upload from the original in-memory file
- refresh signed access URLs for already-saved receipts
- remove broken saved receipt references

#### Mobile Capture (Phase B)

The `/receipts/capture` page reuses the same OCR and review state machine while changing presentation:

- immersive authenticated layout inside the app shell
- camera-first CTA plus upload/PDF fallback
- early local preview when possible
- client-side optimization for large supported photo types before upload
- hidden saved-history grid so the route stays focused on capture and review

#### Share-Target (Phase C)

The share flow works like this:

- `manifest.ts` advertises a Web Share Target for image and PDF files
- `/receipts/share-target` receives the shared `POST`, validates the file, uploads it once, persists a receipt row, and redirects to `/receipts/capture`
- `ReceiptWorkspace` resumes from a short-lived shared draft, refreshes signed preview access for the stored receipt path, then runs OCR using the existing `receipt_path` retry path
- local resume state preserves review context across refresh/reopen for a limited time
- `/api/expenses` rejects saving a second expense when the same stored receipt path is already linked to an existing expense

### Offline Resilience (Phase D)

- IndexedDB-backed queue for pending expense uploads (`src/lib/offline-queue.ts`)
- Service Worker Background Sync triggers client-side queue processing via `postMessage` (`public/sw.js`)
- Retry engine with exponential backoff and idempotency keys (`src/lib/offline-retry.ts`)
- In-app `PendingQueuePanel` component for visibility and manual retry

### Notifications & Alerts (Phase E)

- In-app notification center at `/notifications` with unread badges and mark-as-read
- Budget threshold alerts (80% and 100%) created automatically on expense save
- Weekly summary generation via `/api/notifications/weekly-summary`
- User notification preferences stored in `profiles.notification_preferences`
- Budget alerts and weekly summaries respect opt-out preferences
- VAPID push subscription management (subscribe/unsubscribe) with capability detection
- Service worker handles incoming push events and notification click routing

> **Current limitation:** Push subscription storage and SW handlers are implemented.
> Server-side push delivery (using `web-push` to actually send notifications to subscribers) is not yet implemented.
> The in-app notification center is the primary notification experience.

> **Weekly summary note:** The `/api/notifications/weekly-summary` endpoint currently requires an authenticated user session (it uses `supabase.auth.getUser()` to scope the query). This means it cannot be triggered by a simple external cron/scheduler without a logged-in user context. Realistic future options include:
> - Refactoring to use a service-role key and iterating over all users with the preference enabled
> - Triggering from a client-side periodic check when the user visits the app
> In the current version, the endpoint works when called from an authenticated browser session (e.g., from Settings or a manual trigger).

### Data Quality (Phase F)

- Merchant normalization with 80+ known variants (`src/lib/merchant-normalize.ts`)
- Duplicate detection scoring based on vendor, amount, and date proximity (`src/lib/duplicate-detection.ts`)
- Category suggestions from merchant maps and OCR keywords (`src/lib/category-suggest.ts`)
- Interactive `DuplicateWarningDialog` component for explicit review

### CSV Import (Phase G)

- 5-step `CSVImportWizard` at `/imports`
- Auto-detecting column header mapping (`src/lib/csv-parser.ts`)
- Client-side validation with currency and date normalization
- Batch creation with idempotency keys

### AI Insights

AI insights are generated server-side from user data fetched directly from Supabase.
Provider order is:

1. Gemini
2. OpenRouter fallback

## Service Worker and PWA Layer

The PWA layer includes:

- install prompt handling in `src/components/pwa-provider.tsx`
- manifest shortcuts in `src/app/manifest.ts`
- runtime caching in `public/sw.js`
- Background Sync support for offline expense queue
- push notification handling (receive and display)
- `file_handlers` manifest entry for opening receipt files directly
- `launchQueue` consumer that passes opened files into the capture flow via sessionStorage

The primary receipt shortcut points to `/receipts/capture`, which makes the installed app open directly into the focused scanner flow.
The manifest also advertises a share target that points into `/receipts/share-target`, which then redirects into the same capture route.

The current service worker avoids caching JS and CSS with a long-lived cache-first strategy, which reduces stale asset risk across redeploys.

### Platform Support Notes

- File handlers and launchQueue are Chromium desktop-only progressive enhancements
- Background Sync is Chromium-only; other browsers degrade to manual retry
- Push subscription UI works in Chromium and Firefox; Safari support varies
- Web Share Target requires an installed PWA on supporting platforms

## Telemetry

Telemetry is intentionally lightweight:

- shared client abstraction in `src/lib/telemetry.ts`
- server sink in `src/app/api/telemetry/route.ts`

Today it records receipt lifecycle, install-prompt, and push subscription events.

## Verification Strategy

Current automated verification includes:

- 69 unit tests across 11 test files covering:
  - offline queue mechanics
  - duplicate detection
  - merchant normalization
  - category suggestion
  - CSV parsing
  - receipt helpers
  - receipt capture helpers
  - receipt share helpers
  - budget alert logic
  - Zod schema validation
  - type guard helpers
- Playwright E2E framework for manual expense creation flow
- ESLint with Next.js core-web-vitals and TypeScript rules
- TypeScript strict-mode compile check (`tsc --noEmit`)

See `docs/setup.md` for local setup and verification instructions.
