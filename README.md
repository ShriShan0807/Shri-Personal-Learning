# 📦 Warehouse Inventory Management System

A full-stack **Next.js 14 (App Router) PWA** for tracking item-level warehouse inventory using **app-generated, single-use QR codes**. The app mints unique QR labels per product, prints them as PDFs, and tracks each physical item through a strict lifecycle — `GENERATED → IN_WAREHOUSE → EXITED` — via phone-camera scanning. Includes multi-user auth with role-based access control (RBAC), audit logging, and a weekly email report foundation.

> Built to run **zero-config locally** on SQLite. Designed to switch to **PostgreSQL / Supabase** for production by changing one line in the Prisma schema.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [QR Code & Item Lifecycle](#qr-code--item-lifecycle)
- [Data Model](#data-model)
- [Roles & Permissions](#roles--permissions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Implementation Status](#implementation-status)
- [Deploying to Production (Postgres/Supabase)](#deploying-to-production-postgressupabase)
- [Security Notes](#security-notes)

---

## Features

- 🔐 **Invite-only multi-user auth** — email/password, JWT in httpOnly cookies, 4 roles (admin / owner / manager / staff).
- 🏷️ **QR label generation** — admin orders a batch of *N* labels for a product; system mints *N* unique codes (`PREFIX-SEQ-RANDOM`) atomically and renders a **printable PDF** (QR + human-readable code + product name).
- 📷 **Camera scanning (PWA)** — scan a label with your phone; the next action (ENTRY/EXIT) is inferred from item status.
- 🔁 **Single-use lifecycle** — first scan = ENTRY (adds to stock), second scan = EXIT (ships to a store). Once `EXITED`, the code is terminal and rejected on re-scan.
- 📊 **Inventory dashboard** — live stock = count of `IN_WAREHOUSE` items per product; search any item and view its full movement history.
- 🧾 **Immutable movement ledger** — every ENTRY/EXIT is recorded transactionally alongside the item status update.
- 🛡️ **Audit trail** — admin/privileged actions are logged.
- 📱 **Installable PWA** — manifest + icons, responsive UI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (dev) → PostgreSQL / Supabase (prod) |
| ORM | Prisma 5 |
| Auth | Custom JWT sessions via `jose` + `bcryptjs` (httpOnly cookies) |
| Validation | Zod |
| QR generation | `qrcode` |
| QR scanning | `@zxing/browser` *(see install note below)* |
| PDF labels | `pdf-lib` |
| Email | Resend API (falls back to console logging if unconfigured) |

---

## Architecture

3-tier, serverless-leaning monolith:

- **Client** — Next.js PWA (React). Camera scanning in-browser.
- **API** — Next.js Route Handlers (`src/app/api/**`). Each handler enforces auth/role via `requireUser()` / `requireRole()`.
- **Data** — Prisma + SQLite/Postgres. Stock is derived (`COUNT(status='IN_WAREHOUSE')`), never a mutable counter.

**Auth enforcement is layered:**
1. **UI** — NavBar hides controls by role.
2. **Middleware** (`src/middleware.ts`) — guards page routes by role, redirects unauthenticated users to `/login`.
3. **API** — every Route Handler re-checks session + role server-side (defense in depth).

---

## QR Code & Item Lifecycle

**Code format:** `{PREFIX}-{SEQ}-{RANDOM}` — e.g. `MILK1L-000123-7F2A`
- `PREFIX` — product-specific (2–16 uppercase alphanumerics).
- `SEQ` — zero-padded sequence, minted **atomically** per product (`product.seqCounter` incremented inside a transaction) to guarantee uniqueness under concurrency.
- `RANDOM` — crypto-random base32 suffix to deter forgery.

```
GENERATED ──(1st scan: ENTRY)──▶ IN_WAREHOUSE ──(2nd scan: EXIT + store)──▶ EXITED ✗ terminal
```

- **ENTRY** allowed only when status = `GENERATED`.
- **EXIT** allowed only when status = `IN_WAREHOUSE`, and requires a destination `storeId`.
- **Re-scan of `EXITED`** is rejected (single-use).

---

## Data Model

8 Prisma models (`prisma/schema.prisma`):

| Model | Purpose |
|-------|---------|
| `User` | Accounts with `role` + optional `warehouseId`. |
| `Warehouse` | Physical warehouses. |
| `Store` | Dispatch destinations for exited items. |
| `Product` | Has unique `codePrefix` + `seqCounter` for code minting. |
| `LabelBatch` | A request to mint *N* labels; tracks status + links items. |
| `Item` | One physical item = one QR code; holds current `status`. |
| `Movement` | Immutable ENTRY/EXIT ledger entry. |
| `AuditLog` | Record of privileged actions. |

> SQLite has no native enums; enum-like fields (`role`, `status`, `type`) are stored as strings and enforced in app code via Zod.

---

## Roles & Permissions

| Capability | admin | owner | manager | staff |
|-----------|:-----:|:-----:|:-------:|:-----:|
| Scan ENTRY/EXIT | ✅ | ✅ | ✅ | ✅ |
| View inventory | ✅ | ✅ | ✅ | ✅ |
| Manage products | ✅ | — | ✅ | — |
| Generate QR label batches | ✅ | — | — | — |
| Manage warehouses/stores | ✅ | — | — | — |
| Receive weekly report | — | ✅ | — | — |

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A modern browser (camera scanning requires **HTTPS or `localhost`**)

### 1. Install dependencies
```bash
cd warehouse-inventory
npm install
```

> ⚠️ **Scanner dependency note:** the camera scanner imports `@zxing/browser`. If your initial install of it failed (e.g. behind a proxy), install it explicitly:
> ```bash
> npm install @zxing/browser @zxing/library
> ```
> The rest of the app (label generation, manual code entry, inventory) works without it; only the live camera component needs it.

### 2. Configure environment
```bash
cp .env.example .env
# then edit .env — at minimum set a strong AUTH_SECRET
```

### 3. Set up the database
```bash
npx prisma migrate dev   # or: npx prisma db push
npm run seed             # creates the first admin + sample data
```

### 4. Run the dev server
```bash
npm run dev
```
Open http://localhost:3000 and sign in with the seeded admin (see `.env`):
- **Email:** `admin@warehouse.local`
- **Password:** `Admin123!`  *(change immediately for any non-local use)*

Seed also creates an **owner** (`owner@warehouse.local` / `Owner123!`) and **staff** (`staff@warehouse.local` / `Staff123!`) user, plus a Main Warehouse, a Downtown Store, and sample products.

### Available scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server. |
| `npm run build` | `prisma generate` + production build. |
| `npm run start` | Run the production build. |
| `npm run seed` | Seed admin + sample data. |
| `npm run prisma:migrate` | Run Prisma migrations. |
| `npm run prisma:push` | Push schema without migrations. |

---

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | DB connection (`file:./dev.db` for SQLite). |
| `AUTH_SECRET` | ✅ | Secret for signing session JWTs (min 16 chars; use a long random string). |
| `SESSION_MAX_AGE` | — | Session lifetime in seconds (default 604800 = 7 days). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | Credentials for the seeded admin. |
| `CRON_SECRET` | — | Secret to authorize the weekly-report endpoint. |
| `REPORT_OWNER_EMAIL` | — | Recipient of the weekly report. |
| `LOW_STOCK_THRESHOLD` | — | Products below this `IN_WAREHOUSE` count are flagged low-stock (default 10). |
| `RESEND_API_KEY` | — | Resend API key; if unset, emails are logged to the console. |
| `EMAIL_FROM` | — | From-address for outbound email. |

---

## Project Structure

```
warehouse-inventory/
├── prisma/
│   ├── schema.prisma        # 8 models (User, Warehouse, Store, Product, LabelBatch, Item, Movement, AuditLog)
│   └── seed.ts              # first admin + owner/staff + sample warehouse/store/products
├── public/
│   ├── manifest.json        # PWA manifest
│   └── icons/               # PWA icons (192/512)
├── src/
│   ├── middleware.ts        # route guards (auth + role) for pages
│   ├── app/
│   │   ├── layout.tsx       # root layout + PWA metadata
│   │   ├── login/page.tsx   # sign-in
│   │   ├── (app)/           # authenticated shell (NavBar + role gate)
│   │   │   ├── page.tsx         # dashboard
│   │   │   ├── scan/page.tsx    # camera + manual scan
│   │   │   ├── inventory/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   └── labels/page.tsx  # QR batch generation + PDF download
│   │   └── api/
│   │       ├── auth/{login,logout,me}/route.ts
│   │       ├── products/route.ts + [id]/route.ts
│   │       ├── warehouses/route.ts
│   │       ├── stores/route.ts
│   │       ├── label-batches/route.ts + [id]/pdf/route.ts
│   │       └── items/by-code/[code]/route.ts + [code]/scan/route.ts
│   ├── components/
│   │   ├── NavBar.tsx
│   │   └── Scanner.tsx      # @zxing/browser camera scanner
│   └── lib/
│       ├── auth.ts          # JWT sign/verify (jose)
│       ├── session.ts       # getSession / requireUser / requireRole
│       ├── prisma.ts        # Prisma singleton
│       ├── codes.ts         # buildItemCode / randomSuffix
│       ├── validation.ts    # Zod schemas
│       ├── audit.ts         # audit log writer
│       ├── email.ts         # Resend (console fallback)
│       ├── pdf.ts           # label-grid PDF
│       └── qr.ts            # QR PNG / data URL
└── .env.example
```

---

## API Reference

All endpoints require an authenticated session cookie unless noted. Privileged endpoints additionally check role.

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Sign in; sets session cookie. |
| `POST` | `/api/auth/logout` | Clear session. |
| `GET`  | `/api/auth/me` | Current user (or `null`). |

### Products
| Method | Route | Role |
|--------|-------|------|
| `GET`  | `/api/products` | any |
| `POST` | `/api/products` | admin, manager |
| `PATCH`| `/api/products/[id]` | admin, manager |
| `DELETE`| `/api/products/[id]` | admin |

### Warehouses & Stores
| Method | Route | Role |
|--------|-------|------|
| `GET` / `POST` | `/api/warehouses` | GET: any · POST: admin |
| `GET` / `POST` | `/api/stores` | GET: any · POST: admin |

### Label batches
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET`  | `/api/label-batches` | any | List recent batches. |
| `POST` | `/api/label-batches` | admin | Mint *N* items + create batch (atomic). |
| `GET`  | `/api/label-batches/[id]/pdf` | admin | Download printable label PDF. |

### Items & scanning
| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/items/by-code/[code]` | Look up item + `nextAction` + movement history. |
| `POST` | `/api/items/[code]/scan` | Status-driven ENTRY/EXIT (transactional). EXIT body: `{ "storeId": "..." }`. |

### Users (admin only)
| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/users` | List users. |
| `POST` | `/api/users` | Create/invite a user (email, role, warehouse, initial password). |
| `PATCH`| `/api/users/[id]` | Update role / active / warehouse / name / password. |
| `DELETE`| `/api/users/[id]` | Deactivate (soft-delete). |

### Warehouse / Store editing (admin only)
| Method | Route | Description |
|--------|-------|-------------|
| `PATCH` / `DELETE` | `/api/warehouses/[id]` | Edit / delete a warehouse (blocked if it has items). |
| `PATCH` / `DELETE` | `/api/stores/[id]` | Edit / delete a store (blocked if items shipped there). |

### Reports
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET`  | `/api/reports/summary?days=7` | admin/owner/manager | On-demand activity + stock summary. |
| `GET`/`POST` | `/api/cron/weekly-report` | `CRON_SECRET` | Generate + email the weekly report (for schedulers). |

---

## Implementation Status

This build fully implements the plan through **Phase 3 (Scanning & Inventory)**, plus the lib foundations for Phase 4.

### ✅ Implemented
- **Phase 1 — Foundation:** Next.js + TS + Tailwind, PWA manifest/icons, Prisma schema + seed, JWT auth (login/logout/me), role middleware, audit logging.
- **Phase 2 — Products & QR Labels:** product CRUD + UI, atomic batch minting of unique item codes, QR + label-grid PDF generation & download.
- **Phase 3 — Scanning & Inventory:** camera scanner (`@zxing/browser`) + manual entry, status-driven ENTRY/EXIT with transactional movement ledger, single-use rejection, inventory dashboard with per-product stock and item history search.
- **Admin Console (`/admin`):** user management (create/invite, change role, deactivate/reactivate) + warehouse & store create/delete, via `/api/users`, `/api/warehouses/[id]`, `/api/stores/[id]`.
- **Reports (`/reports`):** on-demand activity + stock summary with selectable range, low-stock and shipments-by-store breakdowns (`/api/reports/summary`).
- **Phase 4 — Weekly report:** aggregation (`lib/report.ts`) + HTML email, secured cron endpoint (`/api/cron/weekly-report`), standalone runner (`scripts/run-weekly-report.ts` via `npm run cron:weekly`), and a Vercel Cron schedule (`vercel.json`, Mondays 08:00).

### 🚧 Roadmap
- **Invite-by-email flow** — currently the admin sets an initial password directly; emailed set-password links are a future enhancement.
- **Phase 5 hardening** — Supabase Row-Level Security (when on Postgres), login rate limiting, PWA install-prompt polish.

> **Note:** the `@zxing/browser` dependency may need a manual install (see [Getting Started](#1-install-dependencies)); the rest of the app runs without it.

---

## Deploying to Production (Postgres/Supabase)

1. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your Postgres/Supabase connection string.
3. Run `npx prisma migrate deploy`.
4. Set a strong `AUTH_SECRET`, configure `RESEND_API_KEY` + `EMAIL_FROM` for email, and `CRON_SECRET` for scheduled jobs.
5. Deploy to Vercel (or any Node host). Camera scanning requires HTTPS — Vercel provides this by default.

---

## Security Notes

- **Never commit secrets.** Keep tokens, API keys, and `.env` out of git. If a credential is ever committed, **revoke it immediately** and purge it from history.
- Passwords are hashed with **bcrypt**; sessions are signed JWTs stored in **httpOnly** cookies.
- All API handlers enforce authentication and role server-side — never rely on UI hiding alone.
- Item codes include a crypto-random suffix to deter forgery; uniqueness is enforced by a DB unique index and atomic sequence minting.

---

*Built with Next.js, Prisma, and Tailwind CSS.*
