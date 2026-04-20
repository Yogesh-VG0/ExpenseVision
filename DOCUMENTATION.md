# ExpenseVision — Technical Documentation

> **Single source of truth** for the entire ExpenseVision codebase.
> Last updated to match the repo (OCR pipeline, auto-categorization, CSV/Excel import, CSP, env vars), April 2026.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Repository Structure](#3-repository-structure)
4. [Route and Page Inventory](#4-route-and-page-inventory)
5. [Component System](#5-component-system)
6. [Library and Utility Overview](#6-library-and-utility-overview)
7. [Supabase Schema and Migrations](#7-supabase-schema-and-migrations)
8. [Database Data Model](#8-database-data-model)
9. [Authentication and Authorization](#9-authentication-and-authorization)
10. [File Storage and Receipt Uploads](#10-file-storage-and-receipt-uploads)
11. [Receipt Ingestion and OCR Lifecycle](#11-receipt-ingestion-and-ocr-lifecycle)
12. [AI Integrations](#12-ai-integrations)
13. [Expense Management Flow](#13-expense-management-flow)
14. [Budget Management Flow](#14-budget-management-flow)
15. [Analytics and Insights](#15-analytics-and-insights)
16. [Notifications System](#16-notifications-system)
17. [CSV Import System](#17-csv-import-system)
18. [PWA Architecture](#18-pwa-architecture)
19. [Upstash Redis — Caching and Rate Limiting](#19-upstash-redis--caching-and-rate-limiting)
20. [SEO and Metadata](#20-seo-and-metadata)
21. [CI/CD and Deployment](#21-cicd-and-deployment)
22. [Environment Variables](#22-environment-variables)
23. [Testing Strategy](#23-testing-strategy)
24. [Security Model](#24-security-model)
25. [Performance and Monitoring](#25-performance-and-monitoring)
26. [Proxy Configuration](#26-proxy-configuration)
27. [Limitations, Tradeoffs, and Known Issues](#27-limitations-tradeoffs-and-known-issues)
28. [Future Opportunities](#28-future-opportunities)
29. [Glossary](#29-glossary)
30. [Live vs Repo Observations](#30-live-vs-repo-observations)

---

## 1. Project Overview

### Purpose

ExpenseVision is a personal finance web application that combines manual expense tracking with AI-powered receipt scanning, budget monitoring, and spending insights. It targets individuals who want to consolidate expense management into a single tool that works across devices including mobile.

### Audience

- Individual users tracking personal expenses
- The demo mode targets curious visitors, recruiters, and evaluators who want to see the product without creating an account

### Core Value Proposition

- Photograph a receipt, get structured expense data via AI OCR
- Set budgets per category and receive automatic alerts at spending thresholds
- Import existing bank data via CSV with intelligent column mapping
- Access everything offline-first via an installable PWA
- Get AI-generated financial insights based on real spending patterns

### Tech Philosophy

- **Server-first rendering** — pages use Next.js server components for initial data fetch, hydrating into client components for interactivity
- **Supabase as the entire backend** — auth, database, storage, and RLS policies eliminate the need for a custom backend
- **Progressive enhancement** — PWA features (Background Sync, Share Target, File Handlers) are additive; the app works without them
- **AI with graceful degradation** — receipt OCR tries **Veryfi** (when configured), then **Gemini**, then **OpenRouter**; AI insights use Gemini with OpenRouter fallback; manual entry is always available if OCR fails
- **Rate-limited by default** — every mutation endpoint is rate-limited even on free tier infrastructure

---

## 2. Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────┐
│                    Browser Client                      │
│                                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ React 19 UI │  │ Service Worker│  │  IndexedDB   │ │
│  │ (App Router)│  │   (sw.js)    │  │(offline queue)│ │
│  └──────┬──────┘  └──────┬───────┘  └──────────────┘ │
└─────────┼────────────────┼───────────────────────────┘
          │                │
          ▼                ▼
┌──────────────────────────────────────────────────────┐
│              Next.js Server (Render)                   │
│                                                        │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │   Middleware     │  │      API Routes          │   │
│  │  (src/proxy.ts)  │  │  /api/expenses           │   │
│  │                  │  │  /api/ocr                 │   │
│  │  Auth enforce +  │  │  /api/ai-insights         │   │
│  │  cookie refresh  │  │  /api/budgets             │   │
│  └─────────────────┘  │  /api/notifications        │   │
│                        │  /api/account              │   │
│                        │  /api/analytics            │   │
│                        │  /api/receipts             │   │
│                        │  /api/telemetry            │   │
│                        │  /api/warmup               │   │
│                        └─────────────┬──────────────┘   │
└───────────────────────────────────────┼─────────────┘
                                        │
          ┌─────────────────────────────┼──────────────────┐
          ▼                             ▼                   ▼
┌──────────────────┐  ┌──────────────────────────────┐  ┌──────────────┐
│   Supabase       │  │   OCR + AI providers        │  │ Upstash Redis│
│                  │  │                              │  │              │
│ ● Auth           │  │ ● Veryfi (optional OCR)      │  │ ● Rate limits│
│ ● PostgreSQL     │  │ ● Google Gemini 2.5 Flash   │  │   (sliding   │
│   (RLS-enforced) │  │   (+ Flash Lite for OCR)    │  │    window)   │
│ ● Storage        │  │ ● OpenRouter (OCR + insights │  │              │
│   (receipts      │  │   fallbacks, free VL models) │  │              │
│    bucket)       │  │                              │  │              │
└──────────────────┘  └──────────────────────────────┘  └──────────────┘
```

### Request Flow

1. **Browser** → Next.js middleware (`src/proxy.ts`) refreshes Supabase auth cookies and enforces route protection
2. **Server components** fetch data directly via Supabase server client (cookie-forwarded)
3. **Client components** call `/api/*` routes for mutations and AI operations
4. **API routes** authenticate via `supabase.auth.getUser()`, apply rate limiting via Upstash, execute business logic, interact with Supabase DB/Storage and AI providers
5. **Responses** flow back through Next.js to the browser

### Rendering Strategy

- **Server Components**: Dashboard page, expenses list page, budgets page, notifications page, imports page — initial data fetching happens server-side
- **Client Components**: All interactive forms, receipt workspace, expense/budget dialogs, chart components, settings page, insights page
- **Hybrid**: Pages use a `page.tsx` (server) that renders a `*-client.tsx` (client) component, passing server-fetched data as props

### Deployment Topology

- **Runtime**: Render.com free-tier web service
- **Build output**: Next.js standalone mode (`output: "standalone"` in `next.config.ts`)
- **Start command**: `node scripts/run-standalone.mjs` — copies `public/` and `static/` into the standalone directory then launches `server.js`
- **Health check**: `GET /api/warmup` returns `{ "status": "ok", "timestamp": ... }`

---

## 3. Repository Structure

```
ExpenseVision/
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI pipeline
├── e2e/
│   └── happy-path.spec.ts         # Playwright E2E test
├── public/
│   ├── sw.js                      # Service worker
│   ├── icons/                     # PWA app icons (multiple sizes)
│   ├── fonts/
│   │   └── dirham.{ttf,woff,woff2} # Custom UAE Dirham currency font
│   └── llms.txt                   # LLM reference text
├── scripts/
│   └── run-standalone.mjs         # Production standalone server launcher
├── src/
│   ├── app/
│   │   ├── api/                   # 12 API domains, 17 route handler files
│   │   │   ├── account/route.ts
│   │   │   ├── ai-insights/route.ts
│   │   │   ├── analytics/route.ts
│   │   │   ├── budgets/
│   │   │   │   ├── route.ts           # GET, POST
│   │   │   │   └── [id]/route.ts      # PUT, DELETE
│   │   │   ├── expenses/
│   │   │   │   ├── route.ts           # GET, POST
│   │   │   │   ├── [id]/route.ts      # GET, PUT, DELETE
│   │   │   │   ├── [id]/receipt/route.ts  # DELETE
│   │   │   │   └── import/route.ts    # POST
│   │   │   ├── notifications/
│   │   │   │   ├── route.ts           # GET, PATCH
│   │   │   │   ├── subscribe/route.ts # POST, DELETE
│   │   │   │   └── weekly-summary/route.ts # POST
│   │   │   ├── cron/
│   │   │   │   └── weekly-summary/route.ts  # POST, Bearer CRON_SECRET
│   │   │   ├── ocr/route.ts
│   │   │   ├── receipts/access/route.ts
│   │   │   ├── telemetry/route.ts
│   │   │   └── warmup/route.ts
│   │   ├── auth/
│   │   │   ├── callback/route.ts  # OAuth callback handler
│   │   │   └── confirm/route.ts   # Email confirmation handler
│   │   ├── dashboard/             # Main authenticated dashboard
│   │   ├── demo/                  # Read-only demo (6 page routes)
│   │   ├── expenses/              # Expense management
│   │   ├── budgets/               # Budget management
│   │   ├── receipts/              # Receipt scanner + workspace
│   │   ├── insights/              # AI-powered insights
│   │   ├── imports/               # CSV import wizard
│   │   ├── notifications/         # Notification center
│   │   ├── settings/              # Profile, preferences, deletion
│   │   ├── login/                 # Login page
│   │   ├── signup/                # Signup page
│   │   ├── forgot-password/       # Password reset request
│   │   ├── globals.css            # Global styles, themes, animations
│   │   ├── layout.tsx             # Root layout (metadata, fonts, providers)
│   │   ├── page.tsx               # Landing page
│   │   ├── manifest.ts            # Dynamic PWA manifest
│   │   ├── robots.ts              # Dynamic robots.txt
│   │   ├── sitemap.ts             # Dynamic sitemap.xml
│   │   ├── error.tsx              # Global error boundary
│   │   └── not-found.tsx          # 404 page
│   ├── components/
│   │   ├── ui/                    # 25 shadcn/ui primitive components
│   │   ├── landing/               # 11 landing page section components
│   │   ├── dashboard/             # 5 dashboard widget components
│   │   ├── receipts/              # Receipt workspace + pending queue
│   │   ├── expenses/              # Expense form dialog
│   │   ├── budgets/               # Budget form dialog
│   │   ├── imports/               # 4 CSV import wizard components
│   │   ├── notifications/         # Notification center + card
│   │   ├── app-shell.tsx          # Authenticated layout wrapper
│   │   ├── currency-provider.tsx  # Currency context provider
│   │   ├── pwa-provider.tsx       # PWA context provider
│   │   ├── theme-provider.tsx     # Theme (dark/light/system) provider
│   │   └── theme-toggle.tsx       # Theme toggle button
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── server.ts          # Server component Supabase client
│   │   │   └── admin.ts           # Service role admin client
│   │   ├── types.ts               # All TypeScript type definitions
│   │   ├── validations.ts         # Zod validation schemas
│   │   ├── redis.ts               # Upstash Redis + rate limiters
│   │   ├── rate-limit.ts          # Rate limit enforcement utility
│   │   ├── receipts.ts            # Receipt file validation + helpers
│   │   ├── expense-mutations.ts   # Expense creation with idempotency
│   │   ├── budget-alerts.ts       # Budget threshold alert logic
│   │   ├── duplicate-detection.ts # Expense duplicate scorer
│   │   ├── csv-parser.ts          # CSV parsing + column auto-detect
│   │   ├── category-suggest.ts    # Category inference from merchant/text
│   │   ├── merchant-normalize.ts  # Merchant name standardization
│   │   ├── offline-queue.ts       # IndexedDB offline expense queue
│   │   ├── offline-retry.ts       # Offline retry + Background Sync
│   │   ├── push-subscription.ts   # Web Push subscription helpers
│   │   ├── push-sender.ts         # Server-side web-push delivery
│   │   ├── receipt-records.ts     # Persist receipt OCR metadata to DB
│   │   ├── telemetry.ts           # Lightweight event tracking
│   │   ├── demo-data.ts           # Demo mode sample data
│   │   ├── constants.ts           # App-wide constants + formatters
│   │   ├── utils.ts               # cn() + safe redirect
│   │   ├── app-url.ts             # URL construction helpers
│   │   └── email-receipt-parser.ts # Stub — not implemented
│   ├── __tests__/                 # 11 Vitest test suites
│   └── proxy.ts                   # Next.js middleware
├── supabase/
│   ├── config.toml                # Supabase local config
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_align_categories.sql
│       ├── 003_add_profiles_insert_policy.sql
│       ├── 004_add_idempotency_key.sql
│       ├── 005_notifications_table.sql
│       ├── 006_push_subscriptions.sql
│       └── 007_budget_unique_constraint.sql
├── .env.example                   # Environment variable template
├── .gitignore
├── components.json                # shadcn/ui config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── render.yaml                    # Render deployment Blueprint
├── tsconfig.json
└── vitest.config.ts
```

---

## 4. Route and Page Inventory

### Frontend Pages

| Route | Auth Required | Purpose | Key Components |
|---|---|---|---|
| `/` | No | Landing page with marketing sections | Hero, Features, HowItWorks, Testimonials, FAQ, CTA, Footer |
| `/login` | No (redirects if authed) | Email/password + OAuth login | LoginClient |
| `/signup` | No (redirects if authed) | Account registration | SignupClient |
| `/forgot-password` | No | Password reset request | ForgotPasswordClient |
| `/auth/callback` | No | OAuth redirect handler (code exchange) | Server-side route handler |
| `/auth/confirm` | No | Email confirmation (token exchange) | Server-side route handler |
| `/dashboard` | Yes | Main dashboard with summary stats, charts, recent expenses | DashboardClient, ExpenseChart, CategoryBreakdown |
| `/expenses` | Yes | Full expense list with filters, sort, search | ExpensesClient, ExpenseFormDialog |
| `/budgets` | Yes | Budget list with progress bars | BudgetsClient, BudgetFormDialog |
| `/receipts` | Yes | Receipt scanner workspace | ReceiptWorkspace (capture, OCR, review, save) |
| `/receipts/share-target` | Yes | Web Share Target receiver | ReceiptWorkspace (auto-loaded with shared file draft) |
| `/receipts/capture` | Yes | File Handler receiver | ReceiptWorkspace (auto-loaded via launchQueue) |
| `/insights` | Yes | AI-generated spending analysis | InsightsClient |
| `/imports` | Yes | CSV import wizard | ImportWizard (4 steps) |
| `/notifications` | Yes | Notification center (all types) | NotificationsClient, NotificationCard |
| `/settings` | Yes | Profile, currency, notification prefs, account deletion | SettingsClient |
| `/demo` | No | Demo dashboard | DemoLayout + sample data |
| `/demo/expenses` | No | Demo expense list | Sample expenses |
| `/demo/budgets` | No | Demo budgets | Sample budgets |
| `/demo/receipts` | No | Demo receipt scanner (non-functional) | UI only, no OCR |
| `/demo/insights` | No | Demo AI insights | Sample insights |
| `/demo/settings` | No | Demo settings (read-only) | Display only |

### API Routes

| Method | Path | Auth | Rate Limit | Purpose |
|---|---|---|---|---|
| `GET` | `/api/expenses` | Yes | `apiRateLimit` | List user expenses with optional date range |
| `POST` | `/api/expenses` | Yes | `expenseMutationRateLimit` | Create expense (with idempotency key support) |
| `GET` | `/api/expenses/[id]` | Yes | `apiRateLimit` | Get single expense by ID |
| `PUT` | `/api/expenses/[id]` | Yes | `expenseMutationRateLimit` | Update expense |
| `DELETE` | `/api/expenses/[id]` | Yes | `expenseMutationRateLimit` | Delete expense (and unlink receipt) |
| `DELETE` | `/api/expenses/[id]/receipt` | Yes | `expenseMutationRateLimit` | Remove receipt link from expense |
| `POST` | `/api/expenses/import` | Yes | `importBatchRateLimit` | Bulk CSV import (chunked 50-row batches) |
| `POST` | `/api/ocr` | Yes | `aiRateLimit` | AI receipt OCR processing |
| `POST` | `/api/ai-insights` | Yes | `aiRateLimit` | Generate AI spending insights |
| `GET` | `/api/budgets` | Yes | `apiRateLimit` | List user budgets with spending totals |
| `POST` | `/api/budgets` | Yes | `budgetMutationRateLimit` | Create budget (prevents duplicate categories) |
| `PUT` | `/api/budgets/[id]` | Yes | `budgetMutationRateLimit` | Update budget |
| `DELETE` | `/api/budgets/[id]` | Yes | `budgetMutationRateLimit` | Delete budget |
| `POST` | `/api/receipts/access` | Yes | `apiRateLimit` | Refresh signed URL for stored receipt |
| `GET` | `/api/notifications` | Yes | None (auth only) | List user notifications (`page`, `limit`, pagination metadata) |
| `PATCH` | `/api/notifications` | Yes | `notificationMutationRateLimit` | Mark notifications as read |
| `POST` | `/api/notifications/subscribe` | Yes | `notificationMutationRateLimit` | Save push subscription |
| `DELETE` | `/api/notifications/subscribe` | Yes | `notificationMutationRateLimit` | Remove push subscription |
| `POST` | `/api/notifications/weekly-summary` | Yes | `apiRateLimit` | Generate weekly spending summary notification for the signed-in user |
| `POST` | `/api/cron/weekly-summary` | No (Bearer `CRON_SECRET`) | None | Weekly summaries for all opted-in users; invoked by Render cron in `render.yaml` |
| `DELETE` | `/api/account` | Yes | `accountMutationRateLimit` | Delete user account + data + storage |
| `GET` | `/api/analytics` | Yes | `apiRateLimit` | Aggregated analytics (totals, category breakdown, trends) |
| `POST` | `/api/telemetry` | Yes | `telemetryRateLimit` | Client event ingestion |
| `GET` | `/api/warmup` | No | None | Health check endpoint |

---

## 5. Component System

### Layout and Shell Components

| Component | File | Purpose |
|---|---|---|
| **AppShell** | `components/app-shell.tsx` | Primary authenticated layout — fixed sidebar on `md+`, mobile sheet menu, header with notifications, theme toggle, user menu / demo CTA, optional PWA install row, `CurrencyProvider` wrapping page content |
| **ThemeProvider** | `components/theme-provider.tsx` | React context for `light` / `dark` / `system`; reads/writes `localStorage`; applies class on `<html>`. Paired with **`ThemeInitScript`** in `layout.tsx` (inline script) so the first paint matches the saved theme and avoids hydration mismatches |
| **PWAProvider** | `components/pwa-provider.tsx` | Service worker registration, install prompt capture (`beforeinstallprompt`), `launchQueue` consumer, telemetry for PWA install events |
| **CurrencyProvider** | `components/currency-provider.tsx` | React context for currency formatting; auto-detects from user profile or locale/timezone; custom Dirham (`د.إ`) formatting; provides `formatCurrency(amount)` |
| **ThemeToggle** | `components/theme-toggle.tsx` | Dropdown toggle for light/dark/system themes |

### Feature Components by Domain

**Receipts**
- `ReceiptWorkspace` — Large client component implementing the full receipt flow: camera / library / drag-and-drop, **client-side compression** (`compressReceiptImage`), image preview or PDF placeholder, **indeterminate progress** while `POST /api/ocr` runs, OCR result review with **responsive layout** (stacked on small screens, side-by-side preview + **Expense details** on large screens), **touch-friendly** inputs, wrapped long warning/error text, **scrollable** raw OCR `<details>`, full-width **retry / recovery** actions on mobile, sticky bottom **Save expense** bar with safe-area padding in capture mode, share-target and launch-queue resume, history grid with signed URL refresh, and offline queue handoff.
- `PendingQueuePanel` (`pending-queue.tsx`) — Lists IndexedDB-backed offline expense uploads with retry/remove controls.

**Dashboard**
- `DashboardClient` — Composes dashboard widgets; server page passes expenses/budgets as props.
- `OverviewCards` — Stat cards (total spent, average per txn, budget usage %, month-over-month trend).
- `ExpenseChart` — Recharts chart for monthly (or period) spending.
- `CategoryBreakdown` — Donut / breakdown by category.
- `RecentActivity` — Recent expense rows with vendor, amount, date.
- `BudgetProgress` — Per-budget progress vs limits for the current view.

**Expenses**
- `ExpensesClient` — Full expense management: filterable/sortable table (desktop) and card list (mobile), date range picker, category filter, search, add/edit/delete with confirmation.
- `ExpenseFormDialog` — Modal form for creating/editing expenses with Zod validation, category selector, date picker, amount input, description field.

**Budgets**
- `BudgetsClient` — Budget list with progress bars (color-coded by percentage), spent vs limit display, edit/delete.
- `BudgetFormDialog` — Modal for creating/editing budgets with category dropdown (excludes already-budgeted categories) and **monthly limit** input (`monthly_limit` per `budgetSchema`).

**Imports**
- `ImportWizard` — 4-step flow: file select → column mapping → preview/validation → confirmation.
- `FileUploadStep` — CSV file selector with drag-and-drop.
- `ColumnMappingStep` — Auto-detected column headers with manual remapping controls.
- `PreviewStep` — Table preview of parsed rows with validation error highlights.
- `ConfirmStep` — Summary of rows to import with duplicate warnings.

**Insights**
- `InsightsClient` — Displays AI-generated spending insights. Fetches from server or generates on-demand. Shows summary, key findings, savings tips, budget alerts, and trend analysis in a structured card layout.

**Notifications**
- `NotificationsClient` — Notification center with tabs (all/unread), mark-all-read button, empty state.
- `NotificationCard` — Individual notification display with type icon, message, timestamp, read/unread state.

**Landing Page**
- `Navbar` — Navigation with logo, links, auth buttons (conditional based on session state).
- `Hero` — Main hero section with tagline, CTA buttons, and animated mock dashboard visual.
- `Features` — Feature grid with icon, title, description cards.
- `HowItWorks` — Step-by-step flow explanation.
- `Testimonials` — User testimonial cards.
- `SecurityPrivacy` — Security features highlight.
- `FAQ` — Accordion FAQ section.
- `CTA` — Final call-to-action section.
- `Footer` — Site footer with links.
- `DemoSection` — Promotional section linking to demo mode.

### shadcn/ui Component Library

25 base components in `src/components/ui/`:

`avatar`, `badge`, `button`, `calendar`, `card`, `chart`, `command`, `dialog`, `dropdown-menu`, `input`, `input-group`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

All built on `@base-ui/react` primitives with Tailwind CSS v4 styling. The project uses the `base-nova` theme variant defined in `components.json`.

### Design System Conventions

- **Colors**: Theme variables defined in `globals.css` for light and dark modes using HSL format (`--background`, `--foreground`, `--primary`, `--muted`, etc.)
- **Typography**: DM Sans (body) + JetBrains Mono (code/monospace), imported via `next/font`
- **Spacing**: Tailwind default scale
- **Animations**: Custom keyframes defined in `globals.css` for float, pulse-glow, shimmer, gradient rotation, fade-up/down, scale-in, slide-left/right, count-up, border-glow, slow-spin
- **Glassmorphism**: `.glass-card` utility class with backdrop blur and semi-transparent backgrounds

---

## 6. Library and Utility Overview

### `src/lib/types.ts`

Central type definitions for the entire application:

- **`Expense`** — `id`, `user_id`, `amount`, `category`, `description`, optional `vendor`, `date`, `tags`, `is_recurring`, `receipt_url` (storage path string when attached), timestamps
- **`Budget`** — `id`, `user_id`, `category`, `monthly_limit`, timestamps; UI layers compute `spent` / `percentage` / `remaining` from expenses
- **`AIInsight`** — AI-generated insight with id, user_id, content (structured JSON), provider, timestamps
- **`Profile`** — User profile with display_name, avatar_url, currency, notification_preferences
- **`Notification`** — Notification record with id, user_id, type, title, message, read status, metadata, timestamps
- **`PushSubscription`** — Web Push subscription with endpoint, keys, user_id, device_name
- **`ReceiptProcessingResult`** — Extends `OCRResult` with `status`, `upload_status`, `ocr_status`, `warning`, `error`, and `recovery_actions`
- **`OCRResult`** — `amount`, `vendor`, `date`, `category`, `description`, `line_items`, `confidence`, `raw_text`, `receipt_path`
- **Various enums** — NotificationType, `Category` (10 values in `CATEGORIES`), budget/insight helpers

### `src/lib/validations.ts`

Zod v4 schemas used for both client and server validation:

- **`expenseSchema`** — amount (positive, max `MAX_EXPENSE_AMOUNT`), `category` (one of 10 `VALID_CATEGORIES`), `description` (max 500, HTML-stripped), optional `vendor` (max 200), `date` (`YYYY-MM-DD`), optional `tags`, optional `receipt_url`
- **`budgetSchema`** — `category` (same 10 values), `monthly_limit` (positive, max `MAX_EXPENSE_AMOUNT`)
- **`signUpSchema`** — email (valid format), password (min 8, max 128, complexity rules), `full_name` (required, max 100)
- **`signInSchema`** — email + password (basic presence checks)
- **`importRowSchema`** — schema for CSV-imported rows with required amount/date, optional category/vendor/notes

### `src/lib/redis.ts`

Upstash Redis configuration:

- **Client initialization**: `new Redis({ url, token })` from env vars. Falls back to `null` if unconfigured.
- **Rate limiters** (all use `Ratelimit.slidingWindow`):

| Limiter | Window | Limit | Used By |
|---|---|---|---|
| `aiRateLimit` | 60s | 20 | `/api/ocr`, `/api/ai-insights` |
| `apiRateLimit` | 60s | 60 | All GET routes, `/api/receipts/access`, `/api/analytics`, `/api/notifications/weekly-summary` |
| `expenseMutationRateLimit` | 60s | 30 | `/api/expenses` POST/PUT/DELETE |
| `importBatchRateLimit` | 60s | 10 | `/api/expenses/import` |
| `budgetMutationRateLimit` | 60s | 20 | `/api/budgets` POST/PUT/DELETE |
| `notificationMutationRateLimit` | 60s | 30 | `/api/notifications` GET/PATCH, `/api/notifications/subscribe` |
| `telemetryRateLimit` | 60s | 120 | `/api/telemetry` |
| `accountMutationRateLimit` | 3600s (1h) | 5 | `/api/account` DELETE |

### `src/lib/rate-limit.ts`

Utility function `enforceRateLimit(request, limiter, identifier?)`:
- Extracts client IP from `x-forwarded-for` → `x-real-ip` → `"unknown"`
- Calls the provided rate limiter
- Returns 429 response with `Retry-After` header if exceeded
- **Gracefully skips** if Redis is not configured (returns `null`, allowing the request)

### `src/lib/receipts.ts`

Receipt file handling:

- **Constants**: Max 10 MB; allowed types include **JPEG, PNG, WebP, GIF, HEIC/HEIF, PDF** (see `RECEIPT_ALLOWED_TYPES` in `receipts.ts`)
- **`validateReceiptFile(file)`**: Client-side type + size check
- **`validateReceiptFileBytes(buffer, claimedType)`**: Server-side magic-byte validation (including HEIC/HEIF `ftyp` brands), JPEG, PNG, WebP, GIF, PDF
- **`buildReceiptStoragePath(userId, fileName)`**: Generates storage path `{userId}/{timestamp}-{random}-{sanitizedName}`
- **`inferMimeType(path)`**: Extension-based MIME inference
- **`serializeReceiptDraft(file) / deserializeReceiptDraft(data)`**: Converts files to/from base64 JSON for cross-page draft passing (used by Share Target)

### `src/lib/expense-mutations.ts`

`createExpenseRecord(supabase, userId, data)`:
- If `idempotency_key` is provided, checks for existing record with same user+key
- Returns existing record if found (idempotent behavior)
- Otherwise inserts a new expense, optionally persisting `receipt_url`
- Returns `{ expense, created: boolean }`

### `src/lib/budget-alerts.ts`

`checkBudgetAlerts(supabase, userId, category)`:
- Fetches budget for the given category and current month's spending
- If spending ≥ 100% of budget → creates "budget_exceeded" notification (deduplicated per month+category)
- If spending ≥ 80% of budget → creates "budget_warning" notification (deduplicated)
- Deduplication checks for existing notification with same type, category, and current month

### `src/lib/duplicate-detection.ts`

`detectDuplicate(candidate, existingExpenses)`:
- Scoring algorithm based on:
  - Amount match: exact = 40 points, within 1% = 20 points
  - Vendor similarity: exact = 30 points, includes = 15 points
  - Date proximity: same day = 30 points, within 1 day = 15 points, within 2 days = 5 points
- Returns `{ isDuplicate: boolean, confidence: number, matchedExpense }` with threshold at 70 points

### `src/lib/csv-parser.ts`

CSV / spreadsheet import utilities:

- **`parseCSVString(text)`**: Handles quoted fields, newlines in quotes, UTF-8 BOM, various line endings
- **`autoDetectMapping(headers)`**: Maps common header names to expense fields (date, amount, description, optional vendor/category/transaction type)
- **`parseAmount(value)`**: Strips currency symbols/commas, treats **negative bank debits** as positive expense amounts
- **`parseDate(value)`**: Tries ISO, US (`MM/DD/YYYY`), European (`DD.MM.YYYY`), and native `Date` parsing
- **`mapAndValidateRows()`**: Validates each row; category column values are normalized via **`normalizeImportCategoryLabel()`** from `category-suggest.ts`
- **`validateMappedRowEdit()`**: Re-validates a row after inline edits in the import preview UI

### `src/lib/category-suggest.ts`

Shared **auto-categorization** for receipt OCR, CSV/Excel import, and API fallbacks:

- **`normalizeImportCategoryLabel(raw)`** — Maps bank/spreadsheet labels (e.g. “Food & Drink”, “Gas & Fuel”, “Auto & Transport”) onto the **10 canonical** category names. Input is length-capped and lowercased; used by the client-side parser and **`POST /api/expenses/import`** when the CSV category is missing or non-canonical.
- **`suggestCategory(merchant, ocrText?)`** — Returns `{ category, confidence, source }`:
  - **Merchant match**: Substring dictionary sorted by **longest key first** (avoids e.g. `uber` swallowing `uber eats`).
  - **OCR / memo text**: **Weighted keyword scores** summed per category; best category wins if the score meets a minimum threshold (covers gas station receipts, pharmacies, etc., when the merchant name is generic).
  - **Fallback**: `"Other"`.
- **Security**: Merchant and OCR text are **truncated** before matching (bounded CPU/memory on untrusted strings).

See [Section 11](#11-receipt-ingestion-and-ocr-lifecycle) (post-OCR inference) and [Section 17](#17-csv-import-system) (import column resolution).

### `src/lib/merchant-normalize.ts`

`normalizeMerchant(raw)`:
- Strips transaction IDs, card suffixes, location info, reference numbers
- Normalizes spacing and casing
- Dictionary of 80+ known merchant variants (e.g., "AMZN MKTP" → "Amazon", "WHOLEFDS" → "Whole Foods")
- Falls back to title-case cleaned string

### `src/lib/offline-queue.ts`

IndexedDB-backed offline expense store:

- Database: `expensevision-offline`, store: `pending-uploads`
- **`enqueuePendingUpload(entry)`**: Stores expense form data + optional receipt preview (base64) with status "pending", retry count 0, idempotency key
- **`getAllPendingUploads()`**: Retrieves all queued entries
- **`updatePendingUpload(id, updates)`**: Updates status, retry count, error message
- **`removePendingUpload(id)`**: Deletes entry after successful sync

### `src/lib/offline-retry.ts`

Automatic retry system:

- **`registerOfflineRetry()`**: Registers event listeners on `online`, `focus`, `visibilitychange`
- **`registerBackgroundSync()`**: Registers SW Background Sync with tag `pending-expense-upload` (Chromium only)
- **`processQueue()`**: Iterates pending uploads, POSTs to `/api/expenses` with idempotency key, updates status on success/failure, removes successful entries
- The Service Worker `sync` event handler sends a `process-offline-queue` message to the client, which triggers `processQueue()`

### `src/lib/push-subscription.ts`

- **`checkPushCapability()`**: Returns boolean if `PushManager` is available and notification permission is granted/default
- **`subscribeToPush()`**: Requests notification permission, gets push subscription from SW registration, sends to `/api/notifications/subscribe`
- **`unsubscribeFromPush()`**: Unsubscribes from browser push manager, deletes from server

### `src/lib/telemetry.ts`

Lightweight client-side event tracking:

- Defined event names: `page_view`, `expense_create`, `expense_update`, `expense_delete`, `receipt_scan`, `receipt_upload`, `budget_create`, `insight_generate`, `csv_import`, `pwa_install`, `push_subscribe`, `push_unsubscribe`, `share_target_received`, `file_handler_opened`, `offline_queue_sync`
- **`trackEvent(name, properties?)`**: Sends POST to `/api/telemetry` (fire-and-forget, no error bubbling)
- Server-side `/api/telemetry` validates event names and logs them; rate-limited at 120/minute

### `src/lib/demo-data.ts`

Provides realistic sample data for demo mode:
- 20 expenses across varied categories, vendors, and dates
- 7 budgets with pre-calculated spend percentages
- 4 AI insight objects with structured content

### `src/lib/email-receipt-parser.ts`

**Status: Stub/placeholder — NOT implemented.**

Exports TypeScript interfaces (`EmailReceiptSource`, `ParsedEmailReceipt`) and a no-op `parseEmailReceipt()` function that returns `null`. Intended for future email forwarding receipt parsing.

### `src/lib/app-url.ts`

URL helpers:
- `getAppUrl()`: Returns `NEXT_PUBLIC_APP_URL` or `http://localhost:3000`
- `normalizeAppUrl(url)`: Ensures trailing-slash consistency

### `src/lib/constants.ts`

Application constants:
- `APP_NAME`, `APP_DESCRIPTION`
- `MAX_EXPENSE_AMOUNT` (999,999.99)
- `DEFAULT_CURRENCY` ("USD")
- `DATE_FORMAT`, `DATE_TIME_FORMAT` (using `date-fns` formatters)
- `CATEGORY_COLORS` — Maps each defined expense category name to a hex color (aligned with `CATEGORIES`)

### `src/lib/utils.ts`

- `cn(...inputs)`: Merges Tailwind classes using `clsx` + `tailwind-merge`
- `safeRedirectPath(path)`: Validates redirect targets — only allows paths starting with `/` and not `//` (prevents open redirect)

### `src/lib/supabase/client.ts`

`createBrowserClient()`: Creates a Supabase client for browser-side usage using `@supabase/ssr`'s `createBrowserClient` with public URL and anon key.

### `src/lib/supabase/server.ts`

`createServerClient()`: Creates a Supabase client for server components and API routes. Uses `@supabase/ssr`'s `createServerClient` with cookie-based session management, reading/setting cookies from Next.js `cookies()` API.

### `src/lib/supabase/admin.ts`

`createAdminClient()`: Creates a Supabase client using the `SUPABASE_SERVICE_ROLE_KEY`. Used for **account deletion** and the **`POST /api/cron/weekly-summary`** job (bulk reads across users). Returns `null` if the key is not configured.

---

## 7. Supabase Schema and Migrations

### Migration History

| # | File | Purpose |
|---|---|---|
| 001 | `001_initial_schema.sql` | Core schema: profiles, expenses, budgets, ai_insights, receipts tables + RLS + triggers |
| 002 | `002_align_categories.sql` | Category normalization, updated CHECK constraints, added tags/updated_at to expenses |
| 003 | `003_add_profiles_insert_policy.sql` | Added INSERT RLS policy for profiles table |
| 004 | `004_add_idempotency_key.sql` | Added idempotency_key column + partial unique index to expenses |
| 005 | `005_notifications_table.sql` | Created notifications table + RLS, added notification_preferences to profiles |
| 006 | `006_push_subscriptions.sql` | Created push_subscriptions table + RLS |
| 007 | `007_budget_unique_constraint.sql` | Added unique index on `(user_id, category)` for budgets |

### Reconstructed Schema

#### `profiles`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, FK → auth.users(id) ON DELETE CASCADE |
| `display_name` | text | |
| `avatar_url` | text | |
| `currency` | text | DEFAULT 'USD' |
| `notification_preferences` | jsonb | DEFAULT '{}' |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

- Trigger: `handle_new_user` — auto-inserts profile on `auth.users` INSERT using `raw_user_meta_data.display_name`
- RLS: Users can SELECT, UPDATE, INSERT their own profile (`id = auth.uid()`)

#### `expenses`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `amount` | numeric(10,2) | NOT NULL, CHECK > 0 |
| `category` | text | NOT NULL, CHECK against the 10 canonical category names |
| `vendor` | text | |
| `description` | text | |
| `date` | date | NOT NULL |
| `is_recurring` | boolean | NOT NULL, default false |
| `receipt_url` | text | Supabase Storage object path when a receipt file is attached |
| `tags` | text[] | NOT NULL, default `{}` |
| `idempotency_key` | text | Optional; partial unique index with `user_id` (migration `004`) |
| `created_at` / `updated_at` | timestamptz | Defaults + update trigger |

- RLS: Users can SELECT, INSERT, UPDATE, DELETE their own expenses (`user_id = auth.uid()`)

#### Categories (10 — enforced in SQL CHECK + `src/lib/types.ts`)

Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Other

#### `budgets`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `category` | text | NOT NULL, CHECK against the same 10 categories |
| `monthly_limit` | numeric(10,2) | NOT NULL, CHECK > 0 |
| `created_at` | timestamptz | DEFAULT now() |

- Unique `(user_id, category)` — enforced in SQL (`001` + hardened in `007_budget_unique_constraint.sql`)
- RLS: Users can SELECT, INSERT, UPDATE, DELETE their own budgets

#### `ai_insights`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `insight_type` | text | NOT NULL (`spending_summary`, `savings_tip`, `budget_alert`, `trend_analysis`) |
| `content` | text | NOT NULL (human-readable body) |
| `data` | jsonb | Optional structured payload |
| `created_at` | timestamptz | DEFAULT now() |

- RLS: Users can SELECT, INSERT their own insights

#### `receipts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `expense_id` | uuid | Optional FK → expenses(id) ON DELETE SET NULL |
| `file_url` | text | NOT NULL — stores the Supabase Storage path (see `persistReceiptRecord`) |
| `ocr_data` | jsonb | Serialized OCR fields (`persistReceiptRecord`) |
| `confidence` | numeric(5,2) | Model confidence when available |
| `created_at` | timestamptz | DEFAULT now() |

- RLS: Users can SELECT, INSERT, DELETE their own receipts

#### `notifications`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `type` | text | NOT NULL |
| `title` | text | NOT NULL |
| `message` | text | |
| `read` | boolean | DEFAULT false |
| `metadata` | jsonb | DEFAULT '{}' |
| `created_at` | timestamptz | DEFAULT now() |

- RLS: Users can SELECT, INSERT, UPDATE their own notifications

#### `push_subscriptions`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| `endpoint` | text | NOT NULL, UNIQUE |
| `p256dh` | text | NOT NULL |
| `auth` | text | NOT NULL |
| `device_name` | text | |
| `created_at` | timestamptz | DEFAULT now() |

- RLS: Users can SELECT, INSERT, DELETE their own subscriptions

---

## 8. Database Data Model

### Entity Relationships

```
auth.users (Supabase managed)
    │
    ├── 1:1 ── profiles
    │
    ├── 1:N ── expenses
    │              │
    │              ├── optional `receipt_url` (storage path on the expense row)
    │              └── 1:N ── receipts (metadata rows keyed by the same storage path in `file_url`)
    │
    ├── 1:N ── budgets
    │
    ├── 1:N ── ai_insights
    │
    ├── 1:N ── notifications
    │
    └── 1:N ── push_subscriptions
```

### Key Relationships

- **User → Profile**: 1:1, created automatically via trigger on user signup. Profile stores display settings and preferences.
- **User → Expenses**: 1:N. Each expense belongs to one user. Optional `receipt_url` stores the Supabase Storage object path for the attachment.
- **Receipt metadata (`receipts` table)**: Rows track OCR payloads for a stored file (`file_url` matches the storage path). Optional `expense_id` can link a receipt row back to an expense when the schema is used end-to-end.
- **User → Budgets**: 1:N. Unique index on `(user_id, category)` prevents duplicate budgets at the database level (migration 007).
- **User → Notifications**: 1:N. Created server-side by budget alert logic and weekly summary generation.
- **User → Push Subscriptions**: 1:N (one per device). Unique constraint on `endpoint` ensures one subscription per browser.

### Cascade Behavior

- Deleting a `auth.users` record cascades to: profiles, expenses, budgets, ai_insights, receipts, notifications, push_subscriptions (all via `ON DELETE CASCADE`)
- Deleting an `expenses` row referenced by `receipts.expense_id` sets that FK to `NULL` on the receipt row (`ON DELETE SET NULL`)

### Data Integrity Notes

- Unique `(user_id, category)` on budgets enforces one row per category (see migrations `001` / `007`)
- Pagination on `GET /api/expenses` and `GET /api/notifications` (`page` + `limit` + `pagination` metadata)
- `expenses.amount` is `numeric(10,2)` with CHECK > 0
- `budgets.monthly_limit` is `numeric(10,2)` with CHECK > 0

---

## 9. Authentication and Authorization

### Auth Provider

Supabase Auth with three methods:
1. **Email/password** — standard signup with email confirmation, password requirements (8+ chars, upper, lower, digit)
2. **Google OAuth** — via Supabase social auth
3. **GitHub OAuth** — via Supabase social auth

### Auth Flows

**Signup**:
1. User submits email, password, display name → client calls `supabase.auth.signUp()` with `display_name` in metadata
2. Supabase sends confirmation email
3. User clicks link → redirected to `/auth/confirm` which exchanges the token hash
4. Profile auto-created via database trigger
5. Redirect to `/dashboard`

**Login**:
1. User submits credentials → client calls `supabase.auth.signInWithPassword()`
2. On success, redirect to `/dashboard` (or `redirectTo` param if set)
3. Session cookie established via `@supabase/ssr`

**OAuth**:
1. User clicks "Continue with Google/GitHub" → client calls `supabase.auth.signInWithOAuth()` with `redirectTo` pointing to `/auth/callback`
2. After external auth, Supabase redirects to `/auth/callback?code=...`
3. Server-side route handler exchanges code for session
4. Redirect to `/dashboard`

**Password Reset**:
1. User enters email on `/forgot-password` → `supabase.auth.resetPasswordForEmail()`
2. Email sent with reset link (redirects back to app)
3. User follows link and resets via Supabase-managed flow

### Session Model

- Sessions managed via HTTP-only cookies using `@supabase/ssr`
- The middleware (`src/proxy.ts`) refreshes session tokens on every request by calling `supabase.auth.getUser()`
- Cookie operations use the Next.js `cookies()` API in middleware/server contexts

### Route Protection

**Middleware** (`src/proxy.ts`):
- Protected paths: `/dashboard`, `/expenses`, `/budgets`, `/receipts`, `/insights`, `/imports`, `/notifications`, `/settings`
- Auth paths: `/login`, `/signup`, `/forgot-password`
- Behavior:
  - No session + protected path → redirect to `/login` with `redirectTo` param
  - Active session + auth path → redirect to `/dashboard`
  - All other paths pass through

**API Routes**:
- Every API route (except `/api/warmup`) calls `supabase.auth.getUser()` and returns 401 if no valid session
- This is redundant protection — even if middleware is bypassed, API routes independently verify auth

**Supabase RLS**:
- All tables have RLS enabled
- All policies enforce `user_id = auth.uid()` (or `id = auth.uid()` for profiles)
- This is the third layer of defense — even if API auth is somehow bypassed, the database rejects unauthorized access

### Known Auth Considerations

- No explicit CSRF token mechanism beyond Supabase's session cookies (SameSite attribute provides some protection)
- OAuth redirect callback uses `safeRedirectPath()` to prevent open redirect attacks
- Session refresh happens on every request via middleware, which may have performance implications but ensures token freshness

---

## 10. File Storage and Receipt Uploads

### Storage Configuration

- **Bucket**: `receipts` (private, requires authentication)
- **Access model**: Signed URLs with server-generated tokens
- **Max file size**: 10 MB

### Upload Flow

1. Client selects/captures file → validates type + size client-side
2. Client compresses images (canvas resize to 1200px max width, JPEG quality 0.7)
3. Client sends file as `FormData` to `POST /api/ocr`
4. Server validates magic bytes of the file binary (JPEG, PNG, WebP, PDF signatures)
5. Server builds unique path: `{userId}/{timestamp}-{random}-{sanitizedFilename}`
6. Server uploads to Supabase Storage `receipts` bucket
7. Server persists receipt metadata (file_path, file_name, file_size, mime_type) to `receipts` table
8. Server downloads the file from storage for AI processing
9. After OCR, receipt record is updated with `ocr_result` JSON

### Signed URL Generation

- `/api/receipts/access` endpoint takes a `path` parameter
- Calls `supabase.storage.from('receipts').createSignedUrl(path, 3600)` (1-hour expiry)
- Client uses signed URLs to display receipt thumbnails and full-size previews
- URLs must be refreshed before expiry

### Receipt Lifecycle

```
Upload → Store in Supabase Storage → Insert receipts row
    → OCR processing → Update receipts.ocr_result
    → Link to expense (`expenses.receipt_url` stores the object path; `receipts` row stores OCR JSON keyed by `file_url`)
    → View via signed URL (`/api/receipts/access`)
    → Delete receipt: remove from storage + delete `receipts` row + clear `expenses.receipt_url` as part of app flows
```

### Security Considerations

- Storage bucket is private — no public access
- Signed URLs prevent unauthorized access but anyone with the URL has 1-hour access
- Magic byte validation prevents MIME type spoofing (e.g., a `.js` file renamed to `.jpg`)
- File size limit prevents storage abuse
- No server-side virus/malware scanning on uploaded files
- Receipt paths include user ID, providing namespace isolation

---

## 11. Receipt Ingestion and OCR Lifecycle

### End-to-end flow

1. **Capture** — Camera, file picker, drag-and-drop, Share Target, or File Handlers / launch queue (see [Section 18](#18-pwa-architecture)).
2. **Client compression** — `compressReceiptImage` may shrink large photos before upload (`receipt-capture.ts`).
3. **`POST /api/ocr`** — Accepts either a `file` **or** a stored `receipt_path` (retry/share flows).
4. **Validation** — `validateReceiptFile` + `validateReceiptFileBytes` (MIME + magic bytes, including HEIC/HEIF).
5. **Storage** — New uploads go to the private `receipts` bucket under `buildReceiptStoragePath`; metadata persisted via `persistReceiptRecord`.
6. **OCR providers (sequential)** — See below; first successful structured result wins.
7. **Refinement** — `refineOCRResult` adjusts confidence and **merges human-readable warnings** (suspicious merchant, missing amount/date, discount/offer language in `raw_text`).
8. **Response** — `ReceiptProcessingResult` JSON drives the review UI; user can **save manually** even when `ocr_status` is `failed` but the file uploaded.

### OCR provider stack (`src/app/api/ocr/route.ts`)

| Order | Provider | When used | Notes |
|---:|---|---|---|
| 1 | **Veryfi** | `VERYFI_CLIENT_ID`, `VERYFI_API_KEY`, and `VERYFI_USERNAME` are all set | `POST https://api.veryfi.com/api/v8/partner/documents` with `file_data` as a data URL; response normalized to `OCRResult` via `parseVeryfiResponse`. |
| 2 | **Google Gemini** | Veryfi did not return a usable result and `GEMINI_API_KEY` is set | Tries `gemini-2.5-flash` then `gemini-2.5-flash-lite`, **one request per model** (no inner retry loop). Non-429 HTTP errors move to the next model; 429 errors are recorded and the loop continues so OpenRouter can still run. |
| 3 | **OpenRouter** | Still no result and `OPENROUTER_API_KEY` is set | Tries each of `nvidia/nemotron-nano-12b-v2-vl:free` and `google/gemma-4-26b-a4b-it:free` **once**; message content may be string or array — `extractTextContent` normalizes. |

If **none** of the three credential groups is configured, the route returns **503** with a clear configuration error.

### Parsing and robustness

- **JSON from models** — Strips code fences, extracts JSON objects embedded in prose, reads nested `text` / `content` shapes from Gemini/OpenRouter payloads.
- **Numbers** — `coerceNumber` accepts string amounts with mixed `,` / `.` thousands separators.
- **Dates** — `coerceDate` accepts `YYYY-MM-DD`, ISO date-times, `MM/DD/YYYY`, `DD/MM/YYYY`, and several written formats.
- **Categories** — `sanitizeCategory` maps model output onto the **10** app categories; unknown values become `null`.

### Auto-categorization after OCR

After structured OCR, `applyCategoryAndNotesInference()` in `ocr/route.ts`:

1. If the model returns no category, **`Other`**, or an invalid value, **`suggestCategory(vendor, raw_text)`** fills a canonical category (merchant substring match, then weighted keywords in `raw_text`).
2. If **description** is empty but **vendor** is present, description defaults to `Receipt from {vendor}`.

The review UI (`ReceiptWorkspace`) applies the same `suggestCategory` logic when hydrating the form so client and server stay aligned. Users can always override the category before saving.

### `ReceiptProcessingResult` (client contract)

Key fields used by `ReceiptWorkspace`: `status` (`success` \| `partial` \| `error`), `upload_status`, `ocr_status`, `receipt_path`, `amount`, `vendor`, `date`, `category`, `description`, `line_items`, `confidence`, `raw_text`, optional **`warning`** and **`error`** strings, and **`recovery_actions`** (`retry_ocr`, `retry_upload`, `save_manually`).

### Failure copy (upload vs OCR)

- If the file **is already stored** but every OCR provider fails, the API returns **`partial`** with an **error** explaining that the **receipt is attached** and the user should **retry OCR** or **edit manually** (rate-limit vs generic message).
- If **upload and OCR** both fail, the response is **`error`** / **502** with **`retry_upload`** in recovery actions when applicable.

### Receipt review UI (`ReceiptWorkspace`)

Mobile-first improvements: header stacks on narrow viewports; preview + form **stack** on small screens and sit **side-by-side** on `lg+`; preview height capped to reduce overflow; alerts use **light- and dark-mode-safe** amber text; long OCR / warning / error text **wraps**; recovery buttons **stack / full-width** on small screens; raw OCR lives in a **max-height scroll** region; receipt viewer **dialog** scrolls within the viewport; sticky save bar respects **safe-area** in capture mode.

---

## 12. AI Integrations

### Providers (summary)

| Provider | Receipt OCR | AI insights (`/api/ai-insights`) | Transport |
|---|---|---|---|
| **Veryfi** | Optional first stage (partner REST API) | — | Server-side `fetch` from `ocr/route.ts` |
| **Google Gemini** | Fallback OCR + primary/fallback insights | Yes | `generativelanguage.googleapis.com` |
| **OpenRouter** | Final OCR fallback + insights fallback | Yes | `openrouter.ai` |

### OCR pipeline

Detailed provider order, parsing, and failure semantics: [Section 11](#11-receipt-ingestion-and-ocr-lifecycle).

### AI Insights Pipeline

**Trigger**: User clicks "Generate Insights" on `/insights` page, or navigates to the page and no recent insights exist.

**Flow**:
1. Client calls `POST /api/ai-insights`
2. Server fetches user's expenses (last 90 days) and budgets
3. Server constructs a prompt with spending data context:
   - Total spend, average daily/weekly spend
   - Category breakdown with amounts and percentages
   - Budget status for each budget (spent vs limit)
   - Top merchants by frequency and amount
   - Recent spending trend (last 7 days vs previous 7 days)
4. The AI is asked to return a structured JSON response:
   - `summary`: 2-3 sentence overview
   - `key_findings`: Array of observations about spending patterns
   - `savings_tips`: Actionable advice based on actual spending
   - `budget_alerts`: Warnings about budget categories at risk
   - `trends`: Spending direction analysis (increasing/decreasing)
5. Response parsed and optionally persisted to `ai_insights` table

**Provider Strategy**:
- Tries Gemini first → if error or unconfigured, falls back to OpenRouter
- If both fail, returns error to client

### Rate Limiting

Both OCR and Insights share the `aiRateLimit`: 20 requests per 60 seconds per user. This limits total AI API calls regardless of which AI feature is being used.

### Structured Output Handling

- Both pipelines expect JSON output from the AI
- Markdown code fences (`\`\`\`json ... \`\`\``) are stripped before parsing
- If JSON parsing fails, the error is caught and a structured error response is returned to the client
- No Zod validation on AI output structure — the code uses optional chaining and defaults for missing fields

### Cost and Abuse Considerations

- **Gemini 2.5 Flash**: Free tier with generous rate limits; no direct cost
- **OpenRouter free models**: No cost but quality varies; response may be slower
- **Rate limiting**: 20 AI calls/minute/user prevents abuse
- **No server-side cost tracking**: There is no mechanism to track AI API costs or set spending limits
- **Image size**: Client-side compression reduces payload size, indirectly reducing AI processing cost

### Known Risks

- **Prompt injection via receipt**: A maliciously crafted receipt image could theoretically contain text that attempts to influence the AI prompt. The system prompt does not explicitly guard against this, but the expected output format (structured JSON) limits the attack surface.
- **Malformed AI output**: If the AI returns non-JSON or incorrect schema, the response is treated as an error. There is no retry with modified prompt.
- **No output sanitization**: AI-generated text (insight summaries, etc.) is rendered in React JSX which provides XSS protection, but no explicit sanitization layer exists.

---

## 13. Expense Management Flow

### Manual Creation

1. User clicks "Add Expense" button → `ExpenseFormDialog` opens
2. Fills form: amount (required), category (required, dropdown), vendor (optional), date (required, defaults to today), description (optional), tags (optional)
3. Client-side Zod validation
4. `POST /api/expenses` with form data
5. Server validates, creates record via `createExpenseRecord()`, checks budget alerts
6. On success, UI refreshes expense list

### OCR-Linked Creation

1. User processes receipt through OCR (see [Section 11](#11-receipt-ingestion-and-ocr-lifecycle))
2. OCR results pre-populate the expense form in `ReceiptWorkspace`
3. User reviews/edits extracted fields
4. Save triggers `POST /api/expenses` with `receipt_url` set to the Supabase storage path returned from OCR (when upload succeeded)

### Editing

1. User clicks expense row → `ExpenseFormDialog` opens in edit mode with pre-populated fields
2. User modifies fields
3. `PUT /api/expenses/[id]` updates the record
4. Budget alerts re-checked for the expense's category

### Deletion

1. User clicks delete → confirmation dialog
2. `DELETE /api/expenses/[id]` removes the record
3. If the expense referenced a receipt path, client/API flows clear `receipt_url` / storage as applicable

### Offline Creation

1. When network is unavailable during save, the client catches the error
2. Expense data + optional receipt preview stored in IndexedDB via `enqueuePendingUpload()`
3. A unique `idempotency_key` (UUID) is generated and stored with the queued entry
4. On reconnect (via `online` event, `visibilitychange`, or Background Sync), `processQueue()` retries
5. Server-side `createExpenseRecord()` checks the idempotency key — if an expense with this key already exists, it returns the existing record without creating a duplicate

### Categorization

Ten fixed categories (see `CATEGORIES` in `src/lib/types.ts`): Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Other.

Colors come from `CATEGORY_COLORS` in `constants.ts` (hex) and from each `CATEGORIES` entry’s `color` field where used in UI.

**Automatic suggestions** use `src/lib/category-suggest.ts`: **receipt OCR** and **CSV/Excel import** (`normalizeImportCategoryLabel` for bank column labels + `suggestCategory` for vendor/description). Suggestions are **defaults**; the user selects the final category on save unless they accept the default.

---

## 14. Budget Management Flow

### Budget Creation

1. User clicks "Add Budget" on budgets page
2. `BudgetFormDialog` shows category dropdown (filtered to exclude categories that already have a budget) and monthly limit amount
3. `POST /api/budgets` — server checks for existing budget with same user+category (application-level uniqueness)
4. On success, budget appears in list

### Progress Tracking

The budget list page fetches budgets with current spending:
1. Server queries all user budgets
2. For each budget, calculates total spending in the budget's current period (e.g., current month for monthly budgets)
3. Returns each budget with `spent`, `percentage` (spent/limit * 100), and `remaining` (limit - spent) fields
4. Client renders progress bars color-coded: green (< 50%), yellow (50-79%), orange (80-99%), red (≥ 100%)

### Alert Logic

When any expense is created or imported:
1. `checkBudgetAlerts(supabase, userId, category)` is called
2. Fetches the budget for this category + total spending for current month
3. If spending ≥ 100% → creates "budget_exceeded" notification
4. If spending ≥ 80% (and < 100%) → creates "budget_warning" notification
5. Deduplication: checks if a notification with same type + category already exists for the current month before creating

### Editing and Deletion

- Edit: `PUT /api/budgets/[id]` — can change amount and period
- Delete: `DELETE /api/budgets/[id]` — removes the budget; no cascade effect on expenses

---

## 15. Analytics and Insights

### Dashboard Analytics

The dashboard page (`/dashboard`) displays:
- **Summary cards**: Total spend (current month), average daily spend, number of expenses, number of receipts scanned
- **Expense chart**: Recharts area chart showing daily spending over a selectable date range
- **Category breakdown**: Recharts pie chart with spending per category
- **Recent expenses**: Last 5 expenses with vendor, amount, category badge

Data is fetched server-side in the page component and passed to client components.

### AI Insights

Covered in [Section 12](#12-ai-integrations). The insights page shows:
- Summary paragraph
- Key findings (bullet points)
- Savings tips
- Budget alerts (if budgets are at risk)
- Trend analysis

### Analytics API

`GET /api/analytics` aggregates:
- Total spending over selected period
- Spending by category (amounts + percentages)
- Daily spending trend data
- Budget utilization per category
- Top merchants by frequency and total amount

### Data Freshness

- Dashboard data is fetched on page load (server-side)
- No client-side caching or polling — user must refresh/navigate to get updated data
- AI insights can be regenerated on-demand; old insights are available in the list

---

## 16. Notifications System

### Notification Types

| Type | Trigger | Content |
|---|---|---|
| `budget_warning` | Expense pushes category to ≥ 80% of budget | "Budget Alert: [Category] spending has reached 80% of your $X limit" |
| `budget_exceeded` | Expense pushes category to ≥ 100% of budget | "Budget Exceeded: [Category] spending has exceeded your $X limit" |
| `weekly_summary` | Manual trigger via `/api/notifications/weekly-summary` | Weekly spending summary with totals and category breakdown |

### Trigger Conditions

- **Budget alerts**: Triggered by `checkBudgetAlerts()` which is called from:
  - `POST /api/expenses` (manual expense creation)
  - `POST /api/expenses/import` (CSV import, for each row's category)
- **Weekly summary**: Two endpoints exist:
  - `POST /api/notifications/weekly-summary` — user-authenticated, generates summary for the calling user
  - `POST /api/cron/weekly-summary` — CRON_SECRET-authenticated, generates summaries for all opted-in users. Triggered by a Render cron job every Monday at 9 AM UTC (configured in `render.yaml`).

### In-App Notification Center

- `/notifications` page shows all notifications in reverse chronological order
- Tabs: "All" and "Unread"
- Each notification shows type icon, title, message, relative timestamp
- "Mark all as read" button calls `PATCH /api/notifications`
- Individual notifications marked as read on view
- Unread count badge shown in the app shell navigation sidebar

### Push Notification Infrastructure

**Implemented**:
- VAPID key pair configuration (env vars)
- Push subscription management UI (subscribe/unsubscribe toggle in settings)
- `POST /api/notifications/subscribe` saves subscription to `push_subscriptions` table
- `DELETE /api/notifications/subscribe` removes subscription
- Service worker `push` event handler displays system notification
- Service worker `notificationclick` handler opens the app to `/notifications`

**Implemented (server-side delivery)**:
- **`web-push`** library is installed and configured with VAPID credentials
- **`src/lib/push-sender.ts`** provides `sendPushToUser()` which sends push to all of a user's subscriptions and automatically cleans up expired/invalid subscriptions (HTTP 404/410)
- Push notifications are sent for **budget alerts** (warning at 80%, exceeded at 100%) and **weekly summaries**
- The in-app notification center remains the **primary fallback channel** for users without push subscriptions

### Data Model

Notifications stored in `notifications` table with `type`, `title`, `message`, `read` boolean, and optional `metadata` JSONB field. RLS ensures users only see their own notifications.

---

## 17. CSV Import System

### Accepted formats

- **CSV** (`.csv`) — comma-separated; first row = headers; UTF-8 with BOM supported
- **Excel** (`.xlsx`, `.xls`) — first worksheet only; parsed with SheetJS (`xlsx`); row/cell limits apply (see `spreadsheet-import.ts`)
- **Google Sheets** — use **File → Download →** CSV or Microsoft Excel (no direct URL import)

File size limits: **5 MB** CSV, **10 MB** Excel; **2,000** rows max per import (client-enforced).

### Import flow

**Step 1: File selection** — User picks CSV or Excel; binary Excel files are read with `FileReader.readAsArrayBuffer`.

**Step 2: Column mapping** — `autoDetectMapping(headers)` suggests columns for date, amount, description, optional vendor, category, and optional Debit/Credit type. The UI explains each field in plain language. Optional **“Skip credit rows”** ignores rows whose type column looks like a credit/deposit when that column is mapped.

**Step 3: Preview and edit** — `mapAndValidateRows()` runs (`parseAmount` treats **negative amounts** as positive expenses). Category strings from the file are normalized with **`normalizeImportCategoryLabel()`** so labels like “Food & Drink” map to **Food & Dining**. Users can **edit** date, amount, vendor, category, and description before import.

**Step 4: Import** — `POST /api/expenses/import` processes up to **50 rows per request** in a loop; rate-limited per user.

Per row on the server:

1. **`resolveCategory()`** — If the client sent an exact canonical category (and not `"Other"`), it is kept. Otherwise **`normalizeImportCategoryLabel(category)`**; if still `"Other"`, **`suggestCategory(vendor, description)`** infers from payee + memo.
2. **`detectDuplicate()`** against recently loaded expenses (date window around the batch).
3. **`createExpenseRecord()`** with `idempotency_key` and Zod-validated amounts (`MAX_EXPENSE_AMOUNT` cap).
4. **`checkBudgetAlerts()`** for touched categories.

Response shape: `{ total, succeeded, failed, errors[] }` with per-row `source_row` for failures.

### Duplicate detection

`detectDuplicate()` scores candidates vs **recent** expenses (see `import/route.ts` for the date window). Components: amount match, vendor/description similarity, date proximity. High scores block import with a clear error so users can fix duplicates manually.

### Error reporting

- **Client**: Rows with validation errors listed; editable preview reduces fix-and-retry cycles.
- **Server**: Failed rows include reason (duplicate, validation, DB error).

---

## 18. PWA Architecture

### Web App Manifest

Generated dynamically by `src/app/manifest.ts`:

| Field | Value | Notes |
|---|---|---|
| `name` | "ExpenseVision" | |
| `short_name` | "ExpenseVision" | |
| `description` | Full app description | |
| `start_url` | "/dashboard" | Opens directly to dashboard |
| `display` | "standalone" | No browser chrome |
| `background_color` | "#0a0a0a" | |
| `theme_color` | "#f59e0b" | Amber accent |
| `orientation` | "portrait-primary" | |
| `categories` | ["finance", "productivity"] | |
| `icons` | 5 sizes (192–512, maskable) | Standard + maskable variants |
| `share_target` | See below | |
| `file_handlers` | See below | |
| `shortcuts` | Dashboard, Expenses, Receipts, Budgets | Quick actions from app icon |

### Share Target

```json
{
  "action": "/receipts/share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "files": [
      { "name": "receipt", "accept": ["image/*", "application/pdf"] }
    ]
  }
}
```

**Flow**: User shares image/PDF from another app → OS routes to ExpenseVision → POST to `/receipts/share-target` → file stored as a draft via receipt serialization → redirect to `/receipts` → `ReceiptWorkspace` detects and loads draft → proceeds to OCR

### File Handlers

```json
[{
  "action": "/receipts/capture",
  "accept": {
    "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"],
    "application/pdf": [".pdf"]
  }
}]
```

**Flow**: User opens a receipt file with ExpenseVision from OS file picker → `launchQueue.setConsumer()` in `PWAProvider` receives the file → stores as draft → redirects to `/receipts/capture` → same OCR flow

### Service Worker (`public/sw.js`)

**Install Event**:
- Precaches core assets: `/`, `/dashboard`, `/expenses`, `/budgets`, `/receipts`, `/insights`, `/offline` (if it existed), and icon files
- Uses `skipWaiting()` for immediate activation

**Activate Event**:
- Cleans caches that don't match the current `CACHE_NAME`
- Claims all clients immediately

**Fetch Event Strategy**:
- **API routes** (`/api/`): Network only (no caching)
- **Auth routes** (`/auth/`, `/login`, `/signup`): Network only
- **Static assets** (fonts, images, icons, `_next/static`): Cache-first with network fallback
- **Navigation requests**: Network-first with cache fallback
- **Other requests**: Network-first with cache fallback

**Background Sync**:
- Listens for `sync` event with tag `pending-expense-upload`
- Posts `{ type: 'process-offline-queue' }` message to all clients
- Client-side code in `offline-retry.ts` handles the actual queue processing

**Push Notifications**:
- `push` event: Displays a system notification with title, body, icon, and badge from the push payload
- `notificationclick` event: Opens or focuses the app at `/notifications`

### Offline Behavior

| Feature | Offline Support |
|---|---|
| Dashboard view | Cached page shell loads; data from last visit may be stale |
| Expense creation | Falls back to IndexedDB queue; syncs on reconnect |
| Receipt scanning | Not available (requires API call) |
| Budget view | Cached page shell; data may be stale |
| CSV import | Not available (requires API call) |
| AI insights | Not available (requires API call) |
| Navigation | Cached pages load from service worker |

### Install Prompt

`PWAProvider` component:
1. Captures `beforeinstallprompt` event
2. Stores the deferred prompt in state
3. AppShell renders an "Install App" button in the sidebar when prompt is available
4. Clicking triggers the native browser install dialog
5. `appinstalled` event tracked via telemetry

### Platform-Specific Caveats

- **Background Sync**: Chromium-only. Safari and Firefox fall back to manual retry on `online` event and `visibilitychange`.
- **File Handlers**: Chromium desktop-only. Not supported on mobile or non-Chromium browsers.
- **Launch Queue**: Chromium-only. Other browsers ignore `launchQueue.setConsumer()`.
- **Share Target**: Works on Android Chrome and other browsers with Share API support. Limited on iOS Safari.
- **Push Notifications**: Browser support varies by platform; **server-side delivery** is implemented via `web-push` when VAPID keys are set (see [Section 16](#16-notifications-system)).
- **Service Worker**: Registered in production only; development uses hot module replacement.

---

## 19. Upstash Redis — Caching and Rate Limiting

### Client Configuration

- `Redis` client from `@upstash/redis` initialized with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- If either env var is missing, `redis` is set to `null` and rate limiting is gracefully skipped

### Rate Limit Architecture

All rate limiters use `Ratelimit.slidingWindow` from `@upstash/ratelimit`:

| Limiter | Limit | Window | Routes Protected |
|---|---|---|---|
| `aiRateLimit` | 20 req | 60 sec | `/api/ocr`, `/api/ai-insights` |
| `apiRateLimit` | 60 req | 60 sec | All GET endpoints, `/api/receipts/access`, `/api/analytics`, `/api/notifications/weekly-summary` |
| `expenseMutationRateLimit` | 30 req | 60 sec | `/api/expenses` POST/PUT/DELETE, `/api/expenses/[id]/receipt` DELETE |
| `importBatchRateLimit` | 10 req | 60 sec | `/api/expenses/import` |
| `budgetMutationRateLimit` | 20 req | 60 sec | `/api/budgets` POST/PUT/DELETE |
| `notificationMutationRateLimit` | 30 req | 60 sec | `/api/notifications` PATCH, `/api/notifications/subscribe` POST/DELETE |
| `telemetryRateLimit` | 120 req | 60 sec | `/api/telemetry` |
| `accountMutationRateLimit` | 5 req | 3600 sec | `/api/account` DELETE |

### Identification

Rate limits are keyed by client IP address extracted from:
1. `x-forwarded-for` header (first IP)
2. `x-real-ip` header
3. Falls back to `"unknown"` if neither is present

### Fallback Behavior

If Redis is unavailable or not configured:
- `enforceRateLimit()` returns `null` instead of a 429 response
- All API routes check: if the rate limit function returns `null`, the request proceeds without rate limiting
- This means the app functions without Redis but without abuse protection

### What is NOT Cached

Redis is used **exclusively for rate limiting**. There is no data caching in Redis:
- No query result caching
- No session caching
- No AI response caching
- All data is fetched fresh from Supabase on every request

### Abuse Prevention Assessment

- AI endpoints are appropriately limited (20/min prevents cost abuse)
- Import batch limit (10/min) prevents mass data injection
- Account deletion limit (5/hour) prevents accidental rapid deletions
- **Gap**: No global per-IP rate limit across all endpoints combined — a determined attacker could spread requests across many endpoint types
- **Gap**: The `"unknown"` fallback identifier means clients without forwarded headers share a single rate limit bucket

---

## 20. SEO and Metadata

### Metadata Strategy

The root layout (`src/app/layout.tsx`) sets global metadata via Next.js Metadata API:

- **Title**: "ExpenseVision — AI-Powered Expense Tracking"
- **Description**: Comprehensive description of the app's features
- **Keywords**: expense tracker, receipt OCR, budget management, AI insights, PWA
- **OpenGraph**: Title, description, URL, site name, locale (en_US), type (website)
- **Twitter**: `card: "summary_large_image"`, title, description
- **Robots**: `index: true, follow: true` (for public pages)

### Per-Route Coverage

| Route | Title | Custom Metadata |
|---|---|---|
| `/` (landing) | Default from layout | Full OG + Twitter + JSON-LD structured data |
| `/login` | "Log In — ExpenseVision" | Standard |
| `/signup` | "Sign Up — ExpenseVision" | Standard |
| `/dashboard` | "Dashboard — ExpenseVision" | noindex (protected) |
| `/demo` | "Demo — ExpenseVision" | Standard (public, indexable) |
| Other auth pages | Individual titles | noindex (protected) |

### robots.txt

Generated by `src/app/robots.ts`:
- **Allow**: `/`, `/demo`, `/demo/*`, `/login`, `/signup`
- **Disallow**: `/api/*`, `/dashboard`, `/expenses`, `/budgets`, `/receipts`, `/insights`, `/imports`, `/notifications`, `/settings`, `/auth/*`
- **Sitemap**: Points to `/sitemap.xml`

### sitemap.xml

Generated by `src/app/sitemap.ts`:
- Includes: `/` (weekly), `/login` (monthly), `/signup` (monthly), `/demo` (weekly), `/demo/expenses`, `/demo/budgets`, `/demo/receipts`, `/demo/insights`, `/demo/settings` (all weekly)
- Excludes all authenticated routes

### Structured Data

The landing page (`src/app/page.tsx`) includes JSON-LD `SoftwareApplication` schema:
- `@type`: "SoftwareApplication"
- `name`: "ExpenseVision"
- `applicationCategory`: "FinanceApplication"
- `operatingSystem`: "Web"
- `offers`: Free

### Canonical URLs

No explicit `canonical` tag in metadata. The `metadataBase` is set to the `NEXT_PUBLIC_APP_URL`, which Next.js uses to resolve relative OG image URLs and similar references.

### Assessment

- Public pages are properly indexable
- Protected pages are properly blocked in robots.txt
- Demo pages are indexable (good for SEO — provides crawlable content)
- Missing: explicit `noindex` meta tag on auth-protected pages beyond robots.txt blocking
- Missing: per-page OG images (all pages use default)

---

## 21. CI/CD and Deployment

### GitHub Actions CI Pipeline

**File**: `.github/workflows/ci.yml`

**Triggers**: Push to `main`, pull request to `main`

**Jobs** (sequential):

1. **Type Check** (`npx tsc --noEmit`) — Ensures TypeScript compiles without errors
2. **Lint** (`npm run lint`) — ESLint with Next.js recommended rules
3. **Test** (`npm test -- --run`) — Runs all Vitest tests
4. **Build** (`npm run build`) — Verifies production build succeeds

**Environment**: Node.js 20, Ubuntu latest

**Assessment**: The CI pipeline covers type safety, lint quality, unit test correctness, and build integrity. It does not run E2E tests (Playwright) in CI — those require a running dev server and Supabase credentials.

### Render Deployment

**Configuration**: `render.yaml` Blueprint

```yaml
services:
  - type: web
    name: expensevision
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: node scripts/run-standalone.mjs
    healthCheckPath: /api/warmup
    envVars: [all required environment variables]
```

**Standalone Server**: `scripts/run-standalone.mjs`
1. Detects the standalone server directory (`.next/standalone`)
2. Copies `public/` assets into the standalone directory
3. Copies `.next/static/` into standalone's `.next/static/`
4. Launches `server.js` (the Next.js standalone server)

This is necessary because Next.js standalone output doesn't include static assets by default.

### Free-Tier Constraints

- **Render free tier**: Service spins down after 15 minutes of inactivity. First request after spin-down incurs 30–60 second cold start.
- **Supabase free tier**: Database auto-pauses after 1 week of inactivity. Reconnection on next request adds latency.
- **Upstash Redis free tier**: 10,000 requests/day limit. Rate limiting stops working if exhausted.

### Health Check

`GET /api/warmup` returns `{ "status": "ok", "timestamp": "..." }` with 200 status. Render uses this for deployment health checks and to verify the service is running. An external service (like UptimeRobot) could ping this endpoint to prevent spin-down, but **no keep-alive service is configured in the repo**.

---

## 22. Environment Variables

| Variable | Required | Purpose | Used In |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous/public key | Browser + server clients |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Public-facing app URL | Metadata, redirects, OAuth callbacks |
| `SUPABASE_SERVICE_ROLE_KEY` | For account deletion | Service role key for admin operations | `src/lib/supabase/admin.ts` |
| `VERYFI_CLIENT_ID` | Optional | Veryfi partner client id | `/api/ocr` (first-stage OCR) |
| `VERYFI_API_KEY` | Optional | Veryfi API key | `/api/ocr` |
| `VERYFI_USERNAME` | Optional | Veryfi username (API auth header) | `/api/ocr` |
| `GEMINI_API_KEY` | Strongly recommended | Google Gemini API key | `/api/ocr` (fallback), `/api/ai-insights` |
| `OPENROUTER_API_KEY` | Optional | OpenRouter API key | `/api/ocr` (final fallback), `/api/ai-insights` (fallback) |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL | `src/lib/redis.ts` |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis auth token | `src/lib/redis.ts` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | VAPID public key | Browser push subscription + `web-push` on server |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key | `src/lib/push-sender.ts` (server push delivery) |
| `CRON_SECRET` | For scheduled summaries | Shared secret for `POST /api/cron/weekly-summary` | `render.yaml` cron job |

### Behavior Without Optional Variables

| Missing Variable | Effect |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Account deletion endpoint returns error |
| All of `VERYFI_*`, `GEMINI_API_KEY`, and `OPENROUTER_API_KEY` | `POST /api/ocr` returns **503** (not configured) |
| Only `GEMINI_API_KEY` or only `OPENROUTER_API_KEY` | OCR uses whichever models are available after Veryfi (if any) |
| `UPSTASH_REDIS_*` | Rate limiting disabled; all requests pass through |
| `VAPID_*` incomplete | Push subscribe UI may still render, but `sendPushToUser` is a no-op without keys; in-app notifications always work |
| `CRON_SECRET` | Cron endpoint returns **503**; per-user `POST /api/notifications/weekly-summary` still works when signed in |

---

## 23. Testing Strategy

### Unit Tests (Vitest)

**Framework**: Vitest with `globals: true`, `environment: "node"`

**Test Files** (11 suites, 76 tests total):

| File | Tests | Coverage |
|---|---|---|
| `validations.test.ts` | Expense/budget/auth Zod schemas | Valid inputs, edge cases, boundary values |
| `csv-parser.test.ts` | CSV parsing, column detection | Quoted fields, date formats, amount parsing |
| `duplicate-detection.test.ts` | Duplicate scoring algorithm | Exact matches, partial matches, no matches |
| `merchant-normalize.test.ts` | Merchant name standardization | 80+ known variants, edge cases |
| `category-suggest.test.ts` | Category inference | Known merchants, keyword matching, unknown merchants |
| `receipts.test.ts` | File validation, magic bytes | Valid/invalid types, size limits, binary signatures |
| `receipt-share-draft.test.ts` | Draft serialization | Round-trip serialize/deserialize |
| `offline-queue.test.ts` | IndexedDB operations | Enqueue, retrieve, update, remove |
| `receipt-capture.test.ts` | Image compression logic | Resize calculations, quality settings |
| `budget-alerts.test.ts` | Alert threshold logic | 80% warning, 100% exceeded, deduplication |
| `expense-mutations.test.ts` | Idempotency logic | New creation, duplicate key handling |

**Running**:
```bash
npm test          # Single run
npm run test:watch  # Watch mode
```

### E2E Tests (Playwright)

**Framework**: Playwright with Chromium

**File**: `e2e/happy-path.spec.ts`

**Scenario**:
1. Navigate to login page
2. Sign in with test credentials (from env vars)
3. Verify redirect to dashboard
4. Navigate to expenses
5. Add a new expense
6. Verify expense appears in list

**Configuration** (`playwright.config.ts`):
- `testDir: './e2e'`
- Workers: 1 (sequential)
- Retries: 0 on CI, 2 locally
- `baseURL` from env var
- `webServer: { command: 'npm run dev' }` — starts dev server for local runs

**Running**:
```bash
npx playwright test
```

**Not run in CI** — the GitHub Actions workflow does not include E2E tests because they require a running Supabase instance and test user credentials.

### Coverage Gaps

- No tests for API route handlers directly
- No tests for React components (no component testing framework configured)
- No tests for authentication flows
- No tests for the service worker
- E2E coverage is minimal (single happy path)
- No visual regression testing
- No load/performance testing

---

## 24. Security Model

### Authentication Enforcement

| Layer | Mechanism | Scope |
|---|---|---|
| **Middleware** | `src/proxy.ts` checks `supabase.auth.getUser()` | All protected routes (redirect to login) |
| **API Routes** | Each route calls `supabase.auth.getUser()` independently | All API routes except `/api/warmup` and `/api/cron/weekly-summary` (Bearer secret instead) |
| **Database** | Supabase RLS policies on all tables | All data access |

This three-layer approach means that even if one layer is bypassed, the others still protect data.

### Row Level Security

All tables have RLS enabled with policies enforcing `user_id = auth.uid()` (or `id = auth.uid()` for profiles). This means:
- A user can only query their own records
- Even if an attacker obtains a valid session token, they cannot access other users' data
- Service role client bypasses RLS — used for **account deletion** and **cron-driven weekly summaries** (`/api/cron/weekly-summary`)

### File Upload Security

| Check | Implementation |
|---|---|
| File type (client) | MIME type check against allowlist |
| File size (client) | 10 MB limit check |
| File type (server) | MIME type re-check |
| Magic bytes (server) | Binary signature validation for JPEG, PNG, WebP, GIF, HEIC/HEIF (`ftyp` brands), PDF |
| Storage isolation | Files stored under `{userId}/` path prefix |
| Access control | Signed URLs with 1-hour expiry |

### HTTP Security Headers

Configured in `next.config.ts`:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer header |
| `Permissions-Policy` | Camera, microphone, geolocation restricted | Limits browser API access |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS for 1 year |
| `Content-Security-Policy` | Detailed policy | See below |

### Content Security Policy

`next.config.ts` builds CSP at build time:

- **`script-src`**: `'self'`, `'unsafe-inline'`, and **`'unsafe-eval'` only when `NODE_ENV !== 'production'`** — avoids Turbopack / React dev runtime breaking on `eval`, while keeping production stricter.
- **Production** omits `'unsafe-eval'` from `script-src` (see `scriptSrc` construction in `next.config.ts`).

Effective **production** shape (simplified):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com https://avatars.githubusercontent.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://openrouter.ai https://*.upstash.io;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
worker-src 'self';
manifest-src 'self';
```

**Notable**: `'unsafe-inline'` on scripts is still required for some Next.js behaviors; moving to **strict nonce-based CSP** in production remains future work. Outbound calls to **Veryfi** happen **server-side only** — browser CSP `connect-src` does not need to allow `api.veryfi.com` for OCR.

### Input Validation

- All user input validated with Zod schemas before processing
- HTML tags stripped from vendor names and text fields via regex in Zod transforms
- Amount bounded by `MAX_EXPENSE_AMOUNT` in `constants.ts` (see `expenseSchema` and `importRowSchema`)
- Date string must be `YYYY-MM-DD` (additional “not future” rules may apply in UI components)
- Category values must be one of the **10** `VALID_CATEGORIES` in `validations.ts`; import paths may send **non-canonical** strings that are normalized server-side or rejected after inference
- **Auto-categorization** (`suggestCategory`, `normalizeImportCategoryLabel`) only **reads** user-provided merchant/OCR/description strings; inputs are **truncated** before dictionary matching to avoid DoS via megabyte-long strings

### Open Redirect Prevention

`safeRedirectPath(path)` in `src/lib/utils.ts`:
- Only allows paths starting with `/`
- Rejects paths starting with `//` (protocol-relative URLs)
- Used in OAuth callback and login redirect flows

### Known Security Considerations

| Area | Status | Notes |
|---|---|---|
| **CSRF** | Partial | No explicit CSRF tokens; relies on SameSite cookies from Supabase |
| **Rate limiting** | Good | All mutation routes protected; graceful degradation if Redis unavailable |
| **Service role key** | Appropriate | Used for account deletion + cron weekly summaries; never shipped to the browser |
| **Secret leakage** | Clean | `.env.example` has placeholder values; `.gitignore` excludes `.env*` files; `NEXT_PUBLIC_` prefix only on non-sensitive values |
| **XSS** | Low risk | React's JSX escaping prevents most XSS; no `dangerouslySetInnerHTML` usage found |
| **IDOR** | Protected | RLS prevents cross-user data access; API routes use authenticated user ID |
| **Error exposure** | Generally safe | API routes return generic error messages; stack traces not exposed in production |

---

## 25. Performance and Monitoring

### Caching Strategy

- **Service Worker**: Static assets cached with cache-first strategy; navigation pages cached on visit for offline access
- **Redis**: Used only for rate limiting, not data caching
- **No CDN**: Static assets served directly from the Node.js server (Render doesn't include a CDN on free tier)
- **Client-side**: No explicit React Query or SWR caching layer; data fetched fresh on each page load/navigation

### Image Optimization

- **Receipt compression**: Client-side canvas resize to 1200px max + JPEG 0.7 quality before upload
- **Next.js Image**: Not explicitly used for user content (receipt thumbnails use signed URLs in regular `<img>` tags)
- **Static assets**: PWA icons and landing page images are standard static files

### Code Splitting

- Next.js App Router provides automatic route-based code splitting
- Dynamic imports not explicitly used for components (all components imported normally)
- The `ReceiptWorkspace` component is ~1680 lines and loaded entirely when visiting `/receipts`

### Server vs Client Rendering

- **Server-rendered**: Dashboard, expenses list, budgets list, notifications — initial data fetching
- **Client-only**: Receipt workspace, import wizard, insights generation, settings, all forms
- **Benefit**: Server rendering means authenticated data appears on first paint without loading spinners for list pages

### Monitoring

- **Telemetry**: Lightweight event tracking to `/api/telemetry` — logs events to server console. No external analytics service integrated.
- **Error tracking**: No Sentry, LogRocket, or similar error tracking service
- **Uptime monitoring**: No UptimeRobot or similar configured in the repository
- **Performance monitoring**: No Web Vitals reporting or real-user monitoring

### Known Bottlenecks

- **Cold start**: Render free tier spin-down adds 30–60s latency
- **List pagination**: `GET /api/expenses` and `GET /api/notifications` support `page` + `limit` and return `pagination` metadata; the main UI may still load a full first page server-side depending on the route.
- **AI latency**: OCR latency depends on provider (Veryfi vs Gemini vs OpenRouter), image size, and hosting cold starts; insights can take several seconds.
- **No connection pooling**: Each API request creates a new Supabase client (Supabase handles connection pooling server-side via pgbouncer)

---

## 26. Proxy Configuration

### What `src/proxy.ts` Does

This file is the Next.js middleware (exported as `middleware` with a `config.matcher` for relevant routes). Despite the filename `proxy.ts`, it does not proxy requests to another server. Its actual responsibilities:

1. **Session Refresh**: Creates a Supabase server client that reads/writes auth cookies. Calling `supabase.auth.getUser()` implicitly refreshes the session token if needed, and the cookie-handling callbacks update the response cookies.

2. **Route Protection**:
   - If user is not authenticated and requests a protected path (`/dashboard`, `/expenses`, `/budgets`, `/receipts`, `/insights`, `/imports`, `/notifications`, `/settings`) → redirect to `/login?redirectTo={original_path}`
   - If user is authenticated and requests an auth path (`/login`, `/signup`, `/forgot-password`) → redirect to `/dashboard`

3. **Cookie Management**: The middleware intercepts the request, creates a `NextResponse`, and passes cookie getter/setter callbacks that bridge Supabase's cookie operations with Next.js response cookies.

### Security Implications

- The middleware runs on the edge/server before page rendering
- It prevents unauthenticated users from seeing protected page content (server-side redirect)
- It does NOT protect API routes — those have their own auth checks
- The `x-middleware-supabase-*` cookie operations are internal to the Supabase SSR library
- The `redirectTo` parameter uses `safeRedirectPath()` to prevent open redirect attacks

### Matched Routes

The middleware matches all routes except:
- `/_next/static/*` (static assets)
- `/_next/image/*` (Next.js image optimization)
- `favicon.ico`
- `*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp` (static files)

---

## 27. Limitations, Tradeoffs, and Known Issues

### Infrastructure Constraints

| Constraint | Impact | Mitigation |
|---|---|---|
| **Render free tier** | Spin-down after 15 min inactivity; 30–60s cold start | Health check endpoint available for keep-alive (not configured) |
| **Supabase free tier** | DB pauses after 1 week inactivity; 500 MB storage; 2 GB transfer | Adequate for personal use; no mitigation configured |
| **Upstash free tier** | 10,000 requests/day | Rate limiting skipped if exhausted; app still functions |

### Partially Implemented Features

| Feature | Status | Notes |
|---|---|---|
| **Push notifications** | Fully implemented | `web-push` installed, `sendPushToUser()` delivers on budget alerts and weekly summaries, expired subscriptions cleaned automatically |
| **Email receipt parsing** | Interface defined | `email-receipt-parser.ts` is a stub — not implemented |
| **Weekly summary cron** | Fully implemented | Render cron job triggers `POST /api/cron/weekly-summary` every Monday at 9 AM UTC |
| **Expense pagination** | Implemented | `page` and `limit` query params on `GET /api/expenses`, response includes `pagination` object |
| **Notification pagination** | Implemented | `page` and `limit` query params on `GET /api/notifications`, response includes `pagination` object |

### Browser/Platform Limitations

| Feature | Limitation |
|---|---|
| Background Sync | Chromium-only; Safari/Firefox use manual retry |
| File Handlers | Chromium desktop-only |
| Launch Queue | Chromium-only |
| Share Target | Works on Android Chrome; limited on iOS Safari |
| Camera capture | Requires HTTPS; behavior varies by OS/browser |
| HEIC / HEIF | Supported server-side when declared as `image/heic` or `image/heif` and `ftyp` brand matches (`receipts.ts`); some browsers still lack smooth HEIC preview support |

### Known Technical Debt

- `ReceiptWorkspace` component is ~1680 lines — should be decomposed into smaller components
- No React component testing (only unit tests for utility functions)
- CSP uses `'unsafe-inline'` for scripts (required by Next.js); `'unsafe-eval'` is **development-only** (see `next.config.ts`)
- No connection to external monitoring/alerting services
- Demo data is hardcoded rather than generated from a seed file
- No database migrations for test seeding
- The `CATEGORY_COLORS` mapping in `constants.ts` and category CHECK constraints in SQL must be kept in sync manually

### Known Rough Edges

- After creating a budget alert notification, the unread badge updates only on next navigation (no real-time push)
- Receipt OCR accuracy depends on image quality — blurry or dark photos may return low confidence
- CSV import column auto-detection may fail on unusual header names
- The "Other" category is a catch-all that lacks specific budget tracking granularity

---

## 28. Future Opportunities

### Recommended Improvements

1. **Component decomposition**: Break `ReceiptWorkspace` (~1680 lines) into focused sub-components (CapturePanel, OCRResultReview, HistoryGrid, etc.)
2. **React component tests**: Add Vitest + React Testing Library for component-level testing
3. **CSP hardening**: Replace `'unsafe-inline'` with nonce-based script loading in production (and remove dev-only `'unsafe-eval'` dependency by aligning Turbopack config if possible)
4. **Error tracking**: Integrate Sentry or similar for production error monitoring
5. **Real-time updates**: Use Supabase Realtime subscriptions for live dashboard updates and notification push
6. **Recurring expenses**: Allow users to define recurring expenses that auto-create entries
7. **Export**: Enable expense data export as CSV or PDF reports
8. **Email receipt forwarding**: Implement the `email-receipt-parser.ts` stub with an actual email webhook

### Scaling Considerations

- Move to Render paid tier for always-on instances and automatic SSL
- Add a CDN (Cloudflare or similar) in front of static assets
- Implement Redis-based data caching for frequently-accessed dashboard queries
- Add database indexing on common query patterns (user_id + date range)
- Consider connection pooling optimization if concurrent user count grows
- Implement proper cost tracking for AI API usage

---

## 29. Glossary

| Term | Definition |
|---|---|
| **App Shell** | The persistent layout wrapper (sidebar, header, navigation) that frames all authenticated pages |
| **Background Sync** | A Web API (Chromium-only) that allows the service worker to retry failed network requests when connectivity is restored |
| **CSP** | Content Security Policy — HTTP header that restricts which resources the browser can load |
| **File Handlers** | Web API allowing a PWA to register as a handler for specific file types with the OS |
| **HSTS** | HTTP Strict Transport Security — forces HTTPS connections |
| **Idempotency Key** | A unique identifier attached to an expense creation request; if the same key is sent twice, the server returns the existing record instead of creating a duplicate |
| **Launch Queue** | Web API (`launchQueue.setConsumer()`) that lets a PWA receive files when opened via OS file association |
| **Magic Bytes** | The first few bytes of a file that identify its true format, regardless of file extension |
| **OCR** | Optical Character Recognition — extracting text data from images |
| **RLS** | Row Level Security — PostgreSQL feature where the database enforces access policies at the row level |
| **Service Role** | A Supabase credential that bypasses RLS; used only for admin operations that need unrestricted database access |
| **Share Target** | Web App Manifest feature that allows other apps to share content directly into a PWA |
| **Signed URL** | A time-limited URL generated by Supabase Storage that grants temporary access to a private file |
| **Standalone Output** | Next.js build mode that produces a self-contained Node.js server without requiring the full `node_modules` |
| **VAPID** | Voluntary Application Server Identification — key pair used for push notification authentication between server and browser |

---

## 30. Live vs Repo Observations

### Verified Matches

- Landing page renders correctly with all marketing sections
- Auth flows (login, signup) functional
- Dashboard loads with real data for authenticated users
- Demo mode accessible at `/demo` without authentication
- Receipt OCR pipeline in `src/app/api/ocr/route.ts`: **Veryfi → Gemini → OpenRouter** with resilient parsing and post-processing warnings
- Budget progress bars update when expenses are added
- Notifications appear in the notification center; **web-push** delivery runs when VAPID keys are configured
- PWA manifest served correctly; app is installable on Chromium

### Potential Discrepancies

| Area | Observation |
|---|---|
| **Push notifications** | Delivery requires correct VAPID env vars **and** user permission; otherwise only in-app notifications fire |
| **Weekly summary (bulk)** | Requires `CRON_SECRET` + Render cron hitting `POST /api/cron/weekly-summary`; per-user `POST /api/notifications/weekly-summary` still works when signed in |
| **Email receipt parsing** | `email-receipt-parser.ts` remains a stub — not wired to any transport |
| **Cold start** | On Render free tier, first visit after inactivity shows significant loading delay (30–60s) — infrastructure behavior |

### Routes in Code but Potentially Not Discoverable

- `/receipts/share-target` — primarily reached via OS share sheet (see manifest `share_target`)
- `/receipts/capture` — immersive capture + File Handlers / launch queue entry
- `/api/warmup` — health check endpoint, not user-facing
- `/api/telemetry` — internal event ingestion, not user-facing
- `/api/cron/weekly-summary` — Bearer-authenticated cron entrypoint (see `render.yaml`)

---

*This document is maintained to reflect the checked-in source of truth. When behavior depends on environment variables (Veryfi, Gemini, OpenRouter, VAPID, `CRON_SECRET`, Redis), production configuration may differ from a minimal local `.env`.*
