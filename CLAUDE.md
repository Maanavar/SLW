# CLAUDE.md — Siva Lathe Works (SLW)

This file is the authoritative guide for AI coding agents working in this repository.
Read it fully before writing any code, suggesting any change, or answering any architectural question.

---

## What this project is

**Siva Lathe Works (SLW)** is a full-stack business management system for a lathe manufacturing shop.
It manages jobs, customers, payments, commissions, expenses, invoices, and financial reporting.

The system is used by internal staff only (admin-role users). There is no public-facing API.

---

## Stack at a glance

| Layer      | Technology                                                                 |
|------------|----------------------------------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React Router 6 (hash), TanStack Query, Zustand |
| Validation | Zod (both frontend and backend)                                            |
| Charts     | Recharts                                                                   |
| Export     | ExcelJS (Excel), jsPDF + html-to-image (PDF)                               |
| Backend    | Express 4, TypeScript, Prisma 5, PostgreSQL 16                             |
| Auth       | Cookie-based JWT (`slw_session`) via `jose`                                |
| Testing    | Vitest + Supertest                                                         |
| Monitoring | Sentry (optional, DSN via env)                                             |
| Infra      | Docker Compose (PostgreSQL + Adminer); NGINX in production                 |

---

## Repository layout

```
/                          ← repo root (also frontend)
  src/
    App.tsx                ← root layout: sidebar, header, session timeout, global modals
    main.tsx               ← router (hash), lazy routes, error boundaries, React Query provider
    screens/               ← page-level screens (one folder per feature)
    components/
      layout/              ← Sidebar, TopHeader, MobileNav, NotificationBell, Overlay
      ui/                  ← shared UI: DataTable, Modal, Toast, SearchableSelect, Badge, StatCard …
      modals/              ← CustomerModal, WorkTypeModal, CategoryModal
      charts/              ← chart wrappers
      dashboard/           ← dashboard-specific components
      job-card/            ← job card components
    hooks/                 ← 13 React Query hooks (useJobsQuery, useCustomersQuery, …)
    stores/
      dataStore.ts         ← main Zustand store (35 KB) — all fetched data lives here
      uiStore.ts           ← UI state: sidebar open, mobile drawer, modal flags
    lib/                   ← 25 pure utilities (no React)
    types/                 ← shared TypeScript types
    constants/             ← app-wide constants
    styles/                ← global CSS

  backend/
    src/
      index.ts             ← server entry: port 3001, port-fallback dev mode, graceful shutdown
      app.ts               ← Express app: CORS, Helmet, cookie-parser, 2 MB JSON limit, Morgan
      routes/              ← 13 route files (thin handlers only)
      services/            ← 6 service files (business logic, no HTTP concerns)
      domain/              ← shared types, enums, Zod schemas for domain objects
      middleware/
        auth.ts            ← requireAuth: validates slw_session JWT, attaches user to req
        asyncHandler.ts    ← wraps async route handlers, forwards errors to Express
        errorHandler.ts    ← global Express error handler
        httpError.ts       ← HttpError(status, message) factory
        notFound.ts        ← 404 handler
      lib/                 ← cache utilities (ioredis)
      utils/               ← date helpers, ID generators, pagination
      config/              ← env validation and runtime config
      db/                  ← Prisma client singleton
      openapi/             ← OpenAPI 3 spec + Swagger UI route

    prisma/
      schema.prisma        ← 12 Prisma models (see Database Models section)
```

---

## All screens

| Screen folder         | Purpose                                            |
|-----------------------|----------------------------------------------------|
| `auth/`               | Login                                              |
| `dashboard/`          | Summary stats and charts                           |
| `jobs/`               | Job list, add/edit jobs                            |
| `customers/`          | Customer list, balances, ranking                   |
| `payments/`           | Payment recording and history                      |
| `worktypes/`          | Work type catalog management                       |
| `commission-dc/`      | DC (delivery challan) commission screen            |
| `expenses/`           | Expense manager (recurring + one-off)              |
| `finance/`            | Finance reports (FinanceReports.tsx at src root)   |
| `history/`            | Activity/audit history                             |
| `invoice/`            | Invoice generation                                 |
| `owner-report/`       | Owner P&L summary                                  |
| `records/`            | General records view                               |
| `followups/`          | Customer follow-up scheduler                       |
| `logger/`             | System log viewer                                  |

---

## All API routes

All routes are mounted under `/api` and require `requireAuth` unless noted.

