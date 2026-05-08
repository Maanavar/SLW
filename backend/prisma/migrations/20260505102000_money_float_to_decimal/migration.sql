ALTER TABLE "customers"
  ALTER COLUMN "advanceBalance" TYPE DECIMAL(14,2) USING ROUND("advanceBalance"::numeric, 2),
  ALTER COLUMN "openingBalance" TYPE DECIMAL(14,2) USING ROUND("openingBalance"::numeric, 2);

ALTER TABLE "work_types"
  ALTER COLUMN "defaultRate" TYPE DECIMAL(14,2) USING ROUND("defaultRate"::numeric, 2);

ALTER TABLE "jobs"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "commissionAmount" TYPE DECIMAL(14,2) USING ROUND("commissionAmount"::numeric, 2),
  ALTER COLUMN "netAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "netAmount" IS NULL THEN NULL
    ELSE ROUND("netAmount"::numeric, 2)
  END,
  ALTER COLUMN "paidAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "paidAmount" IS NULL THEN NULL
    ELSE ROUND("paidAmount"::numeric, 2)
  END,
  ALTER COLUMN "agentCommissionAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "agentCommissionAmount" IS NULL THEN NULL
    ELSE ROUND("agentCommissionAmount"::numeric, 2)
  END,
  ALTER COLUMN "agentTdsAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "agentTdsAmount" IS NULL THEN NULL
    ELSE ROUND("agentTdsAmount"::numeric, 2)
  END,
  ALTER COLUMN "agentSettlementPaidAmount" TYPE DECIMAL(14,2) USING CASE
    WHEN "agentSettlementPaidAmount" IS NULL THEN NULL
    ELSE ROUND("agentSettlementPaidAmount"::numeric, 2)
  END;

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "commission_payments"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "expenses"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);
