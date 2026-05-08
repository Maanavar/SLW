# Siva Lathe Works

Business operations app for Siva Lathe Works, built with React + TypeScript.

## Local Backend + Database (Phase 1)

This repo now includes a local-first backend foundation in [`backend/`](./backend):

- Express + TypeScript API
- Prisma ORM
- PostgreSQL via Docker
- Activity logs for future Logger UI
- Guarded purge endpoints for admin-only data cleanup

## Project Structure

- `src/` application source
- `public/` static assets
- `dist/` production build output
- `backend/` local API service and Prisma schema
- `docker-compose.yml` base database service definition
- `docker-compose.dev.yml` local-only tools (Adminer)
- `docker-compose.prod.yml` production stack (frontend + backend + nginx TLS + postgres)
- `Dockerfile` frontend multi-stage image
- `backend/Dockerfile` backend multi-stage image

## Scripts

- `npm run dev` start Vite dev server
- `npm run dev:backend` start backend in watch mode
- `npm run build` create production build
- `npm run build:backend` compile backend
- `npm run preview` preview the built app
- `npm run type-check` run TypeScript checks
- `npm run type-check:backend` run backend type checks
- `npm run validate` run type-check + build
- `npm run db:up` start local PostgreSQL + Adminer
- `npm run db:down` stop local database services

## Production Containers

1. Place TLS cert/key in `certs/fullchain.pem` and `certs/privkey.pem`.
2. Set required env vars:
   - `POSTGRES_PASSWORD`
   - `ADMIN_API_KEY`
   - `AUTH_DEFAULT_ADMIN_EMAIL` (optional, defaults to `local-admin@slw.local`)
   - `AUTH_SESSION_SECRET`
3. Start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Backend setup details: see [`backend/README.md`](./backend/README.md).