| File                    | Prefix                      | Notes                                    |
|-------------------------|-----------------------------|------------------------------------------|
| `auth.ts`               | `/api/auth`                 | Login, logout, session check — no auth   |
| `customers.ts`          | `/api/customers`            | CRUD + soft delete                       |
| `jobs.ts`               | `/api/jobs`                 | CRUD, filtering, status updates          |
| `payments.ts`           | `/api/payments`             | Payment recording and history            |
| `workTypes.ts`          | `/api/work-types`           | CRUD                                     |
| `expenses.ts`           | `/api/expenses`             | CRUD, recurring support                  |
| `commissionWorkers.ts`  | `/api/commission-workers`   | CRUD for commission worker profiles      |
| `commissionPayments.ts` | `/api/commission-payments`  | Commission payout recording              |
| `followups.ts`          | `/api/followups`            | Per-customer follow-up dates and notes   |
| `monthLocks.ts`         | `/api/month-locks`          | Lock/unlock accounting months            |
| `logs.ts`               | `/api/logs`                 | Activity log read access                 |
| `admin.ts`              | `/api/admin`                | Admin operations (import, seeding, etc.) |
| `backups.ts`            | `/api/backups`              | Trigger/list PostgreSQL backups          |
| `health.ts`             | `/api/health`               | Health check — no auth                   |
| `docs.ts`               | `/api/docs`                 | Swagger UI — no auth                     |

---

## Database models (Prisma)

```
User               id, name, email (unique), role, passwordHash, isActive
Customer           id, name, shortCode, type (enum), hasCommission, requiresDc,
                   hasBillNo, advanceBalance, openingBalance, invoiceGroup,
                   notes, isActive
WorkType           id, category, name, shortCode, defaultUnit, defaultRate, isActive
Job                id, customerId (FK), workTypeName, quantity, amount,
                   commissionAmount, commissionWorkerId (FK), netAmount,
                   date, paymentStatus, paymentMode, paidAmount, workMode,
                   isSpotWork, jobCardId, billNo, dcNo, vehicleNo,
                   agentName, agentCommissionAmount, agentTdsAmount
Payment            id, customerId (FK), amount, date, paymentMode,
                   breakdown (JSON), referenceNumber,
                   paymentForMonth, paymentForDate, paymentForFromDate
CommissionWorker   id, customerId (FK), name, shareType, shareValue, isActive
CommissionPayment  id, workerId, workerName, customerId, jobIds (JSON), amount, date
Expense            id, category, description, amount, date,
                   isRecurring, recurringDay, notes
ActivityLog        id, actorUserId (FK), entityType, entityId, action, message,
                   before (JSON), after (JSON), metadata (JSON), createdAt
CustomerFollowUp   customerId (PK), nextFollowUpDate, notes, createdAt, updatedAt
MonthLock          monthKey (string PK), notes, lockedByUserId, lockedByName
SystemSetting      key (string PK), value (JSON), createdAt, updatedAt
```

`Prisma.Decimal` values are serialized to plain `number` in JSON responses via
`toJSON` override in `app.ts` — treat all monetary fields as `number` on the frontend.

---

## Auth flow

- Login posts to `POST /api/auth/login` → sets `slw_session` HTTP-only cookie (JWT, 12 h default)
- `requireAuth` middleware in `backend/src/middleware/auth.ts` verifies the cookie on every protected route
- Frontend detects 401 responses in `src/lib/apiClient.ts` and redirects to login
- Session timeout is also enforced client-side in `src/App.tsx` (12-hour inactivity default)
- Only one role exists: `admin`

---

## Key architectural rules

### Frontend

1. **Screens own page logic.** Put layout, state orchestration, and data fetching calls in `src/screens/`. Keep components in `src/components/` display-focused and prop-driven.
2. **All server state goes through React Query hooks.** Custom hooks live in `src/hooks/`. Do not call `apiClient` directly from screens; go through a hook.
3. **Global data cache is in `dataStore`.** `src/stores/dataStore.ts` holds fetched lists (jobs, customers, payments, etc.). React Query hooks populate it. Do not duplicate data in component state.
4. **UI-only state goes in `uiStore`.** Sidebar open/close, mobile drawer, modal open flags live in `src/stores/uiStore.ts`.
5. **Use path alias `@/`** — maps to `src/`. Import as `@/lib/dateUtils`, not `../../lib/dateUtils`.
6. **Router is hash-based.** All `<Link>` and `useNavigate` calls use hash paths. Routes are lazy-loaded with React.lazy in `src/main.tsx`.
7. **Error boundaries per screen.** Each lazy-loaded screen is wrapped in `ScreenErrorBoundary`. Do not remove these.

