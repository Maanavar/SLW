-- Add openingBalance column to customers table for tracking old dues carried forward (e.g. from Mar 2026 before system start)
ALTER TABLE "customers" ADD COLUMN "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
