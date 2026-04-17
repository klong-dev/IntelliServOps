ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "billingMonth" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_invoiceType_status_idx"
ON "invoices"("invoiceType", "status");

CREATE INDEX IF NOT EXISTS "invoices_dueDate_status_idx"
ON "invoices"("dueDate", "status");

CREATE INDEX IF NOT EXISTS "invoices_paidAt_idx"
ON "invoices"("paidAt");

CREATE INDEX IF NOT EXISTS "invoices_billingMonth_idx"
ON "invoices"("billingMonth");

ALTER TABLE "payments"
ADD COLUMN IF NOT EXISTS "receiverUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_receiverUserId_fkey'
  ) THEN
    ALTER TABLE "payments"
    ADD CONSTRAINT "payments_receiverUserId_fkey"
    FOREIGN KEY ("receiverUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_receiverUserId_idx"
ON "payments"("receiverUserId");

CREATE INDEX IF NOT EXISTS "payments_receiverUserId_status_idx"
ON "payments"("receiverUserId", "status");