### Backend

1. **Route handlers are thin.** Parse request → validate with Zod → call service → return response. No business logic in route files.
2. **Business logic lives in `backend/src/services/`.** Services do not import `req`/`res`.
3. **All DB access is in services via Prisma.** Do not call `prisma` from routes directly.
4. **Wrap all async route handlers with `asyncHandler`.** Never use try/catch in route files; let `asyncHandler` forward errors.
5. **Throw `HttpError(status, message)` for expected errors.** The global error handler in `errorHandler.ts` formats these into JSON responses.
6. **Validate all request bodies with Zod** before passing to services.
7. **Log mutating operations with `activityLogService`.** Pass `before` and `after` snapshots for UPDATE and DELETE operations.
8. **Use `getActorFromRequest(req)` to get user context** when calling `activityLogService`.

---

## Commission model (important domain knowledge)

- Each `Job` may have a `commissionWorkerId` field pointing to a `CommissionWorker`.
- Commission workers are assigned **manually per job** — there is no automatic assignment.
- The assigned worker receives **100% of that job's commission amount**.
- `CommissionPayment` records actual payouts made to workers.
- `hasCommission` on `Customer` controls whether jobs for that customer generate commission.

---

## Month locking

- `MonthLock` records lock a specific `monthKey` (e.g. `"2024-03"`) from further edits.
- Locked months should be checked before allowing job/payment mutations. Backend enforces this.
- The `monthLocks.ts` route handles lock/unlock operations.

---

## Code conventions

### TypeScript

- Strict mode is on for both frontend and backend.
- Do not use `any` — use `unknown` with a type guard if necessary.
- Backend target is ES2022 (CommonJS); frontend target is ES2020 (ESNext modules).

### Zod usage

- Frontend: validate form inputs before submission.
- Backend: validate every `req.body` and `req.query` in route handlers before passing to services.
- Reuse domain Zod schemas from `backend/src/domain/` when the same shape is needed in multiple routes.

### Prisma

- All Prisma queries go in service functions, not routes.
- Monetary fields use `Prisma.Decimal` in the schema. They serialize to `number` via the `toJSON` override — handle them as `number` everywhere outside the ORM.
- Use `prisma.$transaction` for operations that must be atomic.

### Naming

| Thing                | Convention                                    |
|----------------------|-----------------------------------------------|
| React components     | PascalCase files and function names           |
| Hooks                | `use` prefix, camelCase                       |
| Utilities (lib/)     | camelCase, named exports                      |
| Route files          | camelCase matching the resource name          |
| Service functions    | verb + noun: `createJob`, `updateCustomer`    |
| Zod schemas          | `<Entity>Schema`, e.g. `CreateJobSchema`      |
| Prisma models        | PascalCase as defined in schema               |

### CSS

- Component-specific styles use co-located `.css` files (e.g. `RecordsScreen.css`).
- Global styles are in `src/styles/`.
- No CSS-in-JS. No Tailwind.

---

## Commands reference

### From repo root

```sh
npm run dev                        # Vite dev server (port 5173, proxies /api → 3001)
npm run dev:backend                # Express in tsx watch mode (port 3001)
npm run build                      # Vite production build → dist/
npm run build:backend              # tsc backend → backend/dist/
npm run validate                   # type-check + build (frontend + backend)
npm run test                       # Vitest
npm run test:coverage              # Vitest with coverage
npm run lint:check                 # ESLint across frontend + backend
npm run type-check                 # frontend tsc --noEmit
npm run type-check:backend         # backend tsc --noEmit
```

### Database / Docker

```sh
npm run db:up                      # start PostgreSQL 16 + Adminer (Docker Compose)
npm run db:down                    # stop database containers
npm run prod:up                    # start production Docker stack
npm run prod:down                  # stop production stack
npm run db:backup                  # manual PostgreSQL backup (PowerShell)
npm run db:restore                 # restore from backup (PowerShell)
```

### Backend / Prisma

```sh
npm --prefix backend run prisma:generate          # regenerate Prisma client after schema change
npm --prefix backend run prisma:migrate -- --name <name>   # create + apply new migration
npm --prefix backend run prisma:push              # push schema without migration file (dev only)
npm --prefix backend run prisma:studio            # open Prisma Studio
npm --prefix backend run db:seed                  # seed database with initial data
```

