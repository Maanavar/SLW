-- Create commission_workers table
CREATE TABLE "commission_workers" (
  "id"         SERIAL PRIMARY KEY,
  "customerId" INTEGER NOT NULL,
  "name"       VARCHAR(120) NOT NULL,
  "shareType"  VARCHAR(20) NOT NULL,
  "shareValue" DOUBLE PRECISION NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commission_workers_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "commission_workers_customerId_idx" ON "commission_workers"("customerId");

-- Create commission_payments table
CREATE TABLE "commission_payments" (
  "id"         SERIAL PRIMARY KEY,
  "workerId"   INTEGER NOT NULL,
  "workerName" VARCHAR(120) NOT NULL,
  "customerId" INTEGER NOT NULL,
  "jobIds"     JSONB NOT NULL,
  "amount"     DOUBLE PRECISION NOT NULL,
  "date"       VARCHAR(10) NOT NULL,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "commission_payments_workerId_idx" ON "commission_payments"("workerId");
CREATE INDEX "commission_payments_customerId_idx" ON "commission_payments"("customerId");
CREATE INDEX "commission_payments_date_idx" ON "commission_payments"("date");
