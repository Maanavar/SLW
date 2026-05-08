CREATE TABLE "customer_followups" (
  "customerId" INTEGER NOT NULL,
  "nextFollowUpDate" VARCHAR(10) NOT NULL,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_followups_pkey" PRIMARY KEY ("customerId")
);

CREATE TABLE "month_locks" (
  "monthKey" VARCHAR(7) NOT NULL,
  "notes" VARCHAR(500),
  "lockedByUserId" INTEGER,
  "lockedByName" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "month_locks_pkey" PRIMARY KEY ("monthKey")
);

CREATE TABLE "system_settings" (
  "key" VARCHAR(80) NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "customer_followups_nextFollowUpDate_idx"
  ON "customer_followups"("nextFollowUpDate");

ALTER TABLE "customer_followups"
  ADD CONSTRAINT "customer_followups_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "customers"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
