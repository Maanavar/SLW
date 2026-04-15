# SLW Backend (Local First)

Production-style local backend for Siva Lathe Works using:

- Express + TypeScript
- Prisma ORM
- PostgreSQL (Docker)

## 1) Prerequisites

- Node.js 20+
- Docker Desktop (for local PostgreSQL)

## 2) Start local database

From repository root:

```bash
docker compose up -d postgres adminer
```

Adminer UI: `http://localhost:8081`

## 3) Configure backend env

```bash
cd backend
cp .env.example .env
```

## 4) Install and initialize

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed
```

## 5) Run API

```bash
npm run dev
```

API base URL: `http://localhost:3000/api`

## Main endpoints

- `GET /api/health`
- `GET /api/health/db`
- `GET|POST|PUT|DELETE /api/customers`
- `GET|POST|PUT|DELETE /api/work-types`
- `GET|POST|PUT|DELETE /api/jobs`
- `POST /api/jobs/bulk`
- `DELETE /api/jobs?all=true`
- `GET|POST|PUT|DELETE /api/payments`
- `DELETE /api/payments?all=true`
- `GET|POST|PUT|DELETE /api/expenses`
- `DELETE /api/expenses?all=true`
- `GET /api/logs`
- `POST /api/admin/purge`
- `POST /api/admin/import-legacy`

## Admin purge safety

`POST /api/admin/purge` requires:

- Header: `x-admin-key` (if `ADMIN_API_KEY` is set)
- Body `confirmText` exactly: `DELETE ALL DATA`

This is designed to avoid accidental data wipe.

## Legacy localStorage import

Use `POST /api/admin/import-legacy` to migrate your current frontend data into PostgreSQL.

Requirements:

- Header: `x-admin-key` (if enabled in `.env`)
- Body contains arrays: `customers`, `workTypes`, `jobs`, `payments`, `expenses`
- Use `overwrite: true` to replace existing DB data

This endpoint preserves explicit IDs and realigns PostgreSQL sequences, so new inserts continue safely.
