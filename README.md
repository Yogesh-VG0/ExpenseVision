# ExpenseVision

**AI-powered expense tracking with receipt OCR, smart budgets, and financial insights — built as a production-grade PWA.**

[![Live App](https://img.shields.io/badge/Live-expensevision.tech-F59E0B?style=flat-square&logo=vercel)](https://expensevision.tech)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20DB%20%7C%20Storage-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=flat-square&logo=render)](https://render.com)

---

## What is ExpenseVision?

ExpenseVision is a full-featured personal finance application that lets users track expenses, scan receipts with AI-powered OCR, set category budgets with automatic alerts, import bank CSVs, and receive AI-generated spending insights. It ships as an installable Progressive Web App with offline support, share-target integration, and push notification infrastructure.

Built with Next.js 16 (App Router), React 19, Supabase, Google Gemini, and Tailwind CSS v4 — deployed on Render's free tier with Upstash Redis for rate limiting.

**[Try the live demo →](https://expensevision.tech/demo)**

---

## Features

| Category | Features |
|---|---|
| **Expense Tracking** | Manual entry, search/filter/sort, date range queries, category-color-coded tables, mobile-responsive card layout |
| **AI Receipt OCR** | Camera capture, file upload, drag-and-drop; Gemini 2.5 Flash primary → OpenRouter free-tier fallback; structured extraction (amount, vendor, date, category, line items, confidence score); magic-byte validation; client-side image compression |
| **Smart Budgets** | Per-category monthly limits, real-time progress bars, automatic 80%/100% threshold alerts with deduplication |
| **AI Insights** | On-demand AI-powered spending analysis — summaries, savings tips, budget alerts, trend analysis; fetches real user data server-side |
| **CSV Import** | 4-step wizard (upload → mapping → preview → import) with auto-detected column mapping, client-side validation, server-side chunked batches (50 rows/chunk), duplicate detection, category suggestion |
| **Notifications** | In-app notification center with unread badges, budget warning/exceeded alerts, weekly summaries (Render cron), read/mark-all-read, push delivery via web-push (VAPID) |
| **PWA** | Installable standalone app, service worker with cache-first static + network-first navigation, Background Sync for offline expense queue, Web Share Target for receipt import, File Handlers for OS-level file opening, Launch Queue consumption |
| **Multi-Currency** | Auto-detected from locale/timezone; 30+ currencies including UAE Dirham with custom font glyph; user-configurable in profile |
| **Demo Mode** | Full read-only demo at `/demo` with 20 realistic expenses, 7 budgets, 4 AI insights — no account required |
| **Auth** | Email/password + Google + GitHub OAuth via Supabase Auth; email confirmation; password reset; session-based middleware protection |
| **Security** | Supabase RLS on all tables, server-side auth on all API routes, file magic-byte validation (JPEG/PNG/WebP/GIF/HEIC/PDF), Zod input validation, CSP/HSTS/X-Frame-Options headers, open-redirect prevention, rate limiting on all mutation routes |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.3 (App Router, standalone output) |
| **Language** | TypeScript (strict mode) |
| **UI** | React 19, Tailwind CSS v4, shadcn/ui (base-nova), @base-ui/react, Lucide icons |
| **Database** | Supabase PostgreSQL with RLS |
| **Auth** | Supabase Auth (email/password, Google OAuth, GitHub OAuth) |
| **Storage** | Supabase Storage (private `receipts` bucket, signed URLs) |
| **AI / OCR** | Google Gemini 2.5 Flash (direct API) → OpenRouter free models (fallback) |
| **Caching** | Upstash Redis (sliding-window rate limiting) |
| **Charts** | Recharts |
| **Validation** | Zod v4 |
| **Testing** | Vitest (76 unit tests), Playwright (E2E) |
| **CI/CD** | GitHub Actions (type-check → lint → test → build) |
| **Deployment** | Render (free tier, standalone Node.js server) |
| **PWA** | Custom service worker, Web App Manifest, Background Sync, Share Target, File Handlers |

---

## Architecture

```
Browser (React 19 client)
    │
    ├── Next.js App Router (server components + client components)
    │       │
    │       ├── Middleware (src/proxy.ts) — auth enforcement, route protection
    │       │
    │       ├── Server Components — SSR data fetching via Supabase server client
    │       │
    │       └── API Routes (/api/*) — business logic, AI calls, rate limiting
    │               │
    │               ├── Supabase PostgreSQL (RLS-protected tables)
    │               ├── Supabase Storage (private receipt bucket)
    │               ├── Google Gemini API (OCR + Insights)
    │               ├── OpenRouter API (fallback AI)
    │               └── Upstash Redis (rate limiting)
    │
    ├── Service Worker (sw.js) — caching, Background Sync, Push
    │
    └── IndexedDB — offline expense queue
```

---

## Key User Flows

1. **Receipt → Expense**: Capture/upload receipt → client compression → server upload to Supabase Storage → OCR via Gemini/OpenRouter → review extracted fields → save expense with receipt link
2. **Budget Alert**: Add expense → server checks category budget → creates notification at 80% or 100% threshold → badge appears in nav → notification center shows alert
3. **CSV Import**: Select file → auto-detect columns → map/validate → chunked server import with duplicate detection → budget alerts fire per category
4. **Offline Save**: Network fails during save → expense queued in IndexedDB → Background Sync registered → queue processes on reconnect → idempotency key prevents duplicates
5. **Share Target**: Share receipt image from another app → ExpenseVision receives file → upload + store draft → redirect to capture flow → OCR + review + save

---

## Local Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- At least one AI API key: `GEMINI_API_KEY` or `OPENROUTER_API_KEY`

### Steps

```bash
git clone https://github.com/your-username/ExpenseVision.git
cd ExpenseVision
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

Apply Supabase migrations in order:

```sql
-- Run in Supabase SQL Editor:
-- 001_initial_schema.sql
-- 002_align_categories.sql
-- 003_add_profiles_insert_policy.sql
-- 004_add_idempotency_key.sql
-- 005_notifications_table.sql
-- 006_push_subscriptions.sql
-- 007_budget_unique_constraint.sql
```

Create a private `receipts` storage bucket in Supabase Dashboard with 10 MB file limit.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (e.g., `https://expensevision.tech`) |
| `SUPABASE_SERVICE_ROLE_KEY` | For account deletion | Supabase service role key (admin operations) |
| `GEMINI_API_KEY` | For AI features | Google Gemini API key |
| `OPENROUTER_API_KEY` | Fallback AI | OpenRouter API key (free models available) |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis token |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key |
| `CRON_SECRET` | Optional | Secret for authenticated cron endpoints |

---

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build (standalone output)
npm run start     # Start standalone production server
npm run lint      # ESLint check
npm test          # Run Vitest unit tests
npm run test:watch # Vitest in watch mode
```

---

## Testing

**Unit Tests** — 76 tests across 11 files covering:
- Zod validation schemas
- CSV parser and date/amount parsing
- Duplicate detection scoring
- Merchant normalization (80+ known variants)
- Category suggestion engine
- Receipt file validation and magic bytes
- Receipt share draft serialization
- Offline queue IndexedDB operations
- Receipt capture compression logic

**E2E Tests** — Playwright spec for sign-in → add expense → verify flow (requires test credentials).

**CI** — GitHub Actions runs type-check, lint, unit tests, and build on every push/PR to `main`.

---

## Deployment

Deployed on **Render free tier** via the included `render.yaml` Blueprint:

- **Build**: `npm install && npm run build`
- **Start**: `node scripts/run-standalone.mjs` (Next.js standalone server)
- **Health check**: `/api/warmup` → `{ "status": "ok" }`
- **Cron**: Weekly spending summary generation every Monday at 9 AM UTC

**Free-tier notes**: Render spins down after 15 min of inactivity. First request after spin-down takes ~30–60s. Supabase free tier auto-pauses after 1 week of inactivity.

---

## PWA / Mobile

- **Install**: "Install App" button in sidebar, or browser install prompt
- **Offline**: Expenses queued in IndexedDB, synced via Background Sync (Chromium) or manual retry
- **Share Target**: Share receipt images/PDFs directly into ExpenseVision from other apps
- **File Handlers**: Open receipt files with ExpenseVision from OS file picker (Chromium desktop)
- **Service Worker**: Cache-first for static assets, network-first for navigation, API/auth routes bypass cache

> **Platform caveats**: Background Sync and File Handlers are Chromium-only progressive enhancements. Push notifications are delivered via `web-push` for budget alerts and weekly summaries when VAPID keys are configured. The in-app notification center serves as the primary fallback channel.

---

## Security

- All API routes verify auth server-side via `supabase.auth.getUser()`
- Supabase RLS enforces `user_id = auth.uid()` on all tables
- File uploads validated by MIME type, extension, size, and magic bytes
- Input sanitized with Zod; HTML tags stripped from user text
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers
- Rate limiting on all mutation routes (Upstash Redis, graceful fallback if unconfigured)
- Open-redirect prevention on auth callback paths
- Service role key used only for admin account deletion

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/                # 17 API route files across 11 domains
│   ├── dashboard/          # Authenticated dashboard (SSR + client)
│   ├── demo/               # Read-only demo mode (6 pages)
│   ├── auth/               # OAuth callback + email confirmation
│   ├── expenses/           # Expense management
│   ├── budgets/            # Budget management
│   ├── receipts/           # Receipt scanner + capture + share target
│   ├── insights/           # AI-powered insights
│   ├── imports/            # CSV import wizard
│   ├── notifications/      # Notification center
│   └── settings/           # Profile + preferences + account deletion
├── components/             # 53 component files
│   ├── ui/                 # shadcn/ui primitives (25 components)
│   ├── landing/            # Landing page sections (11 components)
│   ├── dashboard/          # Dashboard widgets (5 components)
│   ├── receipts/           # Receipt workspace + pending queue
│   ├── expenses/           # Expense form dialog
│   ├── budgets/            # Budget form dialog
│   └── imports/            # CSV import wizard
├── lib/                    # 26 utility modules
│   ├── supabase/           # Client, server, admin Supabase clients
│   └── ...                 # Types, validations, AI helpers, offline queue, etc.
├── __tests__/              # 11 Vitest test files (76 tests)
└── proxy.ts                # Next.js middleware (auth + route protection)
supabase/migrations/        # 6 SQL migration files
public/                     # SW, manifest, icons, fonts
e2e/                        # Playwright E2E spec
```

---

## Known Limitations

- **Email receipt forwarding** is scaffolded (`email-receipt-parser.ts`) but not implemented.
- **Render cold starts** add 30–60s latency after inactivity periods.
- **No real-time updates** — dashboard data requires page refresh or navigation.
- **File Handlers / Launch Queue** are Chromium desktop-only.
- **Background Sync** is Chromium-only; other browsers use manual retry UI.
- **CSP** uses `'unsafe-inline'` for scripts — required by Next.js inline script injection; nonce-based CSP is a future improvement.

---

## Full Documentation

See **[DOCUMENTATION.md](./DOCUMENTATION.md)** for the complete technical reference including database schema, API inventory, security model, PWA architecture details, and deployment guide.

---

## License

MIT — see [LICENSE](./LICENSE).
