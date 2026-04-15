# ExpenseVision — Local Setup & Verification Guide

This document walks through getting ExpenseVision running locally from a fresh clone.

## Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- At least one AI API key: Gemini or OpenRouter (for OCR & insights)

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Configuration

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API (for account deletion) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |
| `GEMINI_API_KEY` or `OPENROUTER_API_KEY` | Google AI Studio / OpenRouter dashboard |

### Optional Variables

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Rate limiting (skipped if unset) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (skipped if unset) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push subscription registration (push delivery not yet implemented) |
| `VAPID_PRIVATE_KEY` | Push subscription server-side (push delivery not yet implemented) |

### VAPID Key Generation

If you want to test push subscription UI locally:

```bash
npx web-push generate-vapid-keys
```

Copy the public and private keys into `.env.local`.

> **Note:** Push subscription and UI are implemented, but server-side push delivery (actually sending notifications to devices) is not yet implemented. In-app notifications in the notification center work independently of push.

## 3. Supabase Database Setup

Apply all migrations in order from `supabase/migrations/`:

```sql
-- Run these in your Supabase SQL editor, in order:
-- 001_initial_schema.sql
-- 002_align_categories.sql
-- 003_add_profiles_insert_policy.sql
-- 004_add_idempotency_key.sql
-- 005_notifications_table.sql
-- 006_push_subscriptions.sql
```

## 4. Storage Bucket

In Supabase dashboard → Storage:

1. Create a new bucket named `receipts`
2. Set it to **private**
3. Add storage policies for authenticated users:
   - INSERT: `auth.uid()::text = storage.foldername(name)`
   - SELECT: `auth.uid()::text = storage.foldername(name)`
   - DELETE: `auth.uid()::text = storage.foldername(name)`

## 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6. Verification Commands

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Unit tests (69 tests across 11 files)
npm test

# E2E tests (requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local)
# Also requires Playwright browsers:
npx playwright install chromium
npx playwright test
```

## 7. Post-Clone Smoke Test

After setup, verify these flows work:

1. **Sign up / Sign in** — Create an account at `/signup`, sign in at `/login`
2. **Add manual expense** — Navigate to `/expenses`, add an expense with all fields
3. **Receipt capture** — Navigate to `/receipts/capture`, upload a receipt photo
4. **Budget creation** — Navigate to `/budgets`, create a budget for a category
5. **CSV import** — Navigate to `/imports`, upload a CSV with Date/Amount/Category columns
6. **Settings** — Navigate to `/settings`, verify profile, currency, and notification toggles
7. **Notifications** — Navigate to `/notifications`, check for any budget alerts

## Known Platform Caveats

- **Install prompt**: Relies on `beforeinstallprompt` (Chromium browsers only)
- **Camera capture**: `capture="environment"` is progressive; some browsers ignore it
- **Web Share Target**: Requires installed PWA on supported platforms; some OSes don't expose it in the share sheet even after install
- **Push subscription UI**: Works in Chromium/Firefox; server-side delivery not implemented
- **File handlers / launchQueue**: Desktop Chromium only; files are passed into the capture flow via sessionStorage
- **Background Sync**: Chromium only; degrades to manual retry on other browsers
- **PDF preview**: Upload and OCR work; inline preview availability depends on browser
