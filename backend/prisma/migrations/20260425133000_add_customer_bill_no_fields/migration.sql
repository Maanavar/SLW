-- AlterTable
ALTER TABLE "customers"
  ADD COLUMN "hasBillNo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "jobs"
  ADD COLUMN "billNo" VARCHAR(40);

-- Index
CREATE INDEX "jobs_billNo_idx" ON "jobs"("billNo");

-- Enable bill-number workflow for Ramani customers (RMP and NM), including existing records.
UPDATE "customers"
SET "hasBillNo" = true
WHERE LOWER(TRIM(COALESCE("shortCode", ''))) IN ('rmp', 'nm')
   OR LOWER(COALESCE("name", '')) LIKE '%ramani motors%'
   OR LOWER(COALESCE("name", '')) LIKE '%mahaling%';
