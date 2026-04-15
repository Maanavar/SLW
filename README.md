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
- `docker-compose.yml` local PostgreSQL + Adminer

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

Backend setup details: see [`backend/README.md`](./backend/README.md).
