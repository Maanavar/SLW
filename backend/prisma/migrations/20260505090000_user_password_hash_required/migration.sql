UPDATE "users"
SET "passwordHash" = 'NOT_USED_USE_ADMIN_API_KEY'
WHERE "passwordHash" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "passwordHash" SET NOT NULL;