---

## Environment variables

### Frontend (`.env` / `.env.local`)

```
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_ENABLE_BACKEND_SYNC=true
VITE_ENABLE_REPORTS=true
VITE_CURRENCY_SYMBOL=INR
VITE_APP_TIMEZONE=Asia/Kolkata
VITE_SENTRY_DSN=                   # optional
```

### Backend (`backend/.env`)

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://slw_admin:slw_dev_password@localhost:5432/slw_local
CORS_ORIGIN=http://localhost:5173
ADMIN_API_KEY=slw-local-admin-key
AUTH_SESSION_SECRET=change-this-in-production
AUTH_SESSION_HOURS=12
AUTH_DEFAULT_ADMIN_EMAIL=local-admin@slw.local
AUTH_ALLOW_LEGACY_API_KEY_LOGIN=true
BACKUP_DIRECTORY=../backups
BACKUP_SCHEDULE_HOURS=24
BACKUP_RETENTION_DAYS=30
SENTRY_DSN=                        # optional
```

---

## Testing conventions

- Framework: **Vitest** for both frontend and backend.
- Backend route tests use **Supertest** against the Express app.
- Unit test pure functions (utils, services) in isolation.
- Integration test API routes with Supertest — avoid mocking Prisma if you can test with a real DB.
- Test files live next to the file they test: `jobUtils.test.ts` alongside `jobUtils.ts`.
- Do not assert implementation details. Assert observable behaviour and return values.

---

## Adding a new feature — checklist

### Backend route

1. Create/update Zod schema in `backend/src/domain/` or inline in the route file.
2. Add thin route handler in `backend/src/routes/<resource>.ts` using `asyncHandler`.
3. Add business logic in `backend/src/services/<resource>Service.ts`.
4. Log mutations with `activityLogService` (before + after).
5. Register the router in `backend/src/app.ts` if it's a new route file.
6. Run `npm run type-check:backend`.

### Frontend screen or component

1. Add the screen file under `src/screens/<feature>/`.
2. Add a React Query hook in `src/hooks/use<Resource>Query.ts` that calls `apiClient`.
3. Wire server data into `dataStore` if it needs to be globally accessible.
4. Register the lazy route in `src/main.tsx`.
5. Add a nav link in `src/components/layout/Sidebar.tsx` (and `MobileNav.tsx` if needed).
6. Run `npm run type-check`.

### Database model change

1. Edit `backend/prisma/schema.prisma`.
2. Run `npm --prefix backend run prisma:migrate -- --name <descriptive-name>`.
3. Run `npm --prefix backend run prisma:generate`.
4. Update any affected service functions and Zod schemas.

---

## What Claude / AI agents must NOT do

- Ship code without human review.
- Make security or deployment decisions autonomously.
- Read, log, or echo real customer names, job amounts, or PII from `.env` or the database.
- Introduce `any` types to work around TypeScript errors.
- Call `prisma` from route files — always go through a service.
- Skip `asyncHandler` on route handlers.
- Skip Zod validation on any `req.body` that goes into a service.
- Add features, abstractions, or error handling beyond what the task requires.
- Add code comments that describe *what* the code does — only comment the *why* when it is non-obvious.

---

## Quick-reference: key files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Root layout, session timeout, global modals |
| `src/main.tsx` | Hash router, lazy routes, error boundaries, Query provider |
| `src/stores/dataStore.ts` | Global Zustand data cache (35 KB) |
| `src/stores/uiStore.ts` | UI-only Zustand state |
| `src/lib/apiClient.ts` | Fetch wrapper with auth, timeout, 401 redirect |
| `src/lib/financeUtils.ts` | Financial calculations |
| `src/lib/jobUtils.ts` | Job-related helpers |
| `src/lib/dateUtils.ts` | Date formatting and manipulation |
| `src/lib/exportUtils.ts` | Excel + PDF export helpers |
| `backend/src/index.ts` | Server entry, port fallback, graceful shutdown |
| `backend/src/app.ts` | Express app config, middleware, route registration |
| `backend/src/middleware/auth.ts` | JWT cookie validation |
| `backend/src/services/authService.ts` | Token generation/verification |
| `backend/src/services/activityLogService.ts` | Audit log writes |
| `backend/src/services/backupService.ts` | Scheduled PostgreSQL backups |
| `backend/prisma/schema.prisma` | Single source of truth for DB schema |

---

*Keep this file updated whenever SLW adds new screens, routes, models, libraries, or architectural decisions.*
