CREATE TABLE "utility_rate_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "electricityRatePerUnit" DECIMAL(10,2) NOT NULL,
    "waterRatePerUnit" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utility_rate_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "utility_rate_settings_key_key" ON "utility_rate_settings"("key");

INSERT INTO "utility_rate_settings" (
    "id",
    "key",
    "electricityRatePerUnit",
    "waterRatePerUnit",
    "currency",
    "notes",
    "createdAt",
    "updatedAt"
)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'global',
    3500.00,
    15000.00,
    'VND',
    'Default global utility rates used when creating new utility meters.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
