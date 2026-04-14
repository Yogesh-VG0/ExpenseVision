# ExpenseVision

ExpenseVision is a Next.js 16 + Supabase expense tracker focused on fast receipt capture, AI-assisted extraction, budgets, analytics, and an installable mobile-friendly PWA experience.

## Stack

- Next.js App Router
- React 19
- Supabase Auth, Database, and Storage
- Tailwind CSS 4
- Sonner toasts
- Vitest for unit tests
- Upstash Redis rate limiting when configured

## Current Product State

Already implemented in the app:

- email/password authentication
- expense tracking and filtering
- budget management
- AI insights generation
- receipt OCR with storage persistence
- receipt history with signed URL access
- account deletion with storage cleanup and auth-user removal
- install prompt banner and basic service worker caching

## Phase A Hardening Included

This repository now includes a hardened receipt flow:

- OCR responses explicitly model `success`, `partial`, and `error`
- storage upload and OCR can fail independently without collapsing into one generic error
- users can retry OCR from a stored receipt path
- users can retry upload from the original file in the current session
- users can save manually even when OCR is weak or unavailable
- broken receipt references can be removed from saved expenses
- receipts page no longer falls back to raw storage paths when signed URL generation fails
- install prompt accept/dismiss actions are tracked through a lightweight telemetry endpoint
- service worker registration checks for updates more safely across redeploys

## Phase B Mobile Capture Included

The receipt flow now also includes a dedicated mobile-first capture experience:

- a dedicated `/receipts/capture` route designed for installed-PWA and mobile use
- camera-first and file/PDF import actions with large tap targets
- immediate preview after selection when the browser can render the file locally
- client-side optimization for oversized JPEG and WebP receipt photos when that reduces upload cost safely
- reuse of the same hardened OCR, review, recovery, and save workflow already used on the main receipts page
- immersive app-shell behavior on the dedicated capture route so the scanner feels more app-like on mobile

## Phase C Share Into ExpenseVision Included

The installed-app receipt flow now also supports direct sharing into ExpenseVision on supported platforms:

- Web Share Target manifest support for receipt images and PDFs
- dedicated share-target receiver that uploads the shared file once, then redirects into `/receipts/capture`
- reuse of the existing capture, OCR, review, retry, manual-save, and expense-save flow after the handoff
- local resume state so refresh/reopen can restore the in-progress review without blindly re-uploading the file
- duplicate-save protection for already-linked shared receipt paths
- subtle installed-app education explaining how direct receipt sharing works and when to fall back to capture mode

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in the required values.

3. Run the Supabase SQL migrations in `supabase/migrations/`.

4. Create a private `receipts` storage bucket in Supabase.

5. Start the dev server.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Required for core app access:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Required for full account deletion:

- `SUPABASE_SERVICE_ROLE_KEY`

Required for AI-enhanced OCR and insights:

- `GEMINI_API_KEY` or `OPENROUTER_API_KEY`

Optional for rate limiting:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Supabase Notes

Apply the SQL migrations in order:

- `001_initial_schema.sql`
- `002_align_categories.sql`
- `003_add_profiles_insert_policy.sql`

The app expects a private `receipts` bucket with storage policies that let authenticated users insert, read, and delete files inside their own folder.

Account deletion depends on the service-role key because auth-user deletion is an admin operation.

## Receipt Flow

Receipt ingestion currently works like this:

1. User opens `/receipts` or the dedicated `/receipts/capture` flow.
2. User captures a photo or uploads an image/PDF.
3. Large supported photos can be optimized client-side before upload.
4. The file is previewed locally as early as possible.
5. The file is validated client-side and server-side.
6. The server attempts storage upload first when needed.
7. OCR runs through Gemini first, then OpenRouter fallback when configured.
8. The response returns structured OCR data plus upload/OCR status metadata.
9. The review screen lets the user edit merchant, amount, category, date, and notes before saving.
10. Saving the expense links `expenses.receipt_url` to the storage path and backfills the `receipts` table link if needed.

When Web Share Target is supported in an installed app, the flow can also begin with:

1. User shares a receipt image or PDF from another app into ExpenseVision.
2. `/receipts/share-target` validates and uploads the shared file once, then stores a short-lived draft handoff.
3. `/receipts/capture` resumes from that stored receipt path, refreshes preview access when possible, runs OCR, and opens the same review UI.
4. Refresh/reopen reuses local resume state so the user does not have to repeat the import handoff.

## Telemetry

The app includes a lightweight telemetry abstraction in `src/lib/telemetry.ts` and a server ingestion route at `src/app/api/telemetry/route.ts`.

Current tracked events:

- OCR start, success, and failure
- expense save success and failure
- install prompt accepted and dismissed

The abstraction is intentionally simple so a future analytics provider can be added without rewriting product flows.

## Scripts

```bash
npm run dev
npm run lint
npm test
```

## Verification Status

Latest local verification completed for this phase:

- `npm run lint`
- `npm test`
- `npx tsc --noEmit`

## Deployment Notes

- Set `NEXT_PUBLIC_APP_URL` to the final deployed origin so OCR fallback requests and PWA metadata resolve correctly.
- Set `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment if you want real account deletion.
- Redeploys are safer when the service worker is allowed to update in the background rather than forcing immediate asset takeover.
- If AI keys are missing, receipt OCR and AI insights degrade with explicit server errors instead of silent failure.

## Browser Support Notes

- The install prompt banner depends on browsers that fire `beforeinstallprompt`.
- `capture="environment"` is a progressive enhancement; some browsers ignore it and fall back to the normal file picker.
- The dedicated `/receipts/capture` route uses an immersive shell on authenticated app sessions, but it still falls back to normal file input behavior when mobile capture APIs are unavailable.
- Web Share Target receipt import is a progressive enhancement and typically requires an installed PWA experience on browsers/platforms that implement share targets.
- Some platforms may not expose ExpenseVision in the system share sheet even after install. In those cases, users should fall back to `/receipts/capture` and use the normal camera/upload actions.
- Shared receipt import still requires an authenticated app session. If the session has expired, the app redirects back to sign-in and the user may need to reopen the capture flow manually.
- Shared review state is resumed locally for a limited time to reduce duplicate processing on refresh/reopen, but it is not an offline queue.
- Client-side optimization currently targets large JPEG and WebP photos. PNG, GIF, and PDF uploads are preserved without attempted recompression.
- Signed receipt access is refreshed through authenticated API calls; if the underlying storage object is gone, the UI offers a recovery path instead of pretending the image still exists.
- PDF receipts are supported for upload and OCR processing, but preview availability depends on browser file handling and the current client UI.

## Architecture Reference

See `docs/architecture.md` for a concise architecture overview of the current app, the hardened receipt flow, and the dedicated mobile capture route.
