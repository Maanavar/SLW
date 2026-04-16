-- Add advanceBalance column to customers table for tracking credit from overpayments
ALTER TABLE "customers" ADD COLUMN "advanceBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